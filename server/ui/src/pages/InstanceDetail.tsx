import { A, useNavigate, useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show } from 'solid-js';

import { confirmDialog } from '../alerts';
import {
  api,
  del,
  errorMessage,
  formatSize,
  put,
  upload,
  type Instance,
} from '../api';
import { t } from '../i18n';

export default function InstanceDetail() {
  const params = useParams();
  const navigate = useNavigate();
  const [inst, { refetch }] = createResource(
    () => params.id,
    (id) => api<Instance>(`/api/instances/${id}`),
  );
  const [message, setMessage] = createSignal('');
  const [error, setError] = createSignal('');

  const flash = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };
  const fail = (error_: unknown) => {
    setMessage('');
    setError(errorMessage(error_));
  };

  // ── Champs généraux ────────────────────────────────────────────
  const saveFields = async (event: Event) => {
    event.preventDefault();
    const form = new FormData(event.target as HTMLFormElement);
    try {
      await put(`/api/instances/${params.id}`, {
        name: String(form.get('name') ?? ''),
        mc_version: String(form.get('mc_version') ?? ''),
        loader: String(form.get('loader') ?? ''),
        loader_version: String(form.get('loader_version') ?? ''),
        server_ip: String(form.get('server_ip') ?? ''),
        server_port: Number(form.get('server_port') ?? 25565),
      });
      flash(t('instanceDetail.saved'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  // ── Mods ───────────────────────────────────────────────────────
  const [modFileInput, setModFileInput] = createSignal<HTMLInputElement>();
  const [modUrl, setModUrl] = createSignal('');

  const uploadMod = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      await upload(`/api/instances/${params.id}/mods`, form);
      flash(t('instanceDetail.modAdded', { name: file.name }));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const addModUrl = async () => {
    if (!modUrl()) return;
    const form = new FormData();
    form.append('url', modUrl());
    try {
      await upload(`/api/instances/${params.id}/mods`, form);
      setModUrl('');
      flash(t('instanceDetail.modAddedUrl'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const removeMod = async (fileName: string) => {
    try {
      await del(
        `/api/instances/${params.id}/mods/${encodeURIComponent(fileName)}`,
      );
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  // ── Fichiers de config ─────────────────────────────────────────
  const [cfgFileInput, setCfgFileInput] = createSignal<HTMLInputElement>();
  const [cfgPath, setCfgPath] = createSignal('');

  const uploadCfg = async () => {
    const file = cfgFileInput()?.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    form.append('path', cfgPath() || `config/${file.name}`);
    try {
      await upload(`/api/instances/${params.id}/files`, form);
      setCfgPath('');
      const input = cfgFileInput();
      if (input) input.value = '';
      flash(t('instanceDetail.fileSent'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const removeCfg = async (path: string) => {
    try {
      await del(
        `/api/instances/${params.id}/files?path=${encodeURIComponent(path)}`,
      );
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const toggleEnabled = async (current: Instance) => {
    try {
      await put(`/api/instances/${params.id}`, { enabled: !current.enabled });
      flash(
        current.enabled
          ? t('instanceDetail.disabledMsg')
          : t('instanceDetail.enabledMsg'),
      );
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const removeInstance = async () => {
    if (
      !(await confirmDialog(
        t('instanceDetail.confirmDelete', { id: params.id ?? '' }),
        { danger: true },
      ))
    ) {
      return;
    }
    await del(`/api/instances/${params.id}`).catch(fail);
    navigate('/');
  };

  return (
    <Show when={inst()} fallback={<p class="text-slate-400">{t('loading')}</p>}>
      {(instance) => (
        <div class="mx-auto max-w-4xl">
          <div class="mb-6 flex items-center justify-between">
            <div>
              <A href="/" class="text-sm text-slate-400 hover:text-accent">
                {t('instanceDetail.back')}
              </A>
              <h1 class="text-2xl font-semibold text-slate-100">
                {instance().name}{' '}
                <code class="text-base text-accent-soft">{instance()._id}</code>
                <Show when={!instance().enabled}>
                  <span class="ml-2 align-middle text-sm text-slate-500">
                    {t('instanceDetail.disabledSuffix')}
                  </span>
                </Show>
              </h1>
            </div>
            <div class="flex gap-2">
              <button
                class="btn-ghost"
                onClick={() => void toggleEnabled(instance())}>
                {instance().enabled
                  ? t('instanceDetail.disable')
                  : t('instanceDetail.enable')}
              </button>
              <button class="btn-danger" onClick={removeInstance}>
                {t('instanceDetail.delete')}
              </button>
            </div>
          </div>

          <Show when={message()}>
            <p class="mb-4 text-sm text-emerald-400">{message()}</p>
          </Show>
          <Show when={error()}>
            <p class="mb-4 text-sm text-red-400">{error()}</p>
          </Show>

          <form class="panel mb-6 grid grid-cols-2 gap-4" onSubmit={saveFields}>
            <h2 class="col-span-2 font-medium text-slate-100">
              {t('instanceDetail.general')}
            </h2>
            <div>
              <label class="label">{t('instanceDetail.name')}</label>
              <input class="input" name="name" value={instance().name} />
            </div>
            <div>
              <label class="label">{t('instanceDetail.mcVersion')}</label>
              <input
                class="input"
                name="mc_version"
                value={instance().mc_version}
              />
            </div>
            <div>
              <label class="label">{t('instanceDetail.loader')}</label>
              <select class="input" name="loader" value={instance().loader}>
                <option value="">Vanilla</option>
                <option value="fabric">Fabric</option>
                <option value="forge">Forge</option>
                <option value="neoforge">NeoForge</option>
                <option value="quilt">Quilt</option>
              </select>
            </div>
            <div>
              <label class="label">{t('instanceDetail.loaderVersion')}</label>
              <input
                class="input"
                name="loader_version"
                value={instance().loader_version}
                placeholder="0.16.9"
              />
            </div>
            <div>
              <label class="label">{t('instanceDetail.serverIp')}</label>
              <input
                class="input"
                name="server_ip"
                value={instance().server_ip}
              />
            </div>
            <div>
              <label class="label">{t('instanceDetail.serverPort')}</label>
              <input
                class="input"
                name="server_port"
                type="number"
                value={instance().server_port}
              />
            </div>
            <div class="col-span-2">
              <button class="btn">{t('instanceDetail.save')}</button>
            </div>
          </form>

          <section class="panel mb-6">
            <h2 class="mb-4 font-medium text-slate-100">
              {t('instanceDetail.mods', { count: instance().mods.length })}
            </h2>
            <div class="mb-4 flex flex-wrap gap-2">
              <input
                ref={setModFileInput}
                type="file"
                accept=".jar"
                class="hidden"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  if (file) void uploadMod(file);
                  e.currentTarget.value = '';
                }}
              />
              <button class="btn" onClick={() => modFileInput()?.click()}>
                {t('instanceDetail.uploadJar')}
              </button>
              <input
                class="input max-w-xs flex-1"
                placeholder="https://…/mod.jar"
                value={modUrl()}
                onInput={(e) => setModUrl(e.currentTarget.value)}
              />
              <button class="btn-ghost" onClick={() => void addModUrl()}>
                {t('instanceDetail.addFromUrl')}
              </button>
            </div>
            <Show
              when={instance().mods.length > 0}
              fallback={
                <p class="text-sm text-slate-400">
                  {t('instanceDetail.noMods')}
                </p>
              }>
              <ul class="divide-y divide-edge">
                <For each={instance().mods}>
                  {(mod) => (
                    <li class="flex items-center justify-between py-2">
                      <div>
                        <p class="text-sm text-slate-200">{mod.name}</p>
                        <p class="text-xs text-slate-500">
                          {mod.file_name} · {formatSize(mod.size)} ·{' '}
                          {mod.url
                            ? t('instanceDetail.modSourceExternal')
                            : t('instanceDetail.modSourceHosted')}
                        </p>
                      </div>
                      <button
                        class="btn-danger"
                        onClick={() => void removeMod(mod.file_name)}>
                        {t('delete')}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>

          <section class="panel">
            <h2 class="mb-1 font-medium text-slate-100">
              {t('instanceDetail.filesTitle', {
                count: instance().files.length,
              })}
            </h2>
            <p class="mb-4 text-sm text-slate-400">
              {t('instanceDetail.filesHint')}{' '}
              <code class="ml-1 text-accent-soft">config/mymod.toml</code>).
            </p>
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <input ref={setCfgFileInput} type="file" class="input max-w-60" />
              <input
                class="input max-w-xs flex-1"
                placeholder={t('instanceDetail.pathPlaceholder')}
                value={cfgPath()}
                onInput={(e) => setCfgPath(e.currentTarget.value)}
              />
              <button class="btn" onClick={() => void uploadCfg()}>
                {t('instanceDetail.send')}
              </button>
            </div>
            <Show
              when={instance().files.length > 0}
              fallback={
                <p class="text-sm text-slate-400">
                  {t('instanceDetail.noFiles')}
                </p>
              }>
              <ul class="divide-y divide-edge">
                <For each={instance().files}>
                  {(file) => (
                    <li class="flex items-center justify-between py-2">
                      <div>
                        <p class="text-sm text-slate-200">{file.path}</p>
                        <p class="text-xs text-slate-500">
                          {formatSize(file.size)}
                        </p>
                      </div>
                      <button
                        class="btn-danger"
                        onClick={() => void removeCfg(file.path)}>
                        {t('delete')}
                      </button>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
          </section>
        </div>
      )}
    </Show>
  );
}
