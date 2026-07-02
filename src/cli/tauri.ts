// Proxy to the Tauri CLI for `anvil dev` / `anvil build`: ensures src-anvil/
// exists, refreshes icons, then runs tauri in the backend folder.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { PKG_NAME, readConfigField } from './scaffold';
import { findBin, generateIcons } from './icons';
import { init } from './commands';

export function runTauri(tauriCmd: string): void {
  const projectDir = process.cwd();
  const srcTauri = path.join(projectDir, 'src-anvil');

  if (!fs.existsSync(srcTauri)) {
    console.log(`\nNo src-anvil/ found — running anvil init first...\n`);
    init();
  }

  // Regenerate app icons when the logo changed since last run
  generateIcons(projectDir);

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
