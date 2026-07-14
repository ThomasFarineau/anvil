// anvil client API — JS ↔ Rust bridge.
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
  getVersion: () => _invoke('get_launcher_version'),

  // ── Init / install ─────────────────────────────────────────
  getInitStatus: () => _invoke('get_init_status'),
  runSetup: () => _invoke('run_setup'),

  // ── Game ───────────────────────────────────────────────────
  verify: (instanceId) => _invoke('verify_game', { instanceId }),
  play: (instanceId) => _invoke('launch_game', { instanceId }),
  stop: (instanceId) => _invoke('stop_game', { instanceId }),
  getRunning: () => _invoke('get_running_instances'),
  isRunning: (instanceId) =>
    _invoke('get_running_instances').then((ids) => ids.includes(instanceId)),

  // ── Mods (per instance) ────────────────────────────────────
  mods: {
    list: (instanceId) => _invoke('get_mods', { instanceId }),
    add: (instanceId, url, fileName = null) =>
      _invoke('add_mod', { instanceId, url, fileName }),
    remove: (instanceId, fileName) =>
      _invoke('remove_mod', { instanceId, fileName }),
    enable: (instanceId, fileName) =>
      _invoke('set_mod_enabled', { instanceId, fileName, enabled: true }),
    disable: (instanceId, fileName) =>
      _invoke('set_mod_enabled', { instanceId, fileName, enabled: false }),
    openFolder: (instanceId) => _invoke('open_mods_folder', { instanceId }),
  },

  // ── Folders ────────────────────────────────────────────────
  openInstanceFolder: (instanceId) =>
    _invoke('open_instance_folder', { instanceId }),

  // ── Updater ────────────────────────────────────────────────
  checkUpdate: () => _invoke('check_update'),
  doUpdate: (url) => _invoke('do_update', { url }),

  // ── Session ────────────────────────────────────────────────
  setSession: (session) => _invoke('set_custom_session', { session }),
  clearSession: () => _invoke('set_custom_session', { session: null }),

  // ── Session anvil-server ("session": "anvil-session") ─────
  anvilSession: {
    // Résout en { status: 'ok' | 'totp_required', username, uuid }.
    // Rejette avec un message d'erreur si identifiants/code invalides.
    login: (username, password, code = null) =>
      _invoke('anvil_session_login', { username, password, code }),
    // Restaure la session persistée (null si aucune/expirée).
    restore: () => _invoke('anvil_session_restore'),
    logout: () => _invoke('anvil_session_logout'),
  },

  // ── Window ─────────────────────────────────────────────────
  close: () => _window.getCurrentWindow().close(),
  minimize: () => _window.getCurrentWindow().minimize(),
  toggleMaximize: () => _window.getCurrentWindow().toggleMaximize(),
  startDrag: () => _window.getCurrentWindow().startDragging(),

  // ── Events ─────────────────────────────────────────────────
  on: {
    setupProgress: (cb) => _listen('setup:progress', (e) => cb(e.payload)),
    setupDone: (cb) => _listen('setup:done', cb),
    gameStarting: (cb) => _listen('game:starting', (e) => cb(e.payload)),
    gameOutput: (cb) => _listen('game:output', (e) => cb(e.payload)),
    gameExit: (cb) => _listen('game:exit', (e) => cb(e.payload)),
  },
};
