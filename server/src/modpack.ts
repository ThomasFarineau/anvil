import JSZip from 'jszip';

import type { FileEntry, InstanceDoc, ModEntry, ModpackRef } from './db';
import {
  filePath,
  modPath,
  removePath,
  safeRelPath,
  writeBuffer,
} from './storage';

export class ModpackError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

const KNOWN_LOADERS = new Set(['fabric', 'forge', 'neoforge', 'quilt']);
const DOWNLOAD_CONCURRENCY = 6;

function normalizeLoader(name: string): InstanceDoc['loader'] {
  const n = name.trim().toLowerCase();
  return (KNOWN_LOADERS.has(n) ? n : '') as InstanceDoc['loader'];
}

/** Exécute `fn` sur chaque item avec au plus `limit` appels en vol. */
async function pMap<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = Array.from({ length: items.length });
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
}

/** Extrait le slug/ID d'une URL de modpack Modrinth ou CurseForge, sinon
 *  renvoie la saisie telle quelle (déjà un slug/ID). */
function extractQuery(raw: string): string {
  const trimmed = raw.trim();
  if (!/^https?:\/\//.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.at(-1) ?? trimmed;
  } catch {
    return trimmed;
  }
}

export interface ResolvedModFile {
  name: string;
  file_name: string;
  data: Uint8Array;
}

export interface ResolvedModpack {
  mc_version: string;
  loader: InstanceDoc['loader'];
  loader_version: string;
  mods: ResolvedModFile[];
  overrides: { path: string; data: Uint8Array }[];
  packId: string;
  versionId: string;
  packName: string;
  versionName: string;
  /** Page publique du modpack (Modrinth/CurseForge), pour un lien "ouvrir". */
  packUrl: string | null;
  warnings: string[];
}

/** Extrait les fichiers sous un préfixe donné (ex: "overrides/") d'une
 *  archive de modpack et les valide via safeRelPath. */
async function extractOverrides(
  zip: JSZip,
  prefixes: string[],
): Promise<{
  overrides: { path: string; data: Uint8Array }[];
  warnings: string[];
}> {
  const warnings: string[] = [];
  const seen = new Set<string>();
  const matched: { rel: string; entry: JSZip.JSZipObject }[] = [];
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const prefix = prefixes.find((p) => name.startsWith(p));
    if (!prefix) continue;
    const rel = safeRelPath(name.slice(prefix.length));
    if (!rel) {
      warnings.push(`override_skipped:${name}`);
      continue;
    }
    if (seen.has(rel)) continue;
    seen.add(rel);
    matched.push({ rel, entry });
  }
  const overrides = await Promise.all(
    matched.map(async ({ rel, entry }) => ({
      path: rel,
      data: await entry.async('uint8array'),
    })),
  );
  return { overrides, warnings };
}

async function downloadBytes(url: string): Promise<Uint8Array | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

// ── Modrinth ─────────────────────────────────────────────────────────────────

const MODRINTH_API = 'https://api.modrinth.com/v2';
const MODRINTH_HEADERS = {
  'user-agent': 'anvil-server/0.0.1 (modpack import)',
};

export async function resolveModrinthPack(
  rawQuery: string,
  versionQuery: string,
): Promise<ResolvedModpack> {
  const query = extractQuery(rawQuery);

  const projectRes = await fetch(
    `${MODRINTH_API}/project/${encodeURIComponent(query)}`,
    { headers: MODRINTH_HEADERS },
  );
  if (!projectRes.ok) throw new ModpackError('modpack_not_found');
  const project = (await projectRes.json()) as {
    id: string;
    slug: string;
    title: string;
  };

  const versionsRes = await fetch(
    `${MODRINTH_API}/project/${encodeURIComponent(query)}/version`,
    { headers: MODRINTH_HEADERS },
  );
  if (!versionsRes.ok) throw new ModpackError('modpack_not_found');
  const versions = (await versionsRes.json()) as Array<{
    id: string;
    version_number: string;
    name: string;
    files: Array<{
      url: string;
      filename: string;
      primary: boolean;
      size: number;
    }>;
  }>;

  const q = versionQuery.trim().toLowerCase();
  const version = versions.find(
    (v) =>
      v.id === versionQuery ||
      v.version_number.toLowerCase() === q ||
      v.name.toLowerCase() === q,
  );
  if (!version) throw new ModpackError('modpack_version_not_found');

  const file = version.files.find((f) => f.primary) ?? version.files[0];
  if (!file) throw new ModpackError('modpack_file_missing');

  const packRes = await fetch(file.url);
  if (!packRes.ok) throw new ModpackError('modpack_download_failed');
  const zip = await JSZip.loadAsync(await packRes.arrayBuffer());

  const indexEntry = zip.file('modrinth.index.json');
  if (!indexEntry) throw new ModpackError('modpack_invalid_archive');
  const index = JSON.parse(await indexEntry.async('string')) as {
    dependencies: Record<string, string>;
    files: Array<{
      path: string;
      downloads: string[];
      fileSize: number;
      env?: { client?: string };
    }>;
  };

  const LOADER_KEYS: Record<string, InstanceDoc['loader']> = {
    forge: 'forge',
    'fabric-loader': 'fabric',
    'quilt-loader': 'quilt',
    neoforge: 'neoforge',
  };
  let loader: InstanceDoc['loader'] = '';
  let loader_version = '';
  for (const [key, value] of Object.entries(index.dependencies ?? {})) {
    if (key in LOADER_KEYS) {
      loader = LOADER_KEYS[key];
      loader_version = value;
    }
  }
  const mc_version = index.dependencies?.minecraft ?? '';

  const warnings: string[] = [];
  const candidates = (index.files ?? []).filter(
    (f) => f.env?.client !== 'unsupported' && f.downloads?.[0],
  );
  const downloaded = await pMap(candidates, DOWNLOAD_CONCURRENCY, async (f) => {
    const data = await downloadBytes(f.downloads[0]);
    return { f, data };
  });
  const mods: ResolvedModFile[] = [];
  for (const { f, data } of downloaded) {
    const fileName = f.path.split('/').pop() ?? 'mod.jar';
    if (!data) {
      warnings.push(`mod_download_failed:${fileName}`);
      continue;
    }
    mods.push({
      name: fileName.replace(/\.jar$/, ''),
      file_name: fileName,
      data,
    });
  }

  const { overrides, warnings: overrideWarnings } = await extractOverrides(
    zip,
    ['overrides/', 'client-overrides/'],
  );

  return {
    mc_version,
    loader,
    loader_version,
    mods,
    overrides,
    packId: project.id,
    packUrl: `https://modrinth.com/modpack/${project.slug}`,
    versionId: version.id,
    packName: project.title,
    versionName: version.name || version.version_number,
    warnings: [...warnings, ...overrideWarnings],
  };
}

// ── CurseForge ───────────────────────────────────────────────────────────────

const CURSEFORGE_API = 'https://api.curseforge.com/v1';
const CURSEFORGE_MINECRAFT_GAME_ID = 432;
const CURSEFORGE_MODPACK_CLASS_ID = 4471;

interface CurseForgeFileRecord {
  id: number;
  modId: number;
  fileName: string;
  displayName: string;
  downloadUrl: string | null;
  fileLength: number;
}

async function curseforgeGet(path: string, apiKey: string): Promise<unknown> {
  const res = await fetch(`${CURSEFORGE_API}${path}`, {
    headers: { 'x-api-key': apiKey, accept: 'application/json' },
  });
  if (!res.ok) throw new ModpackError('modpack_not_found');
  return (await res.json()) as { data: unknown };
}

export async function resolveCurseForgePack(
  rawQuery: string,
  versionQuery: string,
  apiKey: string,
): Promise<ResolvedModpack> {
  const query = extractQuery(rawQuery);

  let modId: number;
  if (/^\d+$/.test(query)) {
    modId = Number(query);
  } else {
    const search = (await curseforgeGet(
      `/mods/search?gameId=${CURSEFORGE_MINECRAFT_GAME_ID}&classId=${CURSEFORGE_MODPACK_CLASS_ID}&slug=${encodeURIComponent(query)}`,
      apiKey,
    )) as { data: Array<{ id: number; name: string; slug: string }> };
    const match = search.data[0];
    if (!match) throw new ModpackError('modpack_not_found');
    modId = match.id;
  }

  const modRes = (await curseforgeGet(`/mods/${modId}`, apiKey)) as {
    data: { name: string; links?: { websiteUrl?: string } };
  };

  const filesRes = (await curseforgeGet(`/mods/${modId}/files`, apiKey)) as {
    data: Array<{ id: number; displayName: string; fileName: string }>;
  };
  const q = versionQuery.trim().toLowerCase();
  const fileRef = filesRes.data.find(
    (f) =>
      String(f.id) === versionQuery ||
      f.displayName.toLowerCase() === q ||
      f.fileName.toLowerCase() === q,
  );
  if (!fileRef) throw new ModpackError('modpack_version_not_found');

  const fileDetail = (await curseforgeGet(
    `/mods/${modId}/files/${fileRef.id}`,
    apiKey,
  )) as { data: CurseForgeFileRecord };
  if (!fileDetail.data.downloadUrl) {
    throw new ModpackError('modpack_distribution_blocked');
  }

  const packRes = await fetch(fileDetail.data.downloadUrl);
  if (!packRes.ok) throw new ModpackError('modpack_download_failed');
  const zip = await JSZip.loadAsync(await packRes.arrayBuffer());

  const manifestEntry = zip.file('manifest.json');
  if (!manifestEntry) throw new ModpackError('modpack_invalid_archive');
  const manifest = JSON.parse(await manifestEntry.async('string')) as {
    minecraft: {
      version: string;
      modLoaders: Array<{ id: string; primary: boolean }>;
    };
    name: string;
    version: string;
    files: Array<{ projectID: number; fileID: number; required: boolean }>;
    overrides: string;
  };

  const primaryLoader =
    manifest.minecraft.modLoaders.find((l) => l.primary) ??
    manifest.minecraft.modLoaders[0];
  let loader: InstanceDoc['loader'] = '';
  let loader_version = '';
  if (primaryLoader) {
    const idx = primaryLoader.id.indexOf('-');
    loader = normalizeLoader(
      idx === -1 ? primaryLoader.id : primaryLoader.id.slice(0, idx),
    );
    loader_version = idx === -1 ? '' : primaryLoader.id.slice(idx + 1);
  }

  const warnings: string[] = [];
  const mods: ResolvedModFile[] = [];
  const fileIds = manifest.files.map((f) => f.fileID);
  if (fileIds.length > 0) {
    const bulkRes = await fetch(`${CURSEFORGE_API}/mods/files`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({ fileIds }),
    });
    if (!bulkRes.ok) throw new ModpackError('modpack_not_found');
    const bulk = (await bulkRes.json()) as { data: CurseForgeFileRecord[] };
    const byId = new Map(bulk.data.map((f) => [f.id, f]));
    const records = manifest.files
      .map((ref) => byId.get(ref.fileID))
      .filter((r): r is CurseForgeFileRecord => Boolean(r));
    for (const ref of manifest.files) {
      if (!byId.get(ref.fileID)) {
        warnings.push(`blocked_mod:${ref.fileID}`);
      }
    }
    const downloaded = await pMap(
      records.filter((r) => r.downloadUrl),
      DOWNLOAD_CONCURRENCY,
      async (r) => ({ r, data: await downloadBytes(r.downloadUrl as string) }),
    );
    for (const r of records) {
      if (!r.downloadUrl) {
        warnings.push(`blocked_mod:${r.fileName}`);
      }
    }
    for (const { r, data } of downloaded) {
      if (!data) {
        warnings.push(`mod_download_failed:${r.fileName}`);
        continue;
      }
      mods.push({ name: r.displayName, file_name: r.fileName, data });
    }
  }

  const overridePrefix = manifest.overrides
    ? `${manifest.overrides.replace(/\/+$/, '')}/`
    : 'overrides/';
  const { overrides, warnings: overrideWarnings } = await extractOverrides(
    zip,
    [overridePrefix],
  );

  return {
    mc_version: manifest.minecraft.version,
    loader,
    loader_version,
    mods,
    overrides,
    packId: String(modId),
    packUrl: modRes.data.links?.websiteUrl ?? null,
    versionId: String(fileRef.id),
    packName: modRes.data.name,
    versionName: manifest.version || fileRef.displayName,
    warnings: [...warnings, ...overrideWarnings],
  };
}

// ── Application au document d'instance ──────────────────────────────────────

export function modpackKey(
  platform: ModpackRef['platform'],
  id: string,
): string {
  return `${platform}:${id}`;
}

/** Choisit un nom de fichier qui n'entre pas en collision avec un mod géré
 *  par un AUTRE modpack ou ajouté manuellement (les mods du même pack, eux,
 *  seront remplacés). */
function dedupeFileName(
  wanted: string,
  taken: Set<string>,
  packKey: string,
): string {
  if (!taken.has(wanted)) return wanted;
  const dot = wanted.lastIndexOf('.');
  const stem = dot === -1 ? wanted : wanted.slice(0, dot);
  const ext = dot === -1 ? '' : wanted.slice(dot);
  const suffix = packKey.replace(/[^a-z0-9]+/gi, '-');
  let candidate = `${stem}__${suffix}${ext}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${stem}__${suffix}-${n}${ext}`;
    n += 1;
  }
  return candidate;
}

/** Applique une résolution de modpack sur une instance : fusionne les mods
 *  et fichiers de CE modpack (identifié par `platform:packId`) avec tout ce
 *  qui est déjà présent (autres modpacks fusionnés, ajouts manuels — tous
 *  préservés), télécharge les jars et les overrides en local, et met à jour
 *  la référence dans `doc.modpacks`. */
export async function applyModpack(
  doc: InstanceDoc,
  platform: ModpackRef['platform'],
  resolved: ResolvedModpack,
): Promise<void> {
  const key = modpackKey(platform, resolved.packId);

  const untouchedMods = doc.mods.filter((m) => m.source !== key);
  const untouchedFiles = doc.files.filter((f) => f.source !== key);
  const oldMods = doc.mods.filter((m) => m.source === key);
  const oldFiles = doc.files.filter((f) => f.source === key);

  const nextOverridePaths = new Set(resolved.overrides.map((o) => o.path));
  await Promise.all(
    oldFiles
      .filter((f) => !nextOverridePaths.has(f.path))
      .map((f) => removePath(filePath(doc._id, f.path))),
  );
  const writtenFiles: FileEntry[] = await Promise.all(
    resolved.overrides.map(async (o) => ({
      path: o.path,
      size: await writeBuffer(filePath(doc._id, o.path), o.data),
      source: key,
      updatedAt: new Date(),
    })),
  );

  const nextModFileNames = new Set(resolved.mods.map((m) => m.file_name));
  await Promise.all(
    oldMods
      .filter((m) => m.url === null && !nextModFileNames.has(m.file_name))
      .map((m) => removePath(modPath(doc._id, m.file_name))),
  );

  const otherTakenNames = new Set(untouchedMods.map((m) => m.file_name));
  const namedMods = resolved.mods.map((m) => {
    const fileName = dedupeFileName(m.file_name, otherTakenNames, key);
    otherTakenNames.add(fileName);
    return { ...m, fileName };
  });
  const writtenMods: ModEntry[] = await Promise.all(
    namedMods.map(async (m) => ({
      name: m.name,
      file_name: m.fileName,
      url: null,
      size: await writeBuffer(modPath(doc._id, m.fileName), m.data),
      source: key,
      updatedAt: new Date(),
    })),
  );

  if (resolved.mc_version) doc.mc_version = resolved.mc_version;
  if (resolved.loader) {
    doc.loader = resolved.loader;
    doc.loader_version = resolved.loader_version;
  }
  doc.mods = [...untouchedMods, ...writtenMods];
  doc.files = [...untouchedFiles, ...writtenFiles];

  const ref: ModpackRef = {
    key,
    platform,
    id: resolved.packId,
    url: resolved.packUrl,
    version_id: resolved.versionId,
    name: resolved.packName,
    version_name: resolved.versionName,
    importedAt: new Date(),
    unlinkedAt: null,
  };
  // L'historique de chaque modpack utilisé est conservé (jamais supprimé de
  // doc.modpacks) — importer/resync remplace juste l'entrée par la version
  // la plus récente et la réactive (unlinkedAt: null).
  doc.modpacks = [...doc.modpacks.filter((p) => p.key !== key), ref];
  doc.updatedAt = new Date();
}

/** Détache un modpack : ses mods/fichiers restent sur l'instance mais
 *  perdent leur `source`, donc ne seront plus jamais touchés par un resync.
 *  L'entrée reste dans `doc.modpacks` comme historique, juste marquée
 *  inactive — un nouvel import du même modpack la réactive. */
export function unlinkModpack(doc: InstanceDoc, key: string): void {
  doc.modpacks = doc.modpacks.map((p) =>
    p.key === key ? { ...p, unlinkedAt: new Date() } : p,
  );
  doc.mods = doc.mods.map((m) =>
    m.source === key ? { ...m, source: undefined } : m,
  );
  doc.files = doc.files.map((f) =>
    f.source === key ? { ...f, source: undefined } : f,
  );
  doc.updatedAt = new Date();
}
