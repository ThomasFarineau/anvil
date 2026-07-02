import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';

// Run the TypeScript CLI source directly with Bun (process.execPath is the
// Bun binary under `bun test`), so tests always reflect the current source
// without needing a bundle build first.
const CLI = join(import.meta.dir, '../src/cli/index.ts');
const TMP = join(tmpdir(), 'anvil-tests');

mkdirSync(TMP, { recursive: true });

function makeTmpDir(): string {
  const d = join(
    TMP,
    `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  mkdirSync(d, { recursive: true });
  return d;
}

// Icon generation (sharp + tauri icon) is slow and already covered by the
// Rust CI job — skip it in unit tests.
const ENV = { ...process.env, ANVIL_SKIP_ICONS: '1' };

function cli(...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: ENV,
  });
}

function cliIn(cwd: string, ...args: string[]) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    encoding: 'utf8',
    env: ENV,
  });
}

// ── create ────────────────────────────────────────────────────────────────────

describe('create', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir();
    rmSync(dir, { recursive: true }); // create() needs a non-existing or empty dir
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('exits 0', () => {
    const r = cli('create', dir);
    expect(r.status).toBe(0);
  });

  test('prints next-step instructions', () => {
    const r = cli('create', dir);
    expect(r.stdout).toContain('npm install');
    expect(r.stdout).toContain('npm run dev');
  });

  test('generates all required files', () => {
    cli('create', dir);

    const required = [
      'config.json',
      'src/index.html',
      'src/api.js',
      '.gitignore',
      'package.json',
      'src-anvil/src/lib.rs',
      'src-anvil/src/main.rs',
      'src-anvil/Cargo.toml',
      'src-anvil/tauri.conf.json',
      'src-anvil/build.rs',
      'src-anvil/capabilities/default.json',
    ];

    for (const f of required) {
      expect(existsSync(join(dir, f))).toBeTrue();
    }
  });

  test('does not generate _gitignore (must be renamed to .gitignore)', () => {
    cli('create', dir);
    expect(existsSync(join(dir, '_gitignore'))).toBeFalse();
    expect(existsSync(join(dir, '.gitignore'))).toBeTrue();
  });

  test('substitutes {{name}} and {{safe_id}} in Cargo.toml', () => {
    cli('create', dir);
    const cargo = readFileSync(join(dir, 'src-anvil/Cargo.toml'), 'utf8');
    expect(cargo).not.toContain('{{');
    const name = dir.split(/[\\/]/).at(-1)!;
    expect(cargo).toContain(`name = "${name}"`);
  });

  test('tauri.conf.json has no unreplaced placeholders', () => {
    cli('create', dir);
    const raw = readFileSync(join(dir, 'src-anvil/tauri.conf.json'), 'utf8');
    expect(raw).not.toContain('{{');
  });

  test('tauri.conf.json is valid JSON with expected shape', () => {
    cli('create', dir);
    const conf = JSON.parse(
      readFileSync(join(dir, 'src-anvil/tauri.conf.json'), 'utf8'),
    );
    expect(conf).toHaveProperty('productName');
    expect(conf).toHaveProperty('identifier');
    expect(conf.app?.withGlobalTauri).toBe(true);
  });

  test('generates valid JSON for package.json and capabilities', () => {
    cli('create', dir);
    for (const f of [
      'package.json',
      'src-anvil/tauri.conf.json',
      'src-anvil/capabilities/default.json',
    ]) {
      expect(() =>
        JSON.parse(readFileSync(join(dir, f), 'utf8')),
      ).not.toThrow();
    }
  });

  test('package.json has dev and build scripts', () => {
    cli('create', dir);
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts?.dev).toBe('anvil dev');
    expect(pkg.scripts?.build).toBe('anvil build');
  });

  test('writes .lc-version marker', () => {
    cli('create', dir);
    const v = readFileSync(join(dir, 'src-anvil/.lc-version'), 'utf8').trim();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('fails with exit 1 when directory is not empty', () => {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'existing.txt'), 'hello');
    const r = cli('create', dir);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('not empty');
  });

  test('lib.rs is non-trivial (full Rust backend)', () => {
    cli('create', dir);
    const lib = readFileSync(join(dir, 'src-anvil/src/lib.rs'), 'utf8');
    expect(lib.length).toBeGreaterThan(5000);
    expect(lib).toContain('launch_game');
    expect(lib).toContain('run_setup');
  });

  test('api.js references MC object', () => {
    cli('create', dir);
    const api = readFileSync(join(dir, 'src/api.js'), 'utf8');
    expect(api).toContain('export const MC');
    expect(api).toContain('launch_game');
  });

  test('defaults to vanilla-js template when not a TTY', () => {
    cli('create', dir);
    expect(existsSync(join(dir, 'src/index.html'))).toBeTrue();
    expect(existsSync(join(dir, 'src/style.css'))).toBeTrue();
    expect(existsSync(join(dir, 'src/logo.svg'))).toBeTrue();
    expect(existsSync(join(dir, 'vite.config.js'))).toBeFalse();
    expect(existsSync(join(dir, 'vite.config.ts'))).toBeFalse();
  });

  test('rejects an unknown template', () => {
    const r = cli('create', dir, '--template', 'angular-coffee');
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('unknown template');
  });
});

// ── create --template ─────────────────────────────────────────────────────────

describe('create --template', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir();
    rmSync(dir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('react-ts generates a Vite + TypeScript project', () => {
    const r = cli('create', dir, '--template', 'react-ts');
    expect(r.status).toBe(0);

    for (const f of [
      'vite.config.ts',
      'tsconfig.json',
      'src/App.tsx',
      'src/main.tsx',
      'src/api.js',
      'src/api.d.ts',
      'src/style.css',
    ]) {
      expect(existsSync(join(dir, f))).toBeTrue();
    }

    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.react).toBeDefined();
    expect(pkg.devDependencies?.vite).toBeDefined();
    expect(pkg.devDependencies?.typescript).toBeDefined();
    expect(pkg.scripts?.['dev:ui']).toBe('vite');

    const conf = JSON.parse(
      readFileSync(join(dir, 'src-anvil/tauri.conf.json'), 'utf8'),
    );
    expect(conf.build?.devUrl).toBe('http://localhost:5173');
    expect(conf.build?.frontendDist).toBe('../dist');
    expect(conf.build?.beforeDevCommand).toBe('npm run dev:ui');
  });

  test('vue-js generates an App.vue project', () => {
    const r = cli('create', dir, '--template', 'vue-js');
    expect(r.status).toBe(0);
    expect(existsSync(join(dir, 'src/App.vue'))).toBeTrue();
    expect(existsSync(join(dir, 'src/api.d.ts'))).toBeFalse();
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.dependencies?.vue).toBeDefined();
  });

  test('solid-ts generates a Solid TypeScript project', () => {
    const r = cli('create', dir, '--template', 'solid-ts');
    expect(r.status).toBe(0);
    expect(existsSync(join(dir, 'src/App.tsx'))).toBeTrue();
    const tsconfig = JSON.parse(
      readFileSync(join(dir, 'tsconfig.json'), 'utf8'),
    );
    expect(tsconfig.compilerOptions?.jsxImportSource).toBe('solid-js');
  });

  test('vanilla-js keeps the static frontendDist (no Vite)', () => {
    cli('create', dir, '--template', 'vanilla-js');
    const conf = JSON.parse(
      readFileSync(join(dir, 'src-anvil/tauri.conf.json'), 'utf8'),
    );
    expect(conf.build?.frontendDist).toBe('../src');
    expect(conf.build?.devUrl).toBeUndefined();
  });
});

// ── init ──────────────────────────────────────────────────────────────────────

describe('init', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir();
  });
  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('exits 0', () => {
    const r = cliIn(dir, 'init');
    expect(r.status).toBe(0);
  });

  test('creates src-anvil/ in current directory', () => {
    cliIn(dir, 'init');
    expect(existsSync(join(dir, 'src-anvil/src/lib.rs'))).toBeTrue();
    expect(existsSync(join(dir, 'src-anvil/Cargo.toml'))).toBeTrue();
  });

  test('creates config.json and src/ when missing', () => {
    cliIn(dir, 'init');
    expect(existsSync(join(dir, 'config.json'))).toBeTrue();
    expect(existsSync(join(dir, 'src/index.html'))).toBeTrue();
  });

  test('does not overwrite existing config.json', () => {
    const custom = '{"app_name":"custom","instances":[]}';
    writeFileSync(join(dir, 'config.json'), custom);
    cliIn(dir, 'init');
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).toBe(custom);
  });

  test('does not overwrite existing src/', () => {
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src/index.html'), '<!-- custom -->');
    cliIn(dir, 'init');
    expect(readFileSync(join(dir, 'src/index.html'), 'utf8')).toBe(
      '<!-- custom -->',
    );
  });

  test('creates package.json when missing', () => {
    cliIn(dir, 'init');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.scripts?.dev).toBe('anvil dev');
  });

  test('patches existing package.json without overwriting it', () => {
    const existing = {
      name: 'my-existing-app',
      version: '2.0.0',
      scripts: { test: 'jest' },
    };
    writeFileSync(join(dir, 'package.json'), JSON.stringify(existing));
    cliIn(dir, 'init');
    const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
    expect(pkg.name).toBe('my-existing-app');
    expect(pkg.version).toBe('2.0.0');
    expect(pkg.scripts?.test).toBe('jest');
    expect(pkg.scripts?.dev).toBe('anvil dev');
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('update', () => {
  let dir: string;

  beforeEach(() => {
    dir = makeTmpDir();
    rmSync(dir, { recursive: true });
    cli('create', dir);
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  test('exits 0', () => {
    expect(cliIn(dir, 'update').status).toBe(0);
  });

  test('restores a corrupted lib.rs', () => {
    const libPath = join(dir, 'src-anvil/src/lib.rs');
    writeFileSync(libPath, '// corrupted');
    cliIn(dir, 'update');
    const lib = readFileSync(libPath, 'utf8');
    expect(lib).not.toBe('// corrupted');
    expect(lib).toContain('launch_game');
  });

  test('restores a corrupted api.js', () => {
    const apiPath = join(dir, 'src/api.js');
    writeFileSync(apiPath, '// corrupted');
    cliIn(dir, 'update');
    expect(readFileSync(apiPath, 'utf8')).toContain('MC');
  });

  test('does not overwrite config.json', () => {
    const custom = '{"app_name":"stays","instances":[]}';
    writeFileSync(join(dir, 'config.json'), custom);
    cliIn(dir, 'update');
    expect(readFileSync(join(dir, 'config.json'), 'utf8')).toBe(custom);
  });

  test('updates .lc-version marker', () => {
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, '../package.json'), 'utf8'),
    );
    cliIn(dir, 'update');
    expect(
      readFileSync(join(dir, 'src-anvil/.lc-version'), 'utf8').trim(),
    ).toBe(pkg.version);
  });

  test('fails with exit 1 outside a anvil project', () => {
    const r = spawnSync(process.execPath, [CLI, 'update'], {
      cwd: tmpdir(),
      encoding: 'utf8',
    });
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('src-anvil');
  });
});

// ── dev / build ───────────────────────────────────────────────────────────────

// ── --version ─────────────────────────────────────────────────────────────────

describe('--version', () => {
  test('prints package name and version', () => {
    const r = cli('--version');
    expect(r.status).toBe(0);
    const pkg = JSON.parse(
      readFileSync(join(import.meta.dir, '../package.json'), 'utf8'),
    );
    expect(r.stdout.trim()).toBe(`${pkg.name}@${pkg.version}`);
  });

  test('-v alias works', () => {
    expect(cli('-v').status).toBe(0);
  });
});
