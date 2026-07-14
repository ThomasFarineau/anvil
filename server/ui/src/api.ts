export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}

export interface Me {
  username: string;
  role: 'admin' | 'user';
  totpEnabled: boolean;
}

export interface UserRow {
  id: string;
  username: string;
  role: 'admin' | 'user';
  totpEnabled: boolean;
  createdAt: string;
}

export interface PlayerRow {
  id: string;
  username: string;
  uuid: string;
  totpEnabled: boolean;
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
}

export interface FileEntry {
  path: string;
  size: number;
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

const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Identifiants invalides.',
  totp_required: 'Code 2FA requis.',
  invalid_code: 'Code 2FA invalide.',
  password_too_short: 'Mot de passe trop court (8 caractères minimum).',
  invalid_username:
    "Nom d'utilisateur invalide (2-32 caractères, a-z 0-9 _ . -).",
  username_taken: "Ce nom d'utilisateur existe déjà.",
  last_admin: 'Impossible : dernier compte admin.',
  cannot_delete_self: 'Vous ne pouvez pas supprimer votre propre compte.',
  invalid_id: 'ID invalide (a-z, 0-9, - et _).',
  id_taken: 'Cet ID existe déjà.',
  missing_fields: 'Champs requis manquants.',
  mod_exists: 'Un mod avec ce nom de fichier existe déjà.',
  invalid_path: 'Chemin invalide.',
  invalid_url: 'URL invalide (http/https).',
  invalid_name: 'Nom de fichier invalide.',
  missing_file_or_url: 'Fichier ou URL requis.',
  unauthorized: 'Session expirée, reconnectez-vous.',
  forbidden: 'Réservé aux administrateurs.',
  invalid_key_name: 'Nom de clé invalide (1-64 caractères).',
  not_enabled: "La 2FA n'est pas activée sur ce compte.",
};

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return ERROR_MESSAGES[error.code] ?? `Erreur : ${error.code}`;
  }
  return 'Erreur réseau.';
}

export function formatSize(size: number | null): string {
  if (size === null) return '—';
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}
