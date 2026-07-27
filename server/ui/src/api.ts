import { locale, t } from './i18n';

export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export type AuthMethod = 'password' | 'authkey';

export interface Passkey {
  id: string;
  name: string;
  createdAt: string;
}

export interface Me {
  username: string;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  passkeys: Passkey[];
}

export interface UserRow {
  id: string;
  username: string;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  passkeyCount: number;
  createdAt: string;
}

export interface PlayerRow {
  id: string;
  username: string;
  uuid: string;
  totpEnabled: boolean;
  authMethod: AuthMethod;
  createdAt: string;
}

export interface ApiKeyRow {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface ModEntry {
  name: string;
  file_name: string;
  url: string | null;
  size: number | null;
  source?: string;
  updatedAt?: string;
}

export interface FileEntry {
  path: string;
  size: number;
  source?: string;
  updatedAt?: string;
}

export interface ModpackRef {
  key: string;
  platform: 'modrinth' | 'curseforge';
  id: string;
  url?: string | null;
  version_id: string;
  name: string;
  version_name: string;
  importedAt: string;
  unlinkedAt: string | null;
}

export interface Instance {
  _id: string;
  name: string;
  enabled: boolean;
  mc_version: string;
  loader: string;
  loader_version: string;
  server_ip: string;
  server_port: number;
  mods: ModEntry[];
  files: FileEntry[];
  modpacks: ModpackRef[];
  updatedAt: string;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> =
    options.body instanceof FormData
      ? {}
      : { 'content-type': 'application/json' };
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers,
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      (data as { error?: string }).error ?? res.statusText,
      res.status,
    );
  }
  return data as T;
}

export const post = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) });

export const put = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export const patch = <T>(path: string, body: unknown) =>
  api<T>(path, { method: 'PATCH', body: JSON.stringify(body) });

export const del = <T>(path: string) => api<T>(path, { method: 'DELETE' });

export const upload = <T>(path: string, form: FormData) =>
  api<T>(path, { method: 'POST', body: form });

const ERROR_KEYS = new Set([
  'invalid_credentials',
  'totp_required',
  'invalid_code',
  'password_too_short',
  'invalid_username',
  'username_taken',
  'last_admin',
  'cannot_delete_self',
  'invalid_id',
  'id_taken',
  'missing_fields',
  'mod_exists',
  'invalid_path',
  'invalid_url',
  'invalid_name',
  'missing_file_or_url',
  'unauthorized',
  'forbidden',
  'invalid_key_name',
  'not_enabled',
  'invalid_state',
  'invalid_passkey',
  'invalid_platform',
  'curseforge_not_configured',
  'modpack_not_found',
  'modpack_version_not_found',
  'modpack_file_missing',
  'modpack_download_failed',
  'modpack_invalid_archive',
  'modpack_distribution_blocked',
]);

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_KEYS.has(error.code)
      ? t(`error.${error.code}` as 'error.invalid_credentials')
      : t('error.generic', { code: error.code });
  }
  if (error instanceof DOMException) {
    return t('error.generic', { code: `${error.name}: ${error.message}` });
  }
  if (error instanceof Error && !(error instanceof TypeError)) {
    return t('error.generic', { code: error.message });
  }
  return t('error.network');
}

export function formatSize(size: number | null): string {
  if (size === null) return '—';
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatDate(date: string | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString(locale() === 'fr' ? 'fr-FR' : 'en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
