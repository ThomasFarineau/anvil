import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';

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
import { users } from '../db';
import { hashPassword, verifyPassword } from '../password';
import { newTotpSecret, totpUri, verifyTotp } from '../totp';

export const authRoutes = new Hono<AuthEnv>();

authRoutes.post('/login', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password, code } = body as Record<string, string>;
  if (!username || !password) return c.json({ error: 'missing_fields' }, 400);

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
  return c.json({
    username: result.account.username,
    role: result.account.role,
    totpEnabled: result.account.totpEnabled,
  });
});

authRoutes.post('/logout', async (c) => {
  await deleteSession(webToken(c));
  deleteCookie(c, COOKIE_NAME, { path: '/' });
  return c.json({ ok: true });
});

authRoutes.get('/me', requireAuth, (c) => {
  const user = c.get('user');
  return c.json({
    username: user.username,
    role: user.role,
    totpEnabled: user.totpEnabled,
  });
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
