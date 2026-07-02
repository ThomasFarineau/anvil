<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { MC } from './api.js';
import type { InitStatus, LauncherConfig } from './api.js';

const view = ref<'loading' | 'setup' | 'main'>('loading');
const config = ref<LauncherConfig | null>(null);
const status = ref<InitStatus | null>(null);
const username = ref('');
const dir = ref('');
const progress = reactive<
  Record<string, { pct: number; label: string; error: boolean }>
>({});
const installing = ref(false);
const running = ref<string[]>([]);
const message = ref('');
const error = ref('');

const steps = computed(() => {
  if (!config.value || !status.value) return [];
  return [
    { id: 'java', name: 'Java JRE', installed: status.value.java_ok },
    ...config.value.instances.map((inst) => ({
      id: inst.id,
      name: inst.name,
      installed:
        status.value.instances.find((i) => i.id === inst.id)?.installed ??
        false,
    })),
  ];
});

onMounted(async () => {
  const [cfg, settings, init] = await Promise.all([
    MC.getConfig(),
    MC.getSettings(),
    MC.getInitStatus(),
  ]);
  document.title = cfg.app_name;
  config.value = cfg;
  status.value = init;
  username.value = settings.username ?? '';
  dir.value = init.launcher_dir;
  view.value =
    init.java_ok && init.instances.every((i) => i.installed) ? 'main' : 'setup';

  MC.on.setupProgress(({ step, current, total, label, error: err }) => {
    progress[step] = {
      pct: total > 0 ? Math.round((current * 100) / total) : 0,
      label,
      error: err,
    };
  });
  MC.on.setupDone(async () => {
    const s = await MC.getInitStatus();
    status.value = s;
    installing.value = false;
    if (s.java_ok && s.instances.every((i) => i.installed)) {
      view.value = 'main';
    }
  });
  MC.on.gameStarting((id) => running.value.push(id));
  MC.on.gameExit(({ instance_id, code }) => {
    running.value = running.value.filter((x) => x !== instance_id);
    message.value = code === 0 ? 'Session ended.' : `Exited with code ${code}.`;
  });
});

async function setDefaultDir() {
  dir.value = await MC.getDefaultDir();
}

async function install() {
  if (!dir.value.trim()) {
    error.value = 'Choose an install folder.';
    return;
  }
  error.value = '';
  installing.value = true;
  try {
    const settings = await MC.getSettings();
    await MC.saveSettings({ ...settings, launcher_dir: dir.value.trim() });
    await MC.runSetup();
  } catch (e) {
    error.value = `Error: ${e}`;
    installing.value = false;
  }
}

async function playOrStop(id: string) {
  if (running.value.includes(id)) {
    await MC.stop(id).catch(() => {});
    return;
  }
  if (!username.value.trim()) return;
  const settings = await MC.getSettings();
  await MC.saveSettings({ ...settings, username: username.value.trim() });
  try {
    await MC.verify(id);
    await MC.play(id);
  } catch (e) {
    message.value = `Error: ${e}`;
  }
}
</script>

<template>
  <div v-if="view === 'setup'" id="setup-overlay">
    <div class="card">
      <h1>Setup — {{ config.app_name }}</h1>
      <label>Install folder</label>
      <div class="dir-row">
        <input v-model="dir" type="text" />
        <button @click="setDefaultDir">Default</button>
      </div>
      <div v-for="s in steps" :key="s.id" class="step">
        <div
          class="step-name"
          :style="{ color: s.installed ? '#4caf50' : '#aaa' }">
          {{ s.installed ? '✓' : '○' }} {{ s.name }}
        </div>
        <div class="bar-track">
          <div
            class="bar-fill"
            :style="{
              width: `${progress[s.id]?.pct ?? (s.installed ? 100 : 0)}%`,
              background: progress[s.id]?.error ? '#ef5350' : '#4caf50',
            }" />
        </div>
        <div class="step-label">
          {{ progress[s.id]?.label ?? (s.installed ? 'Installed' : '') }}
        </div>
      </div>
      <button class="install-btn" :disabled="installing" @click="install">
        {{ installing ? 'Installing…' : 'Install' }}
      </button>
      <p class="status" style="color: #ef5350">{{ error }}</p>
    </div>
  </div>

  <div v-else-if="view === 'main'" class="card">
    <div class="brand">
      <img v-if="config.logo" :src="`./${config.logo}`" alt="" />
      <h1>{{ config.app_name }}</h1>
    </div>
    <label>Username</label>
    <input v-model="username" type="text" maxlength="16" placeholder="Steve" />
    <button
      v-for="inst in config.instances"
      :key="inst.id"
      class="instance-btn"
      :disabled="!running.includes(inst.id) && !username.trim()"
      @click="playOrStop(inst.id)">
      {{ running.includes(inst.id) ? '■  Stop' : `▶  ${inst.name}` }}
    </button>
    <p class="status">{{ message }}</p>
  </div>
</template>
