// tauri-mc-launcher client API
// Requires withGlobalTauri: true in tauri.conf.json (set by default).
// Import this file as an ES module: import { MC } from '/api.js';

const _invoke = window.__TAURI__.core.invoke;
const _listen = window.__TAURI__.event.listen;
const _window = window.__TAURI__.window;

export const MC = {
  // ── Config & settings ──────────────────────────────────────
  getConfig: () => _invoke('get_server_config'),
  getSettings: () => _invoke('get_settings'),
  saveSettings: (settings) => _invoke('save_settings', { settings }),
  getDefaultDir: () => _invoke('get_default_launcher_dir'),

  // ── Init / install ─────────────────────────────────────────
  getInitStatus: () => _invoke('get_init_status'),
  runSetup: () => _invoke('run_setup'),

  // ── Game ───────────────────────────────────────────────────
  verify: (instanceId) => _invoke('verify_game', { instanceId }),
  play: (instanceId) => _invoke('launch_game', { instanceId }),

  // ── Updater ────────────────────────────────────────────────
  checkUpdate: () => _invoke('check_update'),
  doUpdate: (url) => _invoke('do_update', { url }),

  // ── Session ────────────────────────────────────────────────
  setSession: (session) => _invoke('set_custom_session', { session }),
  clearSession: () => _invoke('set_custom_session', { session: null }),

  // ── Window ─────────────────────────────────────────────────
  close: () => _window.getCurrentWindow().close(),

  // ── Events ─────────────────────────────────────────────────
  on: {
    setupProgress: (cb) => _listen('setup:progress', (e) => cb(e.payload)),
    setupDone: (cb) => _listen('setup:done', cb),
    gameStarting: (cb) => _listen('game:starting', (e) => cb(e.payload)),
    gameOutput: (cb) => _listen('game:output', (e) => cb(e.payload)),
    gameExit: (cb) => _listen('game:exit', (e) => cb(e.payload)),
  },
};
