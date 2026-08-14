// Proxy to the Tauri CLI for `anvil dev` / `anvil build`: ensures src-anvil/
// exists, refreshes icons, then runs tauri in the backend folder.

import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

import { PKG_NAME, readConfig, readConfigField } from './scaffold';
import { findBin, generateIcons } from './icons';
import { init } from './commands';

export function createWindowOverride(
  projectDir: string,
): Record<string, unknown> | null {
  const launcherConfig = readConfig(projectDir);
  const windowConfig =
    launcherConfig.window && typeof launcherConfig.window === 'object'
      ? (launcherConfig.window as Record<string, unknown>)
      : {};
  const width =
    typeof windowConfig.width === 'number' && windowConfig.width >= 800
      ? windowConfig.width
      : null;
  const height =
    typeof windowConfig.height === 'number' && windowConfig.height >= 520
      ? windowConfig.height
      : null;
  const devtools =
    typeof windowConfig.devtools === 'boolean' ? windowConfig.devtools : null;
  const shadow =
    typeof windowConfig.shadow === 'boolean' ? windowConfig.shadow : null;
  const transparent =
    typeof windowConfig.transparent === 'boolean'
      ? windowConfig.transparent
      : null;
  const decorations =
    typeof windowConfig.decorations === 'boolean'
      ? windowConfig.decorations
      : null;
  const resizable =
    typeof windowConfig.resizable === 'boolean' ? windowConfig.resizable : null;
  const hasWindowOverride =
    width !== null ||
    height !== null ||
    devtools !== null ||
    shadow !== null ||
    transparent !== null ||
    decorations !== null ||
    resizable !== null;

  const tauriConfigPath = path.join(projectDir, 'src-anvil', 'tauri.conf.json');
  let windows: Array<Record<string, unknown>> = [];
  let build: Record<string, unknown> = {};
  try {
    const tauriConfig = JSON.parse(fs.readFileSync(tauriConfigPath, 'utf8'));
    if (Array.isArray(tauriConfig.app?.windows)) {
      windows = tauriConfig.app.windows;
    }
    if (tauriConfig.build && typeof tauriConfig.build === 'object') {
      build = { ...tauriConfig.build };
    }
  } catch {
    // Tauri will report an invalid base config itself. Keep the override valid
    // so disabling DevTools never hides the underlying configuration error.
  }

  const override: Record<string, unknown> = {
    build: { ...build, additionalWatchFolders: ['../config.json'] },
  };
  if (!hasWindowOverride) return override;

  if (windows.length === 0) windows = [{ label: 'main' }];
  override.app = {
    windows: windows.map((window) => {
      const windowOverride: Record<string, unknown> = {};
      if (width !== null) windowOverride.width = width;
      if (height !== null) windowOverride.height = height;
      if (devtools !== null) windowOverride.devtools = devtools;
      if (shadow !== null) windowOverride.shadow = shadow;
      if (transparent !== null) windowOverride.transparent = transparent;
      if (decorations !== null) windowOverride.decorations = decorations;
      if (resizable !== null) windowOverride.resizable = resizable;
      return Object.assign({}, window, windowOverride);
    }),
  };
  return override;
}

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

  const args = [tauriCmd];
  const windowOverride = createWindowOverride(projectDir);
  let overridePath: string | null = null;
  if (windowOverride) {
    const overrideDir = path.join(srcTauri, 'target');
    fs.mkdirSync(overrideDir, { recursive: true });
    overridePath = path.join(overrideDir, '.anvil-tauri-config.json');
    fs.writeFileSync(overridePath, JSON.stringify(windowOverride));
    args.push('--config', overridePath);
  }

  const result = (() => {
    try {
      return spawnSync(bin, args, {
        stdio: 'inherit',
        shell: process.platform === 'win32',
        cwd: srcTauri,
        env,
      });
    } finally {
      if (overridePath) fs.rmSync(overridePath, { force: true });
    }
  })();

  process.exit(result.status ?? 1);
}
