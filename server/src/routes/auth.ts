import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';

import {
  checkUserCredentials,
  COOKIE_NAME,
  createSession,
  deleteSession,
  requireAuth,
  WEB_SESSION_TTL_MS,
  webToken,
  type AuthEnv,
} from '../auth';
import { users, type PasskeyCredential } from '../db';
import { hashPassword, verifyPassword } from '../password';
import { newTotpSecret, totpUri, verifyTotp } from '../totp';
import { clientFingerprint, rpID, rpOrigin, RP_NAME } from '../webauthn';

export const authRoutes = new Hono<AuthEnv>();

const CHALLENGE_COOKIE = 'anvil_webauthn_challenge';

function publicMe(user: {
  username: string;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  passkeys: PasskeyCredential[];
}) {
  return {
    username: user.username,
    role: user.role,
    totpEnabled: user.totpEnabled,
    passkeys: user.passkeys.map(publicPasskey),
  };
}

function publicPasskey(p: PasskeyCredential) {
  return { id: p.id, name: p.name, createdAt: p.createdAt };
}

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password, code } = body as Record<string, string>;
  if (!username || !password) {
    return c.json({ error: 'missing_fields' }, 400);
  }

  const result = await checkUserCredentials(username, password, code);
  if (!result.ok) {
    return c.json({ error: result.error }, 401);
  }

  const token = await createSession(result.account._id, 'web');
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: WEB_SESSION_TTL_MS / 1000,
  });
  return c.json(publicMe(result.account));
});

authRoutes.post('/logout', async (c) => {
  await deleteSession(webToken(c));
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => {
  return c.json(publicMe(c.get('user')));
});

authRoutes.post('/password', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { current, next } = body as Record<string, string>;
  if (!current || !next || next.length < 8) {
    return c.json({ error: 'password_too_short' }, 400);
  }
  if (!(await verifyPassword(current, user.passwordHash))) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  await users().updateOne(
    { _id: user._id },
    { $set: { passwordHash: await hashPassword(next) } },
  );
  return c.json({ ok: true });
});

// ── 2FA (TOTP) ───────────────────────────────────────────────────────────────

authRoutes.post('/totp/setup', requireAuth, async (c) => {
  const user = c.get('user');
  const secret = newTotpSecret();
  await users().updateOne(
    { _id: user._id },
    { $set: { totpSecret: secret, totpEnabled: false } },
  );
  return c.json({ secret, uri: totpUri(user.username, secret) });
});

authRoutes.post('/totp/enable', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const code = (body as Record<string, string>).code ?? '';
  if (!user.totpSecret || !verifyTotp(user.totpSecret, code)) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  await users().updateOne({ _id: user._id }, { $set: { totpEnabled: true } });
  return c.json({ ok: true });
});

authRoutes.post('/totp/disable', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const code = (body as Record<string, string>).code ?? '';
  if (!user.totpEnabled || !user.totpSecret) {
    return c.json({ error: 'not_enabled' }, 400);
  }
  if (!verifyTotp(user.totpSecret, code)) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  await users().updateOne(
    { _id: user._id },
    { $set: { totpSecret: null, totpEnabled: false } },
  );
  return c.json({ ok: true });
});

// ── Passkeys WebAuthn (en plus du mot de passe, pas à la place) ─────────────

authRoutes.post('/passkey/register/options', requireAuth, async (c) => {
  const user = c.get('user');
  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: rpID(c),
    userName: user.username,
    userDisplayName: user.username,
    attestationType: 'none',
    excludeCredentials: user.passkeys.map((p) => ({
      id: p.id,
      transports: p.transports as never,
    })),
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred',
    },
  });
  await users().updateOne(
    { _id: user._id },
    { $set: { currentChallenge: options.challenge } },
  );
  return c.json({ ...options, defaultName: clientFingerprint(c) });
});

authRoutes.post('/passkey/register/verify', requireAuth, async (c) => {
  const user = c.get('user');
  const body = await c.req.json().catch(() => ({}));
  const { response, name } = body as { response: unknown; name?: string };
  if (!user.currentChallenge || !response) {
    return c.json({ error: 'invalid_state' }, 400);
  }

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: response as never,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: rpOrigin(c),
      expectedRPID: rpID(c),
      // On ne demande que 'preferred' à la création (authenticatorSelection
      // ci-dessus) : certains gestionnaires (ex. Dashlane) ne posent pas le
      // flag UV même après déverrouillage. Rester cohérent ici.
      requireUserVerification: false,
    });
  } catch (error) {
    console.error('[anvil-server] passkey registration verify failed:', error);
    return c.json({ error: 'invalid_passkey' }, 400);
  }
  await users().updateOne(
    { _id: user._id },
    { $set: { currentChallenge: null } },
  );
  if (!verification.verified || !verification.registrationInfo) {
    return c.json({ error: 'invalid_passkey' }, 400);
  }

  const { credential } = verification.registrationInfo;
  const passkey: PasskeyCredential = {
    id: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64url'),
    counter: credential.counter,
    transports: credential.transports,
    name: (name || 'Passkey').slice(0, 64),
    createdAt: new Date(),
  };
  await users().updateOne(
    { _id: user._id },
    { $push: { passkeys: passkey } },
  );
  return c.json({ ok: true, passkey: publicPasskey(passkey) });
});

authRoutes.delete('/passkey/:id', requireAuth, async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');
  await users().updateOne(
    { _id: user._id },
    { $pull: { passkeys: { id } } },
  );
  return c.json({ ok: true });
});

authRoutes.post('/passkey/login/options', async (c) => {
  const options = await generateAuthenticationOptions({
    rpID: rpID(c),
    userVerification: 'preferred',
  });
  setCookie(c, CHALLENGE_COOKIE, options.challenge, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: 300,
  });
  return c.json(options);
});

authRoutes.post('/passkey/login/verify', async (c) => {
  const challenge = getCookie(c, CHALLENGE_COOKIE);
  deleteCookie(c, CHALLENGE_COOKIE, { path: '/' });
  const body = await c.req.json().catch(() => ({}));
  const response = (body as { response?: unknown }).response;
  if (!challenge || !response) {
    return c.json({ error: 'invalid_state' }, 400);
  }

  const credentialId = (response as { id?: string }).id;
  const user = credentialId
    ? await users().findOne({ 'passkeys.id': credentialId })
    : null;
  const passkey = user?.passkeys.find((p) => p.id === credentialId);
  if (!user || !passkey) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: response as never,
      expectedChallenge: challenge,
      expectedOrigin: rpOrigin(c),
      expectedRPID: rpID(c),
      credential: {
        id: passkey.id,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
        transports: passkey.transports as never,
      },
      requireUserVerification: false,
    });
  } catch (error) {
    console.error('[anvil-server] passkey login verify failed:', error);
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  if (!verification.verified) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  await users().updateOne(
    { _id: user._id, 'passkeys.id': passkey.id },
    {
      $set: {
        'passkeys.$.counter': verification.authenticationInfo.newCounter,
      },
    },
  );

  const token = await createSession(user._id, 'web');
  setCookie(c, COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'Lax',
    path: '/',
    maxAge: WEB_SESSION_TTL_MS / 1000,
  });
  return c.json(publicMe(user));
});
