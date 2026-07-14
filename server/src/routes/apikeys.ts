import { Hono } from 'hono';
import { ObjectId } from 'mongodb';

import { newToken, requireAdmin, type AuthEnv } from '../auth';
import { apiKeys, type ApiKeyDoc } from '../db';

function publicKey(k: ApiKeyDoc) {
  return {
    id: k._id.toHexString(),
    name: k.name,
    key: k.key,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt,
  };
}

// Clés d'API launcher : à renseigner dans le champ "anvil-key" du
// config.json d'un launcher. Sans clé valide, l'API launcher et les
// téléchargements de fichiers sont refusés.
export const apiKeyRoutes = new Hono<AuthEnv>();

apiKeyRoutes.use('*', requireAdmin);

apiKeyRoutes.get('/', async (c) => {
  const list = await apiKeys().find().sort({ createdAt: 1 }).toArray();
  return c.json(list.map(publicKey));
});

apiKeyRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const name = String((body as Record<string, unknown>).name ?? '').trim();
  if (!name || name.length > 64) {
    return c.json({ error: 'invalid_key_name' }, 400);
  }
  const doc: ApiKeyDoc = {
    _id: new ObjectId(),
    name,
    key: newToken('anvil_'),
    createdAt: new Date(),
    lastUsedAt: null,
  };
  await apiKeys().insertOne(doc);
  return c.json(publicKey(doc), 201);
});

apiKeyRoutes.delete('/:id', async (c) => {
  if (!ObjectId.isValid(c.req.param('id'))) {
    return c.json({ error: 'not_found' }, 404);
  }
  const result = await apiKeys().deleteOne({
    _id: new ObjectId(c.req.param('id')),
  });
  if (result.deletedCount === 0) return c.json({ error: 'not_found' }, 404);
  return c.json({ ok: true });
});
