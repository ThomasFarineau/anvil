import { Hono } from 'hono';

import {
  checkPlayerByAuthKey,
  checkPlayerCredentials,
  createSession,
  deleteSession,
  findLauncherSession,
  requireApiKey,
} from '../auth';
import { instances, type InstanceDoc } from '../db';
import { env } from '../env';

/** Base publique des URLs de fichiers : PUBLIC_URL ou origine de la requête. */
function publicBase(requestUrl: string): string {
  if (env.publicUrl) return env.publicUrl;
  return new URL(requestUrl).origin;
}

function encodePath(relPath: string): string {
  return relPath.split('/').map(encodeURIComponent).join('/');
}

/** Transforme un document instance en config consommable par le launcher. */
export function toLauncherInstance(doc: InstanceDoc, base: string) {
  return {
    id: doc._id,
    name: doc.name,
    mc_version: doc.mc_version,
    loader: doc.loader,
    loader_version: doc.loader_version,
    server_ip: doc.server_ip,
    server_port: doc.server_port,
    mods: doc.mods.map((m) => ({
      name: m.name,
      file_name: m.file_name,
      url:
        m.url ??
        `${base}/files/${doc._id}/mods/${encodeURIComponent(m.file_name)}`,
    })),
    files: doc.files.map((f) => ({
      path: f.path,
      url: `${base}/files/${doc._id}/files/${encodePath(f.path)}`,
    })),
  };
}

// Toute l'API launcher exige une clé d'API ("anvil-key" de config.json).
export const launcherRoutes = new Hono();

launcherRoutes.use('*', requireApiKey);

// Liste des instances actives — consommée par le launcher au démarrage
// (le config.json ne déclare plus les instances, seulement le serveur).
launcherRoutes.get('/instances', async (c) => {
  const list = await instances()
    .find({ enabled: true })
    .sort({ _id: 1 })
    .toArray();
  const base = publicBase(c.req.url);
  return c.json(list.map((doc) => toLauncherInstance(doc, base)));
});

launcherRoutes.get('/instances/:id', async (c) => {
  const doc = await instances().findOne({
    _id: c.req.param('id'),
    enabled: true,
  });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  return c.json(toLauncherInstance(doc, publicBase(c.req.url)));
});

// ── Sessions launcher ("anvil-session") — comptes joueurs ───────────────────

launcherRoutes.post('/session', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { username, password, code, authKey } = body as Record<string, string>;
  if (!authKey && (!username || !password)) {
    return c.json({ error: 'missing_fields' }, 400);
  }

  const result = authKey
    ? await checkPlayerByAuthKey(authKey)
    : await checkPlayerCredentials(username, password, code);
  if (!result.ok) return c.json({ error: result.error }, 401);

  const token = await createSession(result.account._id, 'launcher');
  return c.json({
    username: result.account.username,
    uuid: result.account.uuid,
    access_token: token,
  });
});

launcherRoutes.post('/session/validate', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = (body as Record<string, string>).token ?? '';
  const found = await findLauncherSession(token);
  if (!found) return c.json({ error: 'invalid_token' }, 401);
  return c.json({
    username: found.player.username,
    uuid: found.player.uuid,
  });
});

launcherRoutes.post('/session/logout', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const token = (body as Record<string, string>).token ?? '';
  if (token) await deleteSession(token);
  return c.json({ ok: true });
});
