import { useEffect, useState } from 'react';
import { MC } from './api.js';
import type { InitStatus, LauncherConfig } from './api.js';

interface StepProgress {
  pct: number;
  label: string;
  error: boolean;
}

export default function App() {
  const [config, setConfig] = useState<LauncherConfig | null>(null);
  const [status, setStatus] = useState<InitStatus | null>(null);
  const [view, setView] = useState<'loading' | 'setup' | 'main'>('loading');
  const [username, setUsername] = useState('');
  const [dir, setDir] = useState('');
  const [progress, setProgress] = useState<Record<string, StepProgress>>({});
  const [installing, setInstalling] = useState(false);
  const [running, setRunning] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
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
    })();
  }, []);

  async function install() {
    if (!dir.trim()) {
      setError('Choose an install folder.');
      return;
    }
    setError('');
    setInstalling(true);
    try {
      const settings = await MC.getSettings();
      await MC.saveSettings({ ...settings, launcher_dir: dir.trim() });
      await MC.runSetup();
    } catch (e) {
      setError(`Error: ${e}`);
      setInstalling(false);
    }
  }

  async function playOrStop(id: string) {
    if (running.includes(id)) {
      await MC.stop(id).catch(() => {});
      return;
    }
    if (!username.trim()) return;
    const settings = await MC.getSettings();
    await MC.saveSettings({ ...settings, username: username.trim() });
    try {
      await MC.verify(id);
      await MC.play(id);
    } catch (e) {
      setMessage(`Error: ${e}`);
    }
  }

  if (view === 'loading' || !config || !status) return null;

  if (view === 'setup') {
    const steps = [
      { id: 'java', name: 'Java JRE', installed: status.java_ok },
      ...config.instances.map((inst) => ({
        id: inst.id,
        name: inst.name,
        installed:
          status.instances.find((i) => i.id === inst.id)?.installed ?? false,
      })),
    ];
    return (
      <div id="setup-overlay">
        <div className="card">
          <h1>Setup — {config.app_name}</h1>
          <label>Install folder</label>
          <div className="dir-row">
            <input
              type="text"
              value={dir}
              onChange={(e) => setDir(e.target.value)}
            />
            <button onClick={async () => setDir(await MC.getDefaultDir())}>
              Default
            </button>
          </div>
          {steps.map((s) => {
            const p = progress[s.id];
            const pct = p ? p.pct : s.installed ? 100 : 0;
            return (
              <div className="step" key={s.id}>
                <div
                  className="step-name"
                  style={{ color: s.installed ? '#4caf50' : '#aaa' }}>
                  {s.installed ? '✓' : '○'} {s.name}
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${pct}%`,
                      background: p?.error ? '#ef5350' : '#4caf50',
                    }}
                  />
                </div>
                <div className="step-label">
                  {p?.label ?? (s.installed ? 'Installed' : '')}
                </div>
              </div>
            );
          })}
          <button
            className="install-btn"
            disabled={installing}
            onClick={install}>
            {installing ? 'Installing…' : 'Install'}
          </button>
          <p className="status" style={{ color: '#ef5350' }}>
            {error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="brand">
        {config.logo && <img src={`./${config.logo}`} alt="" />}
        <h1>{config.app_name}</h1>
      </div>
      <label>Username</label>
      <input
        type="text"
        maxLength={16}
        placeholder="Steve"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />
      {config.instances.map((inst) => (
        <button
          key={inst.id}
          className="instance-btn"
          disabled={!running.includes(inst.id) && !username.trim()}
          onClick={() => playOrStop(inst.id)}>
          {running.includes(inst.id) ? '■  Stop' : `▶  ${inst.name}`}
        </button>
      ))}
      <p className="status">{message}</p>
    </div>
  );
}
