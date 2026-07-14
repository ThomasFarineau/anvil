import { Hono } from 'hono';
import { ObjectId } from 'mongodb';

import { deleteSubjectSessions, requireAuth, type AuthEnv } from '../auth';
import { players, type PlayerDoc } from '../db';
import { hashPassword } from '../password';
import { newTotpSecret, totpUri, verifyTotp } from '../totp';
import { USERNAME_RE } from './users';

function publicPlayer(p: PlayerDoc) {
  return {
    id: p._id.toHexString(),
    username: p.username,
    uuid: p.uuid,
    totpEnabled: p.totpEnabled,
    createdAt: p.createdAt,
  };
}

function parseId(raw: string): ObjectId | null {
  return ObjectId.isValid(raw) ? new ObjectId(raw) : null;
}

// Comptes joueurs consommés par la session launcher "anvil-session".
// Séparés des comptes web : un joueur ne peut pas se connecter à cette
// interface, un compte web ne peut pas se connecter depuis le launcher.
export const playerRoutes = new Hono<AuthEnv>();

playerRoutes.use('*', requireAuth);

playerRoutes.get('/', async (c) => {
  const list = await players().find().sort({ username: 1 }).toArray();
  return c.json(list.map(publicPlayer));
});

playerRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password } = body as Record<string, string>;
  if (!username || !USERNAME_RE.test(username)) {
    return c.json({ error: 'invalid_username' }, 400);
  }
  if (!password || password.length < 8) {
    return c.json({ error: 'password_too_short' }, 400);
  }
  if (await players().findOne({ username })) {
    return c.json({ error: 'username_taken' }, 409);
  }
  const doc: PlayerDoc = {
    _id: new ObjectId(),
    username,
    passwordHash: await hashPassword(password),
    uuid: crypto.randomUUID(),
    totpSecret: null,
    totpEnabled: false,
    createdAt: new Date(),
  };
  await players().insertOne(doc);
  return c.json(publicPlayer(doc), 201);
});

playerRoutes.post('/:id/password', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const password = (body as Record<string, string>).password ?? '';
  if (password.length < 8) return c.json({ error: 'password_too_short' }, 400);
  const result = await players().updateOne(
    { _id: id },
    { $set: { passwordHash: await hashPassword(password) } },
  );
  if (result.matchedCount === 0) return c.json({ error: 'not_found' }, 404);
  await deleteSubjectSessions(id);
  return c.json({ ok: true });
});

// ── 2FA joueur (enrôlement depuis l'interface, QR à transmettre) ─────────────

playerRoutes.post('/:id/totp/setup', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const player = await players().findOne({ _id: id });
  if (!player) return c.json({ error: 'not_found' }, 404);
  const secret = newTotpSecret();
  await players().updateOne(
    { _id: id },
    { $set: { totpSecret: secret, totpEnabled: false } },
  );
  return c.json({ secret, uri: totpUri(player.username, secret) });
});

playerRoutes.post('/:id/totp/enable', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const player = await players().findOne({ _id: id });
  if (!player) return c.json({ error: 'not_found' }, 404);
  const body = await c.req.json().catch(() => ({}));
  const code = (body as Record<string, string>).code ?? '';
  if (!player.totpSecret || !verifyTotp(player.totpSecret, code)) {
    return c.json({ error: 'invalid_code' }, 400);
  }
  await players().updateOne({ _id: id }, { $set: { totpEnabled: true } });
  return c.json({ ok: true });
});

playerRoutes.post('/:id/totp/reset', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const result = await players().updateOne(
    { _id: id },
    { $set: { totpSecret: null, totpEnabled: false } },
  );
  if (result.matchedCount === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});

playerRoutes.delete('/:id', async (c) => {
  const id = parseId(c.req.param('id'));
  if (!id) return c.json({ error: 'not_found' }, 404);
  const result = await players().deleteOne({ _id: id });
  if (result.deletedCount === 0) return c.json({ error: 'not_found' }, 404);
  await deleteSubjectSessions(id);
  return c.json({ ok: true });
});
