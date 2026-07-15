import { createHash } from 'node:crypto';

import type { Context } from 'hono';

import type { AuthEnv } from './auth';
import { env } from './env';

/** Nom affiché par les navigateurs/gestionnaires lors de l'enregistrement. */
export const RP_NAME = 'Anvil Server';

/** Domaine (sans schéma ni port) utilisé comme Relying Party ID WebAuthn. */
export function rpID(c: Context): string {
  if (env.publicUrl) return new URL(env.publicUrl).hostname;
  return (c.req.header('host') ?? 'localhost').split(':')[0];
}

/** Nom par défaut d'une passkey : hash de l'IP du client (IPv6/IPv4) +
 *  user-agent, pour identifier l'appareil sans exposer ces infos en clair. */
export function clientFingerprint(c: Context<AuthEnv>): string {
  const forwarded = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  const ip =
    forwarded ?? c.env?.server?.requestIP(c.req.raw)?.address ?? 'unknown';
  const ua = c.req.header('user-agent') ?? '';
  const hash = createHash('sha256')
    .update(`${ip}|${ua}`)
    .digest('hex')
    .slice(0, 12);
  return `client-${hash}`;
}

/** Origine complète attendue dans les réponses WebAuthn du navigateur. */
export function rpOrigin(c: Context): string {
  if (env.publicUrl) return env.publicUrl;
  // Derrière un reverse proxy, le schéma vu par Bun est toujours http : on
  // fait confiance à x-forwarded-proto. En direct (ex : TLS servi par Bun
  // lui-même), on lit le schéma réel de la requête plutôt que de supposer
  // http, sinon la vérification WebAuthn échoue (mismatch d'origine).
  const proto =
    c.req.header('x-forwarded-proto') ??
    new URL(c.req.url).protocol.replace(':', '');
  return `${proto}://${c.req.header('host') ?? 'localhost'}`;
}
