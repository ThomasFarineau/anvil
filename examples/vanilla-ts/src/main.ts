import { MC } from './api.js';
import type { InitStatus, LauncherConfig } from './api.js';

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

// ── Boot ────────────────────────────────────────────────────
const [config, settings, initStatus] = await Promise.all([
  MC.getConfig(),
  MC.getSettings(),
  MC.getInitStatus(),
]);

if (settings.username) {
  $<HTMLInputElement>('username-input').value = settings.username;
}

document.title = config.app_name;

const allInstalled =
  initStatus.java_ok && initStatus.instances.every((i) => i.installed);

if (allInstalled) {
  showMain(config);
} else {
  showSetup(config, initStatus);
}

// ── Main page ────────────────────────────────────────────────
function showMain(config: LauncherConfig): void {
  $('main-view').style.display = 'flex';
  $('server-name').textContent = config.app_name;

  if (config.logo) {
    const logo = $<HTMLImageElement>('logo');
    logo.src = `./${config.logo}`;
    logo.style.display = 'block';
  }

  const container = $('instances-container');
  for (const inst of config.instances) {
    const btn = document.createElement('button');
    btn.className = 'instance-btn';
    btn.id = `play-${inst.id}`;
    btn.textContent = `▶  ${inst.name}`;
    btn.disabled = true;
    btn.addEventListener('click', () => onPlay(inst.id));
    container.appendChild(btn);
  }

  $('username-input').addEventListener('input', updateButtons);
  updateButtons();

  MC.on.gameStarting((id) => {
    const btn = $<HTMLButtonElement>(`play-${id}`);
    btn.textContent = '■  Stop';
    btn.disabled = false;
    btn.dataset.running = '1';
  });
  MC.on.gameExit(({ instance_id, code }) => {
    const btn = $<HTMLButtonElement>(`play-${instance_id}`);
    btn.textContent = `▶  ${config.instances.find((i) => i.id === instance_id)?.name ?? instance_id}`;
    delete btn.dataset.running;
    updateButtons();
    $('game-status').textContent =
      code === 0 ? 'Session ended.' : `Exited with code ${code}.`;
  });

  // Check for updates silently
  MC.checkUpdate()
    .then((info) => {
      if (info) {
        const ok = confirm(
          `Update ${info.version} available.\n\n${info.notes}\n\nInstall now?`,
        );
        if (ok) MC.doUpdate(info.url);
      }
    })
    .catch(() => {});
}

function updateButtons(): void {
  const username = $<HTMLInputElement>('username-input').value.trim();
  document
    .querySelectorAll<HTMLButtonElement>('.instance-btn')
    .forEach((btn) => {
      if (!btn.dataset.running) btn.disabled = !username;
    });
}

async function onPlay(instanceId: string): Promise<void> {
  const btn = $<HTMLButtonElement>(`play-${instanceId}`);
  if (btn.dataset.running) {
    await MC.stop(instanceId).catch(() => {});
    return;
  }
  const username = $<HTMLInputElement>('username-input').value.trim();
  if (!username) return;
  const settings = await MC.getSettings();
  await MC.saveSettings({ ...settings, username });
  try {
    await MC.verify(instanceId);
    await MC.play(instanceId);
  } catch (e) {
    alert(`Error: ${e}`);
  }
}

// ── Setup page ───────────────────────────────────────────────
function showSetup(config: LauncherConfig, initStatus: InitStatus): void {
  $('setup-overlay').style.display = 'flex';
  $('setup-title').textContent = `Setup — ${config.app_name}`;
  $<HTMLInputElement>('dir-input').value = initStatus.launcher_dir;

  $('dir-default-btn').addEventListener('click', async () => {
    $<HTMLInputElement>('dir-input').value = await MC.getDefaultDir();
  });

  renderSteps(initStatus, config);

  $('install-btn').addEventListener('click', onInstall);

  // Live progress
  MC.on.setupProgress(({ step, current, total, label, error }) => {
    const pct = total > 0 ? Math.round((current * 100) / total) : 0;
    const fill = document.getElementById(`bar-${step}`);
    const lbl = document.getElementById(`lbl-${step}`);
    if (fill) {
      fill.style.width = `${pct}%`;
      fill.style.background = error ? '#ef5350' : '#4caf50';
    }
    if (lbl) lbl.textContent = label;
  });

  MC.on.setupDone(async () => {
    const status = await MC.getInitStatus();
    if (status.java_ok && status.instances.every((i) => i.installed)) {
      $('setup-overlay').style.display = 'none';
      showMain(config);
    } else {
      const btn = $<HTMLButtonElement>('install-btn');
      btn.textContent = 'Retry';
      btn.disabled = false;
    }
  });
}

function renderSteps(initStatus: InitStatus, config: LauncherConfig): void {
  const steps = [
    { id: 'java', name: 'Java JRE', installed: initStatus.java_ok },
    ...config.instances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      installed:
        initStatus.instances.find((i) => i.id === inst.id)?.installed ?? false,
    })),
  ];
  $('steps-container').innerHTML = steps
    .map(
      (s) => `
        <div class="step">
          <div class="step-name" style="color:${s.installed ? '#4caf50' : '#aaa'}">
            ${s.installed ? '✓' : '○'}  ${s.name}
          </div>
          <div class="bar-track"><div class="bar-fill" id="bar-${s.id}" style="width:${s.installed ? 100 : 0}%"></div></div>
          <div class="step-label" id="lbl-${s.id}">${s.installed ? 'Installed' : ''}</div>
        </div>
      `,
    )
    .join('');
}

async function onInstall(): Promise<void> {
  const dir = $<HTMLInputElement>('dir-input').value.trim();
  if (!dir) {
    $('setup-error').textContent = 'Choose an install folder.';
    return;
  }
  const btn = $<HTMLButtonElement>('install-btn');
  btn.disabled = true;
  btn.textContent = 'Installing…';
  $('setup-error').textContent = '';

  try {
    const settings = await MC.getSettings();
    await MC.saveSettings({ ...settings, launcher_dir: dir });
    await MC.runSetup();
  } catch (e) {
    $('setup-error').textContent = `Error: ${e}`;
    btn.disabled = false;
    btn.textContent = 'Retry';
  }
}
