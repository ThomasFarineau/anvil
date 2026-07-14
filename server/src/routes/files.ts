import { Hono } from 'hono';

import { requireApiKey } from '../auth';
import { instances } from '../db';
import { filePath, modPath, safeFileName, safeRelPath } from '../storage';

async function serve(path: string, downloadName: string): Promise<Response> {
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  return new Response(file, {
    headers: {
      'content-type': 'application/octet-stream',
      'content-disposition': `attachment; filename="${downloadName}"`,
    },
  });
}

// Téléchargements consommés par les launchers pendant le setup.
// Protégés par la clé d'API, comme le reste de l'API launcher.
export const fileRoutes = new Hono();

fileRoutes.use('*', requireApiKey);

fileRoutes.get('/:id/mods/:fileName', async (c) => {
  const id = c.req.param('id');
  const fileName = safeFileName(c.req.param('fileName'));
  if (!fileName) return c.json({ error: 'not_found' }, 404);
  const doc = await instances().findOne({ _id: id, enabled: true });
  if (
    !doc ||
    !doc.mods.some((m) => m.url === null && m.file_name === fileName)
  ) {
    return c.json({ error: 'not_found' }, 404);
  }
  return serve(modPath(id, fileName), fileName);
});

fileRoutes.get('/:id/files/:path{.+}', async (c) => {
  const id = c.req.param('id');
  const relPath = safeRelPath(c.req.param('path'));
  if (!relPath) return c.json({ error: 'not_found' }, 404);
  const doc = await instances().findOne({ _id: id, enabled: true });
  if (!doc || !doc.files.some((f) => f.path === relPath)) {
    return c.json({ error: 'not_found' }, 404);
  }
  return serve(filePath(id, relPath), relPath.split('/').pop() ?? 'file');
});
