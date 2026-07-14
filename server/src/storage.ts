import { mkdir, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

import { env } from './env';

export const INSTANCE_ID_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._ +-]*$/;

/** Valide un nom de fichier simple (pas de séparateur, pas de '..'). */
export function safeFileName(name: string): string | null {
  if (!SEGMENT_RE.test(name) || name.includes('..')) return null;
  return name;
}

/**
 * Valide un chemin relatif (ex: "config/mod.toml") : segments sûrs,
 * pas de remontée, pas de chemin absolu ni de backslash.
 */
export function safeRelPath(path: string): string | null {
  const normalized = path.replaceAll('\\', '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter((s) => s.length > 0);
  if (segments.length === 0 || segments.length > 8) return null;
  for (const segment of segments) {
    if (!SEGMENT_RE.test(segment) || segment.includes('..')) return null;
  }
  return segments.join('/');
}

export function instanceDir(id: string): string {
  return resolve(env.dataDir, 'instances', id);
}

export function modPath(id: string, fileName: string): string {
  return join(instanceDir(id), 'mods', fileName);
}

export function filePath(id: string, relPath: string): string {
  return join(instanceDir(id), 'files', relPath);
}

export async function writeUpload(dest: string, file: File): Promise<number> {
  await mkdir(dirname(dest), { recursive: true });
  await Bun.write(dest, file);
  return file.size;
}

export async function removePath(path: string): Promise<void> {
  await rm(path, { force: true, recursive: true });
}
