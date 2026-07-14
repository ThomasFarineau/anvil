import { MongoClient, ObjectId, type Collection, type Db } from 'mongodb';

import { env } from './env';
import { hashPassword } from './password';

/** Compte web : accès à l'interface d'administration. */
export interface UserDoc {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  role: 'admin' | 'user';
  totpSecret: string | null;
  totpEnabled: boolean;
  createdAt: Date;
}

/** Compte joueur : sessions launcher ("anvil-session") uniquement.
 *  Totalement séparé des comptes web. */
export interface PlayerDoc {
  _id: ObjectId;
  username: string;
  passwordHash: string;
  /** UUID Minecraft stable attribué au joueur. */
  uuid: string;
  totpSecret: string | null;
  totpEnabled: boolean;
  createdAt: Date;
}

export interface SessionDoc {
  _id: ObjectId;
  token: string;
  /** users._id pour kind=web, players._id pour kind=launcher. */
  subjectId: ObjectId;
  kind: 'web' | 'launcher';
  createdAt: Date;
  expiresAt: Date;
}

/** Clé d'API distribuée aux launchers (champ "anvil-key" de config.json). */
export interface ApiKeyDoc {
  _id: ObjectId;
  name: string;
  key: string;
  createdAt: Date;
  lastUsedAt: Date | null;
}

export interface ModEntry {
  name: string;
  file_name: string;
  /** null = fichier hébergé par ce serveur (upload), sinon URL externe. */
  url: string | null;
  size: number | null;
}

export interface FileEntry {
  /** Chemin relatif dans le dossier de l'instance (ex: config/mod.toml). */
  path: string;
  size: number;
}

export interface InstanceDoc {
  _id: string;
  name: string;
  /** Une instance désactivée n'est pas servie aux launchers. */
  enabled: boolean;
  mc_version: string;
  loader: '' | 'fabric' | 'forge' | 'neoforge' | 'quilt';
  loader_version: string;
  server_ip: string;
  server_port: number;
  mods: ModEntry[];
  files: FileEntry[];
  updatedAt: Date;
}

let client: MongoClient;
let db: Db;

export function users(): Collection<UserDoc> {
  return db.collection<UserDoc>('users');
}

export function players(): Collection<PlayerDoc> {
  return db.collection<PlayerDoc>('players');
}

export function sessions(): Collection<SessionDoc> {
  return db.collection<SessionDoc>('sessions');
}

export function apiKeys(): Collection<ApiKeyDoc> {
  return db.collection<ApiKeyDoc>('apikeys');
}

export function instances(): Collection<InstanceDoc> {
  return db.collection<InstanceDoc>('instances');
}

export async function connectDb(): Promise<void> {
  client = new MongoClient(env.mongoUrl);
  await client.connect();
  db = client.db();

  await users().createIndex({ username: 1 }, { unique: true });
  await players().createIndex({ username: 1 }, { unique: true });
  await sessions().createIndex({ token: 1 }, { unique: true });
  await sessions().createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await apiKeys().createIndex({ key: 1 }, { unique: true });
}

/** Crée le compte admin initial s'il n'existe aucun administrateur. */
export async function bootstrapAdmin(): Promise<void> {
  const existing = await users().findOne({ role: 'admin' });
  if (existing) return;
  await users().insertOne({
    _id: new ObjectId(),
    username: env.adminUsername,
    passwordHash: await hashPassword(env.adminPassword),
    role: 'admin',
    totpSecret: null,
    totpEnabled: false,
    createdAt: new Date(),
  });
  console.log(
    `[anvil-server] admin account '${env.adminUsername}' created (change the password!)`,
  );
}

export async function closeDb(): Promise<void> {
  await client?.close();
}
