// Frontend template registry + the interactive template picker.

const { version: VERSION, name: PKG_NAME } = require('../../package.json') as {
  version: string;
  name: string;
};

export interface TemplateSpec {
  label: string;
  vite: boolean;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

export interface CreateFlags {
  template?: string;
  yes?: boolean;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export const TEMPLATES: Record<string, TemplateSpec> = {
  'vanilla-js': {
    label: 'Vanilla (no build step)',
    vite: false,
    dependencies: {},
    devDependencies: {},
  },
  'vanilla-ts': {
    label: 'Vanilla + TypeScript',
    vite: true,
    dependencies: {},
    devDependencies: { typescript: '^6', vite: '^8' },
  },
  'react-js': {
    label: 'React',
    vite: true,
    dependencies: { react: '^19', 'react-dom': '^19' },
    devDependencies: { '@vitejs/plugin-react': '^6', vite: '^8' },
  },
  'react-ts': {
    label: 'React + TypeScript',
    vite: true,
    dependencies: { react: '^19', 'react-dom': '^19' },
    devDependencies: {
      '@types/react': '^19',
      '@types/react-dom': '^19',
      '@vitejs/plugin-react': '^6',
      typescript: '^6',
      vite: '^8',
    },
  },
  'vue-js': {
    label: 'Vue',
    vite: true,
    dependencies: { vue: '^3.5' },
    devDependencies: { '@vitejs/plugin-vue': '^6', vite: '^8' },
  },
  'vue-ts': {
    label: 'Vue + TypeScript',
    vite: true,
    dependencies: { vue: '^3.5' },
    devDependencies: {
      '@vitejs/plugin-vue': '^6',
      typescript: '^6',
      vite: '^8',
    },
  },
  'solid-js': {
    label: 'Solid',
    vite: true,
    dependencies: { 'solid-js': '^1.9' },
    devDependencies: { 'vite-plugin-solid': '^2', vite: '^8' },
  },
  'solid-ts': {
    label: 'Solid + TypeScript',
    vite: true,
    dependencies: { 'solid-js': '^1.9' },
    devDependencies: {
      'vite-plugin-solid': '^2',
      typescript: '^6',
      vite: '^8',
    },
  },
};

// ── Interactive prompt (@clack/prompts) ───────────────────────────────────────

export async function resolveTemplate(flags: CreateFlags): Promise<string> {
  if (flags.template) {
    if (!TEMPLATES[flags.template]) {
      process.stderr.write(
        `\nError: unknown template '${flags.template}'.\nAvailable: ${Object.keys(TEMPLATES).join(', ')}\n\n`,
      );
      process.exit(1);
    }
    return flags.template;
  }
  if (flags.yes || !process.stdin.isTTY || !process.stdout.isTTY) {
    return 'vanilla-js';
  }

  const clack = require('@clack/prompts');
  clack.intro(`${PKG_NAME} v${VERSION}`);

  const lang = await clack.select({
    message: 'Which language?',
    options: [
      { value: 'ts', label: 'TypeScript' },
      { value: 'js', label: 'JavaScript' },
    ],
  });
  if (clack.isCancel(lang)) {
    clack.cancel('Aborted.');
    process.exit(1);
  }

  const fw = await clack.select({
    message: 'Which framework?',
    options: [
      { value: 'vanilla', label: 'Vanilla', hint: 'no framework' },
      { value: 'react', label: 'React' },
      { value: 'vue', label: 'Vue' },
      { value: 'solid', label: 'Solid' },
    ],
  });
  if (clack.isCancel(fw)) {
    clack.cancel('Aborted.');
    process.exit(1);
  }

  const templateId = `${fw}-${lang}`;
  clack.outro(`Template: ${templateId}`);
  return templateId;
}
