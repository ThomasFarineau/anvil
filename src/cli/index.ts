#!/usr/bin/env node

// anvil CLI entry point — commander wiring only. All behavior lives in the
// sibling modules (templates / scaffold / icons / tauri / commands).

import { Command } from 'commander';

import { TEMPLATES } from './templates';
import { PKG_NAME, VERSION } from './scaffold';
import { create, init, update } from './commands';
import { runTauri } from './tauri';
import { generateIcons } from './icons';

const program = new Command();

program
  .name('anvil')
  .description('Zero-config Minecraft launcher framework built on Tauri')
  .version(`${PKG_NAME}@${VERSION}`, '-v, --version');

program
  .command('create [name]', { isDefault: true })
  .description('Scaffold a new project (interactive)')
  .option(
    '-t, --template <id>',
    `skip prompts (${Object.keys(TEMPLATES).join(', ')})`,
  )
  .option('-y, --yes', 'skip prompts and use the default (vanilla-js)')
  .action((name, opts) => create(name || '.', opts));

program
  .command('init')
  .description('Initialize anvil in the current folder')
  .action(init);

program
  .command('dev')
  .description('Start the launcher in development mode')
  .action(() => runTauri('dev'));

program
  .command('build')
  .description('Compile the launcher for distribution')
  .action(() => runTauri('build'));

program
  .command('update')
  .description('Update the Rust backend and api.js to the current version')
  .action(update);

program
  .command('icons')
  .description('Regenerate app icons from the logo set in config.json')
  .action(() => generateIcons(process.cwd(), { force: true }));

program.parseAsync().catch((e) => {
  process.stderr.write(`\nError: ${e?.message ?? e}\n`);
  process.exit(1);
});
