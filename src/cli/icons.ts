// App-icon generation: convert the config.json logo (SVG via sharp, or PNG)
// and run `tauri icon` into src-anvil/icons. Also hosts findBin, the helper
// that locates the bundled `tauri` binary.

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

import { PKG_DIR, readConfig } from './scaffold';

export function findBin(name: string, projectDir: string): string | null {
  const candidates = [
    path.join(projectDir, 'node_modules', '.bin', name),
    path.join(PKG_DIR, '..', 'node_modules', '.bin', name),
  ];
  for (const bin of candidates) {
    if (fs.existsSync(bin) || fs.existsSync(bin + '.exe')) return bin;
  }
  return null;
}

export function generateIcons(
  projectDir: string,
  { force = false }: { force?: boolean } = {},
): void {
  if (process.env.ANVIL_SKIP_ICONS === '1' && !force) return;
  const config = readConfig(projectDir);
  if (!config.logo) {
    if (force) {
      console.warn('  No "logo" field in config.json — nothing to generate.');
    }
    return;
  }

  const logo = config.logo as string;
  const logoPath = path.join(projectDir, 'src', logo);
  if (!fs.existsSync(logoPath)) {
    console.warn(
      `  Warning: logo not found at src/${logo}, skipping icon generation.`,
    );
    return;
  }

  const isSvg = logo.toLowerCase().endsWith('.svg');
  const isPng = logo.toLowerCase().endsWith('.png');

  if (!isSvg && !isPng) {
    console.warn(
      `  Warning: icon generation requires a .png or .svg logo (got ${logo}), skipping.`,
    );
    return;
  }

  // Skip when the logo has not changed since the last generation
  const hashFile = path.join(projectDir, 'src-anvil', '.logo-hash');
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(logoPath))
    .digest('hex');
  if (!force && fs.existsSync(hashFile)) {
    if (fs.readFileSync(hashFile, 'utf8').trim() === hash) return;
  }

  const bin = findBin('tauri', projectDir);
  if (!bin) {
    console.warn(
      '  Warning: @tauri-apps/cli not found, skipping icon generation.',
    );
    return;
  }

  let iconSrc = logoPath;
  let tmpPng: string | null = null;

  if (isSvg) {
    tmpPng = logoPath.replace(/\.svg$/i, '.tmp.png');
    console.log(`  Converting src/${logo} to PNG via sharp...`);
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
  // Without --output, tauri icon writes to src-tauri/icons — our folder is
  // src-anvil, so the generated icons would never be picked up.
  const r = spawnSync(
    bin,
    ['icon', '--output', 'icons', path.resolve(iconSrc)],
    {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      cwd: path.join(projectDir, 'src-anvil'),
    },
  );

  if (tmpPng) {
    try {
      fs.unlinkSync(tmpPng);
    } catch {}
  }

  if (r.status === 0) {
    fs.writeFileSync(hashFile, hash + '\n');
    console.log('  App icons updated from ' + logo);
  } else {
    console.warn('  Warning: icon generation failed.');
  }
}
