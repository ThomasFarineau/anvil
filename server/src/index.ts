import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Hono } from 'hono';

import { bootstrapAdmin, connectDb } from './db';
import { env } from './env';
import { apiKeyRoutes } from './routes/apikeys';
import { authRoutes } from './routes/auth';
import { fileRoutes } from './routes/files';
import { instanceRoutes } from './routes/instances';
import { launcherRoutes } from './routes/launcher';
import { playerRoutes } from './routes/players';
import { userRoutes } from './routes/users';

const UI_DIST = fileURLToPath(new URL('../ui/dist/', import.meta.url));

export type Bindings = { server: Bun.Server<undefined> };
export const app = new Hono<{ Bindings: Bindings }>();

app.route('/api/auth', authRoutes);
app.route('/api/users', userRoutes);
app.route('/api/players', playerRoutes);
app.route('/api/keys', apiKeyRoutes);
app.route('/api/instances', instanceRoutes);
app.route('/api/launcher', launcherRoutes);
app.route('/files', fileRoutes);

app.get('/api/health', (c) => c.json({ ok: true }));

// UI statique (SPA) : fichier si présent, sinon index.html.
app.get('*', async (c) => {
  const path = c.req.path;
  if (path.startsWith('/api/') || path.startsWith('/files/')) {
    return c.json({ error: 'not_found' }, 404);
  }
  const rel = path === '/' ? 'index.html' : path.slice(1);
  if (!rel.includes('..')) {
    const file = Bun.file(join(UI_DIST, rel));
    if (await file.exists()) return new Response(file);
  }
  const index = Bun.file(join(UI_DIST, 'index.html'));
  if (await index.exists()) return new Response(index);
  return c.text('anvil-server: UI not built (run `bun run build:ui`)', 200);
});

async function main() {
  await connectDb();
  await bootstrapAdmin();
  const tls =
    env.tlsCert && env.tlsKey
      ? { cert: Bun.file(env.tlsCert), key: Bun.file(env.tlsKey) }
      : undefined;
  Bun.serve({
    port: env.port,
    tls,
    fetch: (request, server) => app.fetch(request, { server }),
  });
  const scheme = tls ? 'https' : 'http';
  console.log(`[anvil-server] listening on ${scheme}://0.0.0.0:${env.port}`);
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('[anvil-server] fatal:', error);
    process.exit(1);
  });
}
