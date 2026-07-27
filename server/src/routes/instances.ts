import { Hono } from 'hono';

import { requireAuth, type AuthEnv } from '../auth';
import { instances, type InstanceDoc, type ModEntry } from '../db';
import { env } from '../env';
import {
  applyModpack,
  ModpackError,
  resolveCurseForgePack,
  resolveModrinthPack,
  unlinkModpack,
} from '../modpack';
import {
  filePath,
  INSTANCE_ID_RE,
  instanceDir,
  modPath,
  removePath,
  safeFileName,
  safeRelPath,
  writeUpload,
} from '../storage';

const LOADERS = new Set(['', 'fabric', 'forge', 'neoforge', 'quilt']);

/** Applique les champs modifiables du body sur un document instance. */
function applyFields(
  doc: InstanceDoc,
  body: Record<string, unknown>,
): string | null {
  if (typeof body.name === 'string') doc.name = body.name;
  if (typeof body.enabled === 'boolean') doc.enabled = body.enabled;
  if (typeof body.mc_version === 'string') doc.mc_version = body.mc_version;
  if (typeof body.loader === 'string') {
    if (!LOADERS.has(body.loader)) return 'invalid_loader';
    doc.loader = body.loader as InstanceDoc['loader'];
  }
  if (typeof body.loader_version === 'string') {
    doc.loader_version = body.loader_version;
  }
  if (typeof body.server_ip === 'string') doc.server_ip = body.server_ip;
  if (typeof body.server_port === 'number') {
    if (body.server_port < 1 || body.server_port > 65535) {
      return 'invalid_port';
    }
    doc.server_port = Math.floor(body.server_port);
  }
  if (!doc.name || !doc.mc_version) return 'missing_fields';
  return null;
}

export const instanceRoutes = new Hono<AuthEnv>();

instanceRoutes.use('*', requireAuth);

instanceRoutes.get('/', async (c) => {
  const list = await instances().find().sort({ _id: 1 }).toArray();
  return c.json(list);
});

instanceRoutes.post('/', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!INSTANCE_ID_RE.test(id)) return c.json({ error: 'invalid_id' }, 400);
  if (await instances().findOne({ _id: id })) {
    return c.json({ error: 'id_taken' }, 409);
  }
  const doc: InstanceDoc = {
    _id: id,
    name: '',
    enabled: true,
    mc_version: '',
    loader: '',
    loader_version: '',
    server_ip: '',
    server_port: 25565,
    mods: [],
    files: [],
    modpacks: [],
    updatedAt: new Date(),
  };
  const error = applyFields(doc, body);
  if (error) return c.json({ error }, 400);
  await instances().insertOne(doc);
  return c.json(doc, 201);
});

instanceRoutes.get('/:id', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  return c.json(doc);
});

instanceRoutes.put('/:id', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const error = applyFields(doc, body);
  if (error) return c.json({ error }, 400);
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json(doc);
});

instanceRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await instances().deleteOne({ _id: id });
  if (result.deletedCount === 0) return c.json({ error: 'not_found' }, 404);
  if (INSTANCE_ID_RE.test(id)) await removePath(instanceDir(id));
  return c.json({ ok: true });
});

// ── Mods ─────────────────────────────────────────────────────────────────────

instanceRoutes.post('/:id/mods', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);

  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'invalid_form' }, 400);

  const upload = form.get('file');
  const url = String(form.get('url') ?? '');
  const name = String(form.get('name') ?? '');
  let fileName = String(form.get('file_name') ?? '');

  let entry: ModEntry;
  if (upload instanceof File) {
    fileName ||= upload.name;
    if (!fileName.endsWith('.jar')) fileName += '.jar';
    if (!safeFileName(fileName)) return c.json({ error: 'invalid_name' }, 400);
    if (doc.mods.some((m) => m.file_name === fileName)) {
      return c.json({ error: 'mod_exists' }, 409);
    }
    const size = await writeUpload(modPath(doc._id, fileName), upload);
    entry = {
      name: name || fileName.replace(/\.jar$/, ''),
      file_name: fileName,
      url: null,
      size,
      updatedAt: new Date(),
    };
  } else if (url) {
    if (!/^https?:\/\//.test(url)) return c.json({ error: 'invalid_url' }, 400);
    if (!fileName) {
      const base = url.split(/[?#]/)[0].split('/').pop() ?? 'mod.jar';
      fileName = base.endsWith('.jar') ? base : `${base}.jar`;
    }
    if (!safeFileName(fileName)) return c.json({ error: 'invalid_name' }, 400);
    if (doc.mods.some((m) => m.file_name === fileName)) {
      return c.json({ error: 'mod_exists' }, 409);
    }
    entry = {
      name: name || fileName.replace(/\.jar$/, ''),
      file_name: fileName,
      url,
      size: null,
      updatedAt: new Date(),
    };
  } else {
    return c.json({ error: 'missing_file_or_url' }, 400);
  }

  doc.mods.push(entry);
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json(entry, 201);
});

instanceRoutes.delete('/:id/mods/:fileName', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const fileName = c.req.param('fileName');
  const entry = doc.mods.find((m) => m.file_name === fileName);
  if (!entry) return c.json({ error: 'not_found' }, 404);
  if (entry.url === null && safeFileName(fileName)) {
    await removePath(modPath(doc._id, fileName));
  }
  doc.mods = doc.mods.filter((m) => m.file_name !== fileName);
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json({ ok: true });
});

instanceRoutes.post('/:id/mods/bulk-delete', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const fileNames = Array.isArray(body.file_names)
    ? body.file_names.filter((n): n is string => typeof n === 'string')
    : [];
  const targets = new Set(fileNames);
  const toRemove = doc.mods.filter((m) => targets.has(m.file_name));
  await Promise.all(
    toRemove
      .filter((m) => m.url === null && safeFileName(m.file_name))
      .map((m) => removePath(modPath(doc._id, m.file_name))),
  );
  doc.mods = doc.mods.filter((m) => !targets.has(m.file_name));
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json({ ok: true, removed: toRemove.length });
});

// ── Modpack (Modrinth / CurseForge) ─────────────────────────────────────────

instanceRoutes.post('/:id/modpack/import', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);

  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const platform = body.platform;
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const version = typeof body.version === 'string' ? body.version.trim() : '';
  if (!query || !version) return c.json({ error: 'missing_fields' }, 400);
  if (platform !== 'modrinth' && platform !== 'curseforge') {
    return c.json({ error: 'invalid_platform' }, 400);
  }
  if (platform === 'curseforge' && !env.curseforgeApiKey) {
    return c.json({ error: 'curseforge_not_configured' }, 400);
  }

  try {
    const resolved =
      platform === 'modrinth'
        ? await resolveModrinthPack(query, version)
        : await resolveCurseForgePack(query, version, env.curseforgeApiKey);
    await applyModpack(doc, platform, resolved);
    await instances().replaceOne({ _id: doc._id }, doc);
    return c.json({ instance: doc, warnings: resolved.warnings });
  } catch (error) {
    if (error instanceof ModpackError) {
      return c.json({ error: error.code }, 400);
    }
    throw error;
  }
});

instanceRoutes.delete('/:id/modpack/:key', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const key = c.req.param('key');
  if (!doc.modpacks.some((p) => p.key === key)) {
    return c.json({ error: 'not_found' }, 404);
  }
  unlinkModpack(doc, key);
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json(doc);
});

// ── Fichiers de config custom ────────────────────────────────────────────────

instanceRoutes.post('/:id/files', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);

  const form = await c.req.formData().catch(() => null);
  if (!form) return c.json({ error: 'invalid_form' }, 400);
  const upload = form.get('file');
  if (!(upload instanceof File)) return c.json({ error: 'missing_file' }, 400);

  const rawPath = String(form.get('path') ?? '') || upload.name;
  const relPath = safeRelPath(rawPath);
  if (!relPath) return c.json({ error: 'invalid_path' }, 400);

  const size = await writeUpload(filePath(doc._id, relPath), upload);
  doc.files = doc.files.filter((f) => f.path !== relPath);
  doc.files.push({ path: relPath, size, updatedAt: new Date() });
  doc.files.sort((a, b) => a.path.localeCompare(b.path));
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json({ path: relPath, size }, 201);
});

instanceRoutes.delete('/:id/files', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const relPath = safeRelPath(c.req.query('path') ?? '');
  if (!relPath || !doc.files.some((f) => f.path === relPath)) {
    return c.json({ error: 'not_found' }, 404);
  }
  await removePath(filePath(doc._id, relPath));
  doc.files = doc.files.filter((f) => f.path !== relPath);
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json({ ok: true });
});

instanceRoutes.post('/:id/files/bulk-delete', async (c) => {
  const doc = await instances().findOne({ _id: c.req.param('id') });
  if (!doc) return c.json({ error: 'not_found' }, 404);
  const body = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const paths = Array.isArray(body.paths)
    ? body.paths.filter((p): p is string => typeof p === 'string')
    : [];
  const targets = new Set(paths);
  const toRemove = doc.files.filter((f) => targets.has(f.path));
  await Promise.all(toRemove.map((f) => removePath(filePath(doc._id, f.path))));
  doc.files = doc.files.filter((f) => !targets.has(f.path));
  doc.updatedAt = new Date();
  await instances().replaceOne({ _id: doc._id }, doc);
  return c.json({ ok: true, removed: toRemove.length });
});
