import { Hono } from 'hono';
import { ObjectId } from 'mongodb';

import { deleteSubjectSessions, requireAdmin, type AuthEnv } from '../auth';
import { users, type UserDoc } from '../db';
import { hashPassword } from '../password';

export const USERNAME_RE = /^[a-zA-Z0-9_.-]{2,32}$/;

function publicUser(u: UserDoc) {
  return {
    id: u._id.toHexString(),
    username: u.username,
    role: u.role,
    totpEnabled: u.totpEnabled,
    passkeyCount: u.passkeys.length,
    createdAt: u.createdAt,
  };
}

function parseId(raw: string): ObjectId | null {
  return ObjectId.isValid(raw) ? new ObjectId(raw) : null;
}

// Comptes web (accès à cette interface). Les comptes joueurs du launcher
// sont gérés séparément dans routes/players.ts.
export const userRoutes = new Hono<AuthEnv>();

userRoutes.use('*', requireAdmin);

userRoutes.get('/', async (c) => {
  const list = await users().find().sort({ username: 1 }).toArray();
  return c.json(list.map(publicUser));
});

userRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body as Record<string, string>;
  const role =
    (body as Record<string, string>).role === 'admin' ? 'admin' : 'user';
  if (!username || !USERNAME_RE.test(username)) {
    return c.json({ error: 'invalid_username' }, 400);
  }
  if (!password || password.length < 8) {
    return c.json({ error: 'password_too_short' }, 400);
  }
  if (await users().findOne({ username })) {
    return c.json({ error: 'username_taken' }, 409);
  }
  const doc: UserDoc = {
    _id: new ObjectId(),
    username,
    passwordHash: await hashPassword(password),
    role,
    totpSecret: null,
    totpEnabled: false,
    passkeys: [],
    currentChallenge: null,
    createdAt: new Date(),
  };
  await users().insertOne(doc);
  return c.json(publicUser(doc), 201);
});

userRoutes.patch('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const role = (body as Record<string, string>).role;
  if (role !== 'admin' && role !== 'user') {
    return c.json({ error: 'invalid_role' }, 400);
  }
  const target = await users().findOne({ _id: id });
  if (!target) return c.json({ error: 'not_found' }, 404);
  if (target.role === 'admin' && role === 'user') {
    const admins = await users().countDocuments({ role: 'admin' });
    if (admins <= 1) return c.json({ error: 'last_admin' }, 400);
  }
  await users().updateOne({ _id: id }, { $set: { role } });
  return c.json({ ok: true });
});

userRoutes.post('/:id/password', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const password = (body as Record<string, string>).password ?? '';
  if (password.length < 8) return c.json({ error: 'password_too_short' }, 400);
  const result = await users().updateOne(
    { _id: id },
    { $set: { passwordHash: await hashPassword(password) } },
  );
  if (result.matchedCount === 0) return c.json({ error: 'not_found' }, 404);
  await deleteSubjectSessions(id);
  return c.json({ ok: true });
});

userRoutes.post('/:id/totp/reset', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const result = await users().updateOne(
    { _id: id },
    { $set: { totpSecret: null, totpEnabled: false } },
  );
  if (result.matchedCount === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

// ── Passkeys WebAuthn ────────────────────────────────────────────────────────

userRoutes.post('/:id/passkeys/reset', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const result = await users().updateOne({ _id: id }, { $set: { passkeys: [] } });
  if (result.matchedCount === 0) return c.json({ error: 'not_found' }, 404);
  await deleteSubjectSessions(id);
  return c.json({ ok: true });
});

userRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const me = c.get('user');
  if (me._id.equals(id)) return c.json({ error: 'cannot_delete_self' }, 400);
  const target = await users().findOne({ _id: id });
  if (!target) return c.json({ error: 'not_found' }, 404);
  if (target.role === 'admin') {
    const admins = await users().countDocuments({ role: 'admin' });
    if (admins <= 1) return c.json({ error: 'last_admin' }, 400);
  }
  await users().deleteOne({ _id: id });
  await deleteSubjectSessions(id);
  return c.json({ ok: true });
});
