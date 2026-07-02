// The `create`, `init` and `update` command actions.

import fs from 'fs';
import path from 'path';

import { resolveTemplate, type CreateFlags } from './templates';
import {
  PKG_DIR,
  PKG_NAME,
  VERSION,
  copyUserFiles,
  deriveName,
  scaffoldTauri,
  writePackageJson,
} from './scaffold';
import { generateIcons } from './icons';

// ── create ────────────────────────────────────────────────────────────────────

export async function create(
  target: string,
  flags: CreateFlags,
): Promise<void> {
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

  const templateId = await resolveTemplate(flags);

  console.log(`\nCreating ${PKG_NAME} project: ${name} (${templateId})\n`);
  copyUserFiles(projectDir, templateId);
  writePackageJson(projectDir, name, templateId);
  scaffoldTauri(projectDir, name);
  generateIcons(projectDir);

  const cdLine = target !== '.' ? `  cd ${target}\n` : '';
  console.log(
    `Done!\n\n${cdLine}  npm install\n  # Edit config.json and src/\n  npm run dev\n`,
  );
}

// ── init ──────────────────────────────────────────────────────────────────────

export function init(): void {
  const projectDir = process.cwd();
  const name = deriveName(projectDir);

  console.log(`\nInitializing ${PKG_NAME} in: ${projectDir}\n`);
  copyUserFiles(projectDir);
  scaffoldTauri(projectDir, name);
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

export function update(): void {
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

  const srcDir = path.join(projectDir, 'src');
  if (fs.existsSync(srcDir)) {
    fs.copyFileSync(
      path.join(PKG_DIR, 'template', 'shared', 'api.js'),
      path.join(srcDir, 'api.js'),
    );
    // Refresh typings when the project uses them
    if (fs.existsSync(path.join(srcDir, 'api.d.ts'))) {
      fs.copyFileSync(
        path.join(PKG_DIR, 'client', 'index.d.ts'),
        path.join(srcDir, 'api.d.ts'),
      );
    }
  }

  fs.writeFileSync(path.join(srcTauri, '.lc-version'), VERSION);
  console.log(`\nUpdated to ${PKG_NAME}@${VERSION}\n`);
}
