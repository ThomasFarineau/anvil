import { randomBytes } from 'node:crypto';

import type { Context, MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';

import {
  apiKeys,
  players,
  sessions,
  users,
  type PlayerDoc,
  type SessionDoc,
  type UserDoc,
} from './db';
import { verifyPassword } from './password';
import { verifyTotp } from './totp';

export const COOKIE_NAME = 'anvil_sid';
export const WEB_SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
export const LAUNCHER_SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

export type AuthEnv = {
  Variables: { user: UserDoc; session: SessionDoc };
  Bindings: { server: Bun.Server<undefined> };
};

export function newToken(prefix = ''): string {
  return prefix + randomBytes(32).toString('base64url');
}

export async function createSession(
  subjectId: ObjectId,
  kind: SessionDoc['kind'],
): Promise<string> {
  const token = newToken();
  const ttl = kind === 'web' ? WEB_SESSION_TTL_MS : LAUNCHER_SESSION_TTL_MS;
  await sessions().insertOne({
    _id: new ObjectId(),
    token,
    subjectId,
    kind,
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + ttl),
  });
  return token;
}

async function findSession(
  token: string,
  kind: SessionDoc['kind'],
): Promise<SessionDoc | null> {
  if (!token) return null;
  const session = await sessions().findOne({ token, kind });
  if (!session || session.expiresAt.getTime() < Date.now()) return null;
  return session;
}

/** Session web → compte utilisateur (interface d'administration). */
export async function findWebSession(
  token: string,
): Promise<{ session: SessionDoc; user: UserDoc } | null> {
  const session = await findSession(token, 'web');
  if (!session) return null;
  const user = await users().findOne({ _id: session.subjectId });
  if (!user) return null;
  return { session, user };
}

/** Session launcher → compte joueur ("anvil-session"). */
export async function findLauncherSession(
  token: string,
): Promise<{ session: SessionDoc; player: PlayerDoc } | null> {
  const session = await findSession(token, 'launcher');
  if (!session) return null;
  const player = await players().findOne({ _id: session.subjectId });
  if (!player) return null;
  return { session, player };
}

export async function deleteSession(token: string): Promise<void> {
  await sessions().deleteOne({ token });
}

export async function deleteSubjectSessions(
  subjectId: ObjectId,
): Promise<void> {
  await sessions().deleteMany({ subjectId });
}

export type CredentialCheck<T> =
  | { ok: true; account: T }
  | {
      ok: false;
      error: 'invalid_credentials' | 'totp_required' | 'invalid_code';
    };

interface Credentialed {
  passwordHash: string;
  totpSecret: string | null;
  totpEnabled: boolean;
}

async function checkPassword<T extends Credentialed>(
  account: T | null,
  password: string,
  code: string | undefined,
): Promise<CredentialCheck<T>> {
  if (!account || !(await verifyPassword(password, account.passwordHash))) {
    return { ok: false, error: 'invalid_credentials' };
  }
  if (account.totpEnabled && account.totpSecret) {
    if (!code) return { ok: false, error: 'totp_required' };
    if (!verifyTotp(account.totpSecret, code)) {
      return { ok: false, error: 'invalid_code' };
    }
  }
  return { ok: true, account };
}

/** Vérifie les identifiants d'un compte web (interface d'admin). */
export async function checkUserCredentials(
  username: string,
  password: string,
  code: string | undefined,
): Promise<CredentialCheck<UserDoc>> {
  return checkPassword(await users().findOne({ username }), password, code);
}

interface PlayerCredentialed extends Credentialed {
  authMethod: 'password' | 'authkey';
  authKey: string | null;
}

async function checkPlayerAccount<T extends PlayerCredentialed>(
  account: T | null,
  password: string,
  code: string | undefined,
): Promise<CredentialCheck<T>> {
  if (!account || account.authMethod !== 'password') {
    return { ok: false, error: 'invalid_credentials' };
  }
  return checkPassword(account, password, code);
}

/** Vérifie les identifiants d'un compte joueur (launcher). */
export async function checkPlayerCredentials(
  username: string,
  password: string,
  code: string | undefined,
): Promise<CredentialCheck<PlayerDoc>> {
  return checkPlayerAccount(
    await players().findOne({ username }),
    password,
    code,
  );
}

/** Vérifie une clé d'authentification de compte joueur (launcher). */
export async function checkPlayerByAuthKey(
  authKey: string,
): Promise<CredentialCheck<PlayerDoc>> {
  const account = await players().findOne({ authKey });
  if (!account || account.authMethod !== 'authkey' || !account.authKey) {
    return { ok: false, error: 'invalid_credentials' };
  }
  return { ok: true, account };
}

export function newAuthKey(): string {
  return newToken('anvilkey_');
}

export function webToken(c: Context): string {
  return getCookie(c, COOKIE_NAME) ?? '';
}

/** Middleware : exige une session web valide, expose c.get('user'). */
export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const found = await findWebSession(webToken(c));
  if (!found) return c.json({ error: 'unauthorized' }, 401);
  c.set('user', found.user);
  c.set('session', found.session);
  await next();
};

export const requireAdmin: MiddlewareHandler<AuthEnv> = async (c, next) => {
  const found = await findWebSession(webToken(c));
  if (!found) return c.json({ error: 'unauthorized' }, 401);
  if (found.user.role !== 'admin') return c.json({ error: 'forbidden' }, 403);
  c.set('user', found.user);
  c.set('session', found.session);
  await next();
};

/**
 * Middleware : exige une clé d'API launcher valide (header `x-anvil-key`,
 * ou `?key=` en query). Protège l'API launcher et les téléchargements.
 */
export const requireApiKey: MiddlewareHandler = async (c, next) => {
  const key = c.req.header('x-anvil-key') ?? c.req.query('key') ?? '';
  if (!key) return c.json({ error: 'missing_api_key' }, 401);
  const found = await apiKeys().findOne({ key });
  if (!found) return c.json({ error: 'invalid_api_key' }, 401);
  // Trace d'usage, sans bloquer la requête.
  void apiKeys()
    .updateOne({ _id: found._id }, { $set: { lastUsedAt: new Date() } })
    .catch(() => {});
  await next();
};
