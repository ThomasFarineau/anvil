// Turning the bundled templates into a project on disk: file copying,
// {{placeholder}} rendering, config.json reading, and package.json generation.

import fs from 'fs';
import path from 'path';

import { TEMPLATES } from './templates';

// Directory that holds the shipped assets (template/, rust/, client/).
// When running the Bun-bundled CLI it lives at dist/../src; when running the
// source directly it is this file's parent (src/).
function resolvePkgDir(): string {
  const fromDist = path.join(__dirname, '..', 'src');
  if (fs.existsSync(path.join(fromDist, 'template'))) return fromDist;
  return path.join(__dirname, '..');
}

export const PKG_DIR = resolvePkgDir();
const pkgJson = require('../../package.json') as {
  version: string;
  name: string;
};
export const VERSION = pkgJson.version;
export const PKG_NAME = pkgJson.name;

// ── File helpers ──────────────────────────────────────────────────────────────

export function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const destName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const s = path.join(src, entry.name);
    const d = path.join(dest, destName);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

export function renderTemplate(
  filePath: string,
  name: string,
  identifier: string,
): string {
  const safeId = name.replace(/-/g, '_');
  const id = identifier || `com.launcher.${safeId}`;
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{safe_id\}\}/g, safeId)
    .replace(/\{\{identifier\}\}/g, id);
}

export function deriveName(dir: string): string {
  return (
    path
      .basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-launcher'
  );
}

// ── config.json reading ───────────────────────────────────────────────────────

export function readConfig(projectDir: string): Record<string, unknown> {
  const configPath = path.join(projectDir, 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function readIdentifier(projectDir: string): string {
  return (readConfig(projectDir).identifier as string) || '';
}

export function readConfigField(projectDir: string, field: string): string {
  return (readConfig(projectDir)[field] as string) || '';
}

export function usesVite(projectDir: string): boolean {
  return ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'].some((f) =>
    fs.existsSync(path.join(projectDir, f)),
  );
}

// ── Scaffold src-anvil/ (the Rust backend) into a project directory ────────────

export function scaffoldTauri(projectDir: string, name: string): void {
  const srcTauri = path.join(projectDir, 'src-anvil');
  const identifier = readIdentifier(projectDir);

  copyDir(path.join(PKG_DIR, 'rust'), srcTauri);
  fs.writeFileSync(
    path.join(srcTauri, 'Cargo.toml'),
    renderTemplate(path.join(PKG_DIR, 'rust', 'Cargo.toml'), name, identifier),
  );

  const conf = JSON.parse(
    renderTemplate(
      path.join(PKG_DIR, 'template', 'tauri.conf.json'),
      name,
      identifier,
    ),
  );
  // Vite-based frontends: dev server + compiled dist instead of raw src/
  if (usesVite(projectDir)) {
    conf.build = {
      beforeDevCommand: 'npm run dev:ui',
      beforeBuildCommand: 'npm run build:ui',
      devUrl: 'http://localhost:5173',
      frontendDist: '../dist',
    };
  }
  fs.writeFileSync(
    path.join(srcTauri, 'tauri.conf.json'),
    JSON.stringify(conf, null, 2) + '\n',
  );

  copyDir(
    path.join(PKG_DIR, 'template', 'capabilities'),
    path.join(srcTauri, 'capabilities'),
  );
  copyDir(
    path.join(PKG_DIR, 'template', 'icons'),
    path.join(srcTauri, 'icons'),
  );

  fs.writeFileSync(path.join(srcTauri, '.lc-version'), VERSION);
}

// ── User-facing files: config.json, src/, package.json ─────────────────────────

export function copyUserFiles(
  projectDir: string,
  templateId = 'vanilla-js',
): void {
  fs.mkdirSync(projectDir, { recursive: true });
  for (const [src, dest] of [
    [
      path.join(PKG_DIR, 'template', 'config.json'),
      path.join(projectDir, 'config.json'),
    ],
    [
      path.join(PKG_DIR, 'template', '_gitignore'),
      path.join(projectDir, '.gitignore'),
    ],
  ]) {
    if (!fs.existsSync(dest)) fs.copyFileSync(src, dest);
  }

  const destDir = path.join(projectDir, 'src');
  if (fs.existsSync(destDir)) return;

  // Frontend template (index.html + framework entry, vite/tsconfig at root)
  copyDir(path.join(PKG_DIR, 'template', 'frontends', templateId), projectDir);

  // Shared files: JS ↔ Rust bridge, default logo, base stylesheet
  for (const f of ['api.js', 'logo.svg', 'style.css']) {
    fs.copyFileSync(
      path.join(PKG_DIR, 'template', 'shared', f),
      path.join(destDir, f),
    );
  }
  // TypeScript templates also get the typings for ./api.js
  if (templateId.endsWith('-ts')) {
    fs.copyFileSync(
      path.join(PKG_DIR, 'client', 'index.d.ts'),
      path.join(destDir, 'api.d.ts'),
    );
  }
}

export function writePackageJson(
  projectDir: string,
  name: string,
  templateId = 'vanilla-js',
): void {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) return;
  const tpl = TEMPLATES[templateId];
  const pkg: Record<string, unknown> = {
    name,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: { dev: 'anvil dev', build: 'anvil build' } as Record<
      string,
      string
    >,
    devDependencies: {
      [PKG_NAME]: `^${VERSION}`,
      ...tpl.devDependencies,
    },
  };
  if (tpl.vite) {
    (pkg.scripts as Record<string, string>)['dev:ui'] = 'vite';
    (pkg.scripts as Record<string, string>)['build:ui'] = 'vite build';
  }
  if (Object.keys(tpl.dependencies).length > 0) {
    pkg.dependencies = tpl.dependencies;
  }
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
