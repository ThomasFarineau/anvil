#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// __dirname = src/ → rust/, template/, client/ are siblings
const PKG_DIR = __dirname;
const { version: VERSION, name: PKG_NAME } = require('../package.json');

// ── Helpers ───────────────────────────────────────────────────────────────────

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const destName = entry.name === '_gitignore' ? '.gitignore' : entry.name;
    const s = path.join(src, entry.name);
    const d = path.join(dest, destName);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function renderTemplate(filePath, name, identifier) {
  const safeId = name.replace(/-/g, '_');
  const id = identifier || `com.launcher.${safeId}`;
  return fs
    .readFileSync(filePath, 'utf8')
    .replace(/\{\{name\}\}/g, name)
    .replace(/\{\{safe_id\}\}/g, safeId)
    .replace(/\{\{identifier\}\}/g, id);
}

function deriveName(dir) {
  return (
    path
      .basename(dir)
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '') || 'my-launcher'
  );
}

// ── Scaffold src-anvil/ into a project directory ──────────────────────────────

function readConfig(projectDir) {
  const configPath = path.join(projectDir, 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return {};
  }
}

function readIdentifier(projectDir) {
  return readConfig(projectDir).identifier || '';
}

function readConfigField(projectDir, field) {
  return readConfig(projectDir)[field] || '';
}

function scaffoldTauri(projectDir, name) {
  const srcTauri = path.join(projectDir, 'src-anvil');
  const identifier = readIdentifier(projectDir);

  copyDir(path.join(PKG_DIR, 'rust'), srcTauri);
  fs.writeFileSync(
    path.join(srcTauri, 'Cargo.toml'),
    renderTemplate(path.join(PKG_DIR, 'rust', 'Cargo.toml'), name, identifier),
  );
  fs.writeFileSync(
    path.join(srcTauri, 'tauri.conf.json'),
    renderTemplate(
      path.join(PKG_DIR, 'template', 'tauri.conf.json'),
      name,
      identifier,
    ),
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

function generateIcons(projectDir) {
  const configPath = path.join(projectDir, 'config.json');
  if (!fs.existsSync(configPath)) return;

  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return;
  }

  if (!config.logo) return;

  const logoPath = path.join(projectDir, 'src', config.logo);
  if (!fs.existsSync(logoPath)) {
    console.warn(
      `  Warning: logo not found at src/${config.logo}, skipping icon generation.`,
    );
    return;
  }

  const isSvg = config.logo.toLowerCase().endsWith('.svg');
  const isPng = config.logo.toLowerCase().endsWith('.png');

  if (!isSvg && !isPng) {
    console.warn(
      `  Warning: icon generation requires a .png or .svg logo (got ${config.logo}), skipping.`,
    );
    return;
  }

  const bin = findBin('tauri', projectDir);
  if (!bin) return;

  let iconSrc = logoPath;
  let tmpPng = null;

  if (isSvg) {
    tmpPng = logoPath.replace(/\.svg$/i, '.tmp.png');
    console.log(`  Converting src/${config.logo} to PNG via sharp...`);
    const sharpBin = require.resolve('sharp');
    const script = [
      `const sharp = require(${JSON.stringify(sharpBin)});`,
      `sharp(${JSON.stringify(logoPath)}, { density: 300 })`,
      `  .resize(1024, 1024).png()`,
      `  .toFile(${JSON.stringify(tmpPng)})`,
      `  .then(() => process.exit(0))`,
      `  .catch(e => { process.stderr.write(String(e) + '\\n'); process.exit(1); });`,
    ].join('\n');
    const r = spawnSync(process.execPath, ['-e', script], { stdio: 'inherit' });
    if (r.status !== 0) {
      console.warn(
        '  Warning: SVG→PNG conversion failed, skipping icon generation.',
      );
      return;
    }
    iconSrc = tmpPng;
  }

  console.log(`  Generating app icons...`);
  spawnSync(bin, ['icon', path.resolve(iconSrc)], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: path.join(projectDir, 'src-anvil'),
  });

  if (tmpPng) {
    try {
      fs.unlinkSync(tmpPng);
    } catch {}
  }
}

// ── create ────────────────────────────────────────────────────────────────────

function create(target) {
  const projectDir = path.resolve(target);
  const name = deriveName(projectDir);

  if (fs.existsSync(projectDir)) {
    const entries = fs.readdirSync(projectDir).filter((e) => e !== '.git');
    if (entries.length > 0) {
      process.stderr.write(
        `\nError: '${target}' already exists and is not empty.\n\n`,
      );
      process.exit(1);
    }
  }

  console.log(`\nCreating ${PKG_NAME} project: ${name}\n`);
  scaffoldTauri(projectDir, name);
  copyUserFiles(projectDir, false);
  writePackageJson(projectDir, name);
  generateIcons(projectDir);

  const cdLine = target !== '.' ? `  cd ${target}\n` : '';
  console.log(
    `Done!\n\n${cdLine}  npm install\n  # Edit config.json and src/index.html\n  npm run dev\n`,
  );
}

// ── init ──────────────────────────────────────────────────────────────────────

function init() {
  const projectDir = process.cwd();
  const name = deriveName(projectDir);

  console.log(`\nInitializing ${PKG_NAME} in: ${projectDir}\n`);
  scaffoldTauri(projectDir, name);
  copyUserFiles(projectDir, false);
  generateIcons(projectDir);

  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.scripts = { dev: 'anvil dev', build: 'anvil build', ...pkg.scripts };
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    console.log('Updated package.json');
  } else {
    writePackageJson(projectDir, name);
  }

  console.log(`\nDone!\n\n  npm install\n  npm run dev\n`);
}

// ── update ────────────────────────────────────────────────────────────────────

function update() {
  const projectDir = process.cwd();
  const srcTauri = path.join(projectDir, 'src-anvil');

  if (!fs.existsSync(srcTauri)) {
    process.stderr.write(
      `\nNo src-anvil/ found. Run this from the root of a ${PKG_NAME} project.\n\n`,
    );
    process.exit(1);
  }

  fs.copyFileSync(
    path.join(PKG_DIR, 'rust', 'src', 'lib.rs'),
    path.join(srcTauri, 'src', 'lib.rs'),
  );

  const apiDest = path.join(projectDir, 'src', 'api.js');
  if (fs.existsSync(path.dirname(apiDest))) {
    fs.copyFileSync(path.join(PKG_DIR, 'template', 'src', 'api.js'), apiDest);
  }

  fs.writeFileSync(path.join(srcTauri, '.lc-version'), VERSION);
  console.log(`\nUpdated to ${PKG_NAME}@${VERSION}\n`);
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function copyUserFiles(projectDir, overwrite) {
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
    if (overwrite || !fs.existsSync(dest)) fs.copyFileSync(src, dest);
  }
  const destDir = path.join(projectDir, 'src');
  if (overwrite || !fs.existsSync(destDir)) {
    copyDir(path.join(PKG_DIR, 'template', 'src'), destDir);
  }
}

function writePackageJson(projectDir, name) {
  const pkgPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgPath)) return;
  fs.writeFileSync(
    pkgPath,
    JSON.stringify(
      {
        name,
        version: '1.0.0',
        private: true,
        scripts: { dev: 'anvil dev', build: 'anvil build' },
        devDependencies: { '@tauri-apps/cli': '^2' },
      },
      null,
      2,
    ) + '\n',
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function findBin(name, projectDir) {
  const candidates = [
    path.join(projectDir, 'node_modules', '.bin', name),
    path.join(PKG_DIR, '..', 'node_modules', '.bin', name),
  ];
  for (const bin of candidates) {
    if (fs.existsSync(bin) || fs.existsSync(bin + '.exe')) return bin;
  }
  return null;
}

// ── Tauri proxy ───────────────────────────────────────────────────────────────

function runTauri(tauriCmd) {
  const projectDir = process.cwd();
  const srcTauri = path.join(projectDir, 'src-anvil');

  if (!fs.existsSync(srcTauri)) {
    console.log(`\nNo src-anvil/ found — running anvil init first...\n`);
    init();
  }

  const bin = findBin('tauri', projectDir);
  if (!bin) {
    process.stderr.write(
      `\n@tauri-apps/cli not found. Try reinstalling ${PKG_NAME}.\n\n`,
    );
    process.exit(1);
  }

  const env = { ...process.env };
  const targetDir = readConfigField(projectDir, 'target');
  if (targetDir) env.CARGO_TARGET_DIR = path.resolve(projectDir, targetDir);

  const result = spawnSync(bin, [tauriCmd], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd: path.join(projectDir, 'src-anvil'),
    env,
  });

  process.exit(result.status ?? 1);
}

// ── CLI dispatch ──────────────────────────────────────────────────────────────

const [, , cmd, arg] = process.argv;

if (cmd === 'init') {
  init();
} else if (cmd === 'dev') {
  runTauri('dev');
} else if (cmd === 'build') {
  runTauri('build');
} else if (cmd === 'update') {
  update();
} else if (cmd === '--version' || cmd === '-v') {
  console.log(`${PKG_NAME}@${VERSION}`);
} else if (!cmd || cmd === 'create' || !cmd.startsWith('-')) {
  create(cmd === 'create' ? arg || '.' : cmd || '.');
} else {
  console.log(
    `\nUsage:\n  npx ${PKG_NAME} <name>\n  npx ${PKG_NAME} init\n  npx ${PKG_NAME} dev\n  npx ${PKG_NAME} build\n  npx ${PKG_NAME} update\n`,
  );
}
