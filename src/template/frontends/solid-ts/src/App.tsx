import { For, Show, createSignal, onMount } from 'solid-js';
import { MC } from './api.js';
import type { InitStatus, LauncherConfig } from './api.js';

export default function App() {
  const [config, setConfig] = createSignal<LauncherConfig | null>(null);
  const [status, setStatus] = createSignal<InitStatus | null>(null);
  const [view, setView] = createSignal<'loading' | 'setup' | 'main'>('loading');
  const [username, setUsername] = createSignal('');
  const [dir, setDir] = createSignal('');
  const [progress, setProgress] = createSignal<
    Record<string, { pct: number; label: string; error: boolean }>
  >({});
  const [installing, setInstalling] = createSignal(false);
  const [running, setRunning] = createSignal<string[]>([]);
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');

  onMount(async () => {
    const [cfg, settings, init] = await Promise.all([
      MC.getConfig(),
      MC.getSettings(),
      MC.getInitStatus(),
    ]);
    document.title = cfg.app_name;
    setConfig(cfg);
    setStatus(init);
    setUsername(settings.username ?? '');
    setDir(init.launcher_dir);
    setView(
      init.java_ok && init.instances.every((i) => i.installed)
        ? 'main'
        : 'setup',
    );

    MC.on.setupProgress(({ step, current, total, label, error: err }) => {
      setProgress((p) => ({
        ...p,
        [step]: {
          pct: total > 0 ? Math.round((current * 100) / total) : 0,
          label,
          error: err,
        },
      }));
    });
    MC.on.setupDone(async () => {
      const s = await MC.getInitStatus();
      setStatus(s);
      setInstalling(false);
      if (s.java_ok && s.instances.every((i) => i.installed)) setView('main');
    });
    MC.on.gameStarting((id) => setRunning((r) => [...r, id]));
    MC.on.gameExit(({ instance_id, code }) => {
      setRunning((r) => r.filter((x) => x !== instance_id));
      setMessage(code === 0 ? 'Session ended.' : `Exited with code ${code}.`);
    });
  });

  const steps = () => {
    if (!config() || !status()) return [];
    return [
      { id: 'java', name: 'Java JRE', installed: status()!.java_ok },
      ...config()!.instances.map((inst) => ({
        id: inst.id,
        name: inst.name,
        installed:
          status()!.instances.find((i) => i.id === inst.id)?.installed ?? false,
      })),
    ];
  };

  async function install() {
    if (!dir().trim()) {
      setError('Choose an install folder.');
      return;
    }
    setError('');
    setInstalling(true);
    try {
      const settings = await MC.getSettings();
      await MC.saveSettings({ ...settings, launcher_dir: dir().trim() });
      await MC.runSetup();
    } catch (e) {
      setError(`Error: ${e}`);
      setInstalling(false);
    }
  }

  async function playOrStop(id: string) {
    if (running().includes(id)) {
      await MC.stop(id).catch(() => {});
      return;
    }
    if (!username().trim()) return;
    const settings = await MC.getSettings();
    await MC.saveSettings({ ...settings, username: username().trim() });
    try {
      await MC.verify(id);
      await MC.play(id);
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
  }

  return (
    <>
      <Show when={view() === 'setup'}>
        <div id="setup-overlay">
          <div class="card">
            <h1>Setup — {config()!.app_name}</h1>
            <label>Install folder</label>
            <div class="dir-row">
              <input
                type="text"
                value={dir()}
                onInput={(e) => setDir(e.currentTarget.value)}
              />
              <button onClick={async () => setDir(await MC.getDefaultDir())}>
                Default
              </button>
            </div>
            <For each={steps()}>
              {(s) => {
                const p = () => progress()[s.id];
                const pct = () => p()?.pct ?? (s.installed ? 100 : 0);
                return (
                  <div class="step">
                    <div
                      class="step-name"
                      style={{ color: s.installed ? '#4caf50' : '#aaa' }}>
                      {s.installed ? '✓' : '○'} {s.name}
                    </div>
                    <div class="bar-track">
                      <div
                        class="bar-fill"
                        style={{
                          width: `${pct()}%`,
                          background: p()?.error ? '#ef5350' : '#4caf50',
                        }}
                      />
                    </div>
                    <div class="step-label">
                      {p()?.label ?? (s.installed ? 'Installed' : '')}
                    </div>
                  </div>
                );
              }}
            </For>
            <button
              class="install-btn"
              disabled={installing()}
              onClick={install}>
              {installing() ? 'Installing…' : 'Install'}
            </button>
            <p class="status" style={{ color: '#ef5350' }}>
              {error()}
            </p>
          </div>
        </div>
      </Show>

      <Show when={view() === 'main'}>
        <div class="card">
          <div class="brand">
            <Show when={config()!.logo}>
              <img src={`./${config()!.logo}`} alt="" />
            </Show>
            <h1>{config()!.app_name}</h1>
          </div>
          <label>Username</label>
          <input
            type="text"
            maxLength={16}
            placeholder="Steve"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
          <For each={config()!.instances}>
            {(inst) => (
              <button
                class="instance-btn"
                disabled={!running().includes(inst.id) && !username().trim()}
                onClick={() => playOrStop(inst.id)}>
                {running().includes(inst.id) ? '■  Stop' : `▶  ${inst.name}`}
              </button>
            )}
          </For>
          <p class="status">{message()}</p>
        </div>
      </Show>
    </>
  );
}
