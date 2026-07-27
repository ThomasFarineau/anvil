import { A, useNavigate, useParams } from '@solidjs/router';
import { createResource, createSignal, For, Show } from 'solid-js';

import { FiChevronDown, FiExternalLink, FiFilter } from 'solid-icons/fi';

import { confirmDialog } from '../alerts';
import {
  api,
  del,
  errorMessage,
  formatDate,
  formatSize,
  post,
  put,
  upload,
  type Instance,
  type ModpackRef,
} from '../api';
import { t } from '../i18n';
import { usePopover } from '../popover';

const modFilesTabClass = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm transition ${
    active ? 'bg-surface text-accent' : 'text-slate-400 hover:text-slate-200'
  }`;

const matches = (haystack: string, query: string) =>
  haystack.toLowerCase().includes(query.trim().toLowerCase());

// '' = tous, '__manual__' = sans modpack, sinon la clé du modpack.
const matchesPackFilter = (source: string | undefined, filter: string) =>
  filter === '' || (filter === '__manual__' ? !source : source === filter);

function PackFilterMenu(props: {
  value: string;
  onChange: (value: string) => void;
  options: { key: string; label: string }[];
}) {
  const { open, setOpen, setRef } = usePopover();
  const current = () =>
    props.options.find((o) => o.key === props.value)?.label ??
    props.options[0]?.label;

  return (
    <div class="relative" ref={setRef}>
      <button type="button" class="btn-ghost" onClick={() => setOpen(!open())}>
        <FiFilter />
        <span class="max-w-40 truncate">{current()}</span>
        <FiChevronDown />
      </button>
      <Show when={open()}>
        <div class="absolute left-0 z-10 mt-2 w-56 rounded-lg border border-edge bg-panel p-1 shadow-lg">
          <For each={props.options}>
            {(opt) => (
              <button
                type="button"
                class={`block w-full truncate rounded-md px-3 py-1.5 text-left text-sm transition ${
                  props.value === opt.key
                    ? 'text-accent'
                    : 'text-slate-300 hover:bg-surface hover:text-accent'
                }`}
                onClick={() => {
                  props.onChange(opt.key);
                  setOpen(false);
                }}>
                {opt.label}
              </button>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

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

  // ── Modpacks (Modrinth / CurseForge, fusionnables) ───────────────
  const [modpackPlatform, setModpackPlatform] = createSignal<
    'modrinth' | 'curseforge'
  >('modrinth');
  const [modpackQuery, setModpackQuery] = createSignal('');
  const [modpackVersion, setModpackVersion] = createSignal('');
  const [modpackImporting, setModpackImporting] = createSignal(false);

  const importModpack = async (event: Event) => {
    event.preventDefault();
    if (!modpackQuery() || !modpackVersion()) return;
    setModpackImporting(true);
    try {
      const result = await post<{ warnings: string[] }>(
        `/api/instances/${params.id}/modpack/import`,
        {
          platform: modpackPlatform(),
          query: modpackQuery(),
          version: modpackVersion(),
        },
      );
      setModpackQuery('');
      setModpackVersion('');
      flash(
        result.warnings.length > 0
          ? t('instanceDetail.modpackWarnings', {
              count: result.warnings.length,
            })
          : t('instanceDetail.modpackImported'),
      );
      void refetch();
    } catch (error_) {
      fail(error_);
    } finally {
      setModpackImporting(false);
    }
  };

  const prefillResync = (pack: ModpackRef) => {
    setModpackPlatform(pack.platform);
    setModpackQuery(pack.id);
    // version_id (pas version_name) car c'est ce que resolveModrinthPack /
    // resolveCurseForgePack matchent en priorité (exact id) — garantit que
    // "Importer" sans y toucher retire bien la même version déjà installée.
    setModpackVersion(pack.version_id);
  };

  const unlinkModpack = async (key: string) => {
    if (!(await confirmDialog(t('instanceDetail.modpackConfirmUnlink')))) {
      return;
    }
    try {
      await del(
        `/api/instances/${params.id}/modpack/${encodeURIComponent(key)}`,
      );
      flash(t('instanceDetail.modpackUnlinked'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  // ── Mods / Fichiers : onglets + recherche ────────────────────────
  const [modFilesTab, setModFilesTab] = createSignal<'mods' | 'files'>('mods');
  const [modSearch, setModSearch] = createSignal('');
  const [fileSearch, setFileSearch] = createSignal('');
  const [modPackFilter, setModPackFilter] = createSignal('');
  const [filePackFilter, setFilePackFilter] = createSignal('');

  // ── Mods ───────────────────────────────────────────────────────
  const [modFileInput, setModFileInput] = createSignal<HTMLInputElement>();
  const [modUrl, setModUrl] = createSignal('');
  const [selectedMods, setSelectedMods] = createSignal<Set<string>>(new Set());

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

  const toggleMod = (fileName: string) => {
    setSelectedMods((prev): Set<string> => {
      const next = new Set(prev);
      if (next.has(fileName)) next.delete(fileName);
      else next.add(fileName);
      return next;
    });
  };

  const toggleAllMods = (fileNames: string[]) => {
    setSelectedMods(
      (prev): Set<string> =>
        prev.size === fileNames.length ? new Set<string>() : new Set(fileNames),
    );
  };

  const bulkDeleteMods = async () => {
    const names = [...selectedMods()];
    if (names.length === 0) return;
    if (
      !(await confirmDialog(
        t('instanceDetail.confirmBulkDeleteMods', { count: names.length }),
        { danger: true },
      ))
    ) {
      return;
    }
    try {
      await post(`/api/instances/${params.id}/mods/bulk-delete`, {
        file_names: names,
      });
      setSelectedMods(new Set<string>());
      flash(t('instanceDetail.bulkDeleted', { count: names.length }));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  // ── Fichiers de config ─────────────────────────────────────────
  const [cfgFileInput, setCfgFileInput] = createSignal<HTMLInputElement>();
  const [cfgPath, setCfgPath] = createSignal('');
  const [selectedFiles, setSelectedFiles] = createSignal<Set<string>>(
    new Set(),
  );

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

  const toggleFile = (path: string) => {
    setSelectedFiles((prev): Set<string> => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleAllFiles = (paths: string[]) => {
    setSelectedFiles(
      (prev): Set<string> =>
        prev.size === paths.length ? new Set<string>() : new Set(paths),
    );
  };

  const bulkDeleteFiles = async () => {
    const paths = [...selectedFiles()];
    if (paths.length === 0) return;
    if (
      !(await confirmDialog(
        t('instanceDetail.confirmBulkDeleteFiles', { count: paths.length }),
        { danger: true },
      ))
    ) {
      return;
    }
    try {
      await post(`/api/instances/${params.id}/files/bulk-delete`, { paths });
      setSelectedFiles(new Set<string>());
      flash(t('instanceDetail.bulkDeleted', { count: paths.length }));
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
              {t('instanceDetail.modpackTitle')}
            </h2>
            <Show when={instance().modpacks.length === 0}>
              <p class="mb-4 text-sm text-slate-400">
                {t('instanceDetail.modpackNone')}
              </p>
            </Show>
            <Show
              when={
                instance().modpacks.filter((p) => !p.unlinkedAt).length > 0
              }>
              <ul class="mb-4 divide-y divide-edge">
                <For each={instance().modpacks.filter((p) => !p.unlinkedAt)}>
                  {(pack) => (
                    <li class="flex items-center justify-between py-2">
                      <p class="text-sm text-slate-300">
                        {t('instanceDetail.modpackCurrent', {
                          platform: pack.platform,
                          name: pack.name,
                          version: pack.version_name,
                        })}
                      </p>
                      <div class="flex gap-2">
                        <Show when={pack.url}>
                          <a
                            class="btn-ghost"
                            href={pack.url ?? undefined}
                            target="_blank"
                            rel="noreferrer"
                            title={t('instanceDetail.modpackOpenLink')}>
                            <FiExternalLink />
                          </a>
                        </Show>
                        <button
                          class="btn-ghost"
                          onClick={() => prefillResync(pack)}>
                          {t('instanceDetail.modpackResync')}
                        </button>
                        <button
                          class="btn-ghost"
                          onClick={() => void unlinkModpack(pack.key)}>
                          {t('instanceDetail.modpackUnlink')}
                        </button>
                      </div>
                    </li>
                  )}
                </For>
              </ul>
            </Show>
            <Show
              when={instance().modpacks.filter((p) => p.unlinkedAt).length > 0}>
              <details class="mb-4">
                <summary class="cursor-pointer text-sm text-slate-400">
                  {t('instanceDetail.modpackHistory', {
                    count: instance().modpacks.filter((p) => p.unlinkedAt)
                      .length,
                  })}
                </summary>
                <ul class="mt-2 divide-y divide-edge">
                  <For each={instance().modpacks.filter((p) => p.unlinkedAt)}>
                    {(pack) => (
                      <li class="flex items-center justify-between py-2">
                        <p class="text-sm text-slate-500">
                          {t('instanceDetail.modpackCurrent', {
                            platform: pack.platform,
                            name: pack.name,
                            version: pack.version_name,
                          })}
                        </p>
                        <div class="flex gap-2">
                          <Show when={pack.url}>
                            <a
                              class="btn-ghost"
                              href={pack.url ?? undefined}
                              target="_blank"
                              rel="noreferrer"
                              title={t('instanceDetail.modpackOpenLink')}>
                              <FiExternalLink />
                            </a>
                          </Show>
                          <button
                            class="btn-ghost"
                            onClick={() => prefillResync(pack)}>
                            {t('instanceDetail.modpackReimport')}
                          </button>
                        </div>
                      </li>
                    )}
                  </For>
                </ul>
              </details>
            </Show>
            <form
              class="flex flex-wrap items-end gap-2"
              onSubmit={(e) => void importModpack(e)}>
              <div>
                <label class="label">
                  {t('instanceDetail.modpackPlatform')}
                </label>
                <select
                  class="input"
                  value={modpackPlatform()}
                  onChange={(e) =>
                    setModpackPlatform(
                      e.currentTarget.value as 'modrinth' | 'curseforge',
                    )
                  }>
                  <option value="modrinth">Modrinth</option>
                  <option value="curseforge">CurseForge</option>
                </select>
              </div>
              <div class="flex-1">
                <label class="label">{t('instanceDetail.modpackQuery')}</label>
                <input
                  class="input w-full"
                  value={modpackQuery()}
                  onInput={(e) => setModpackQuery(e.currentTarget.value)}
                />
              </div>
              <div>
                <label class="label">
                  {t('instanceDetail.modpackVersion')}
                </label>
                <input
                  class="input"
                  value={modpackVersion()}
                  onInput={(e) => setModpackVersion(e.currentTarget.value)}
                />
              </div>
              <button class="btn" disabled={modpackImporting()}>
                {modpackImporting()
                  ? t('instanceDetail.modpackImporting')
                  : t('instanceDetail.modpackImport')}
              </button>
            </form>
          </section>

          <section class="panel">
            <div class="mb-4 flex gap-1 rounded-md border border-edge p-1">
              <button
                type="button"
                class={modFilesTabClass(modFilesTab() === 'mods')}
                onClick={() => setModFilesTab('mods')}>
                {t('instanceDetail.mods', { count: instance().mods.length })}
              </button>
              <button
                type="button"
                class={modFilesTabClass(modFilesTab() === 'files')}
                onClick={() => setModFilesTab('files')}>
                {t('instanceDetail.filesTitle', {
                  count: instance().files.length,
                })}
              </button>
            </div>

            <Show when={modFilesTab() === 'mods'}>
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
                {(() => {
                  const packName = (source?: string) =>
                    instance().modpacks.find((p) => p.key === source)?.name;
                  const packOptions = () => [
                    ...new Set(
                      instance()
                        .mods.map((m) => m.source)
                        .filter((s): s is string => Boolean(s)),
                    ),
                  ];
                  const filtered = () =>
                    instance().mods.filter(
                      (m) =>
                        (!modSearch() ||
                          matches(m.name, modSearch()) ||
                          matches(m.file_name, modSearch())) &&
                        matchesPackFilter(m.source, modPackFilter()),
                    );
                  return (
                    <>
                      <div class="mb-3 flex flex-wrap gap-2">
                        <input
                          class="input flex-1"
                          placeholder={t('instanceDetail.searchMods')}
                          value={modSearch()}
                          onInput={(e) => setModSearch(e.currentTarget.value)}
                        />
                        <Show when={packOptions().length > 0}>
                          <PackFilterMenu
                            value={modPackFilter()}
                            onChange={setModPackFilter}
                            options={[
                              {
                                key: '',
                                label: t('instanceDetail.filterAllPacks'),
                              },
                              {
                                key: '__manual__',
                                label: t('instanceDetail.filterManual'),
                              },
                              ...packOptions().map((key) => ({
                                key,
                                label: packName(key) ?? key,
                              })),
                            ]}
                          />
                        </Show>
                      </div>
                      <Show
                        when={filtered().length > 0}
                        fallback={
                          <p class="text-sm text-slate-400">
                            {t('instanceDetail.noSearchResults')}
                          </p>
                        }>
                        <div class="mb-2 flex items-center gap-3">
                          <label class="flex items-center gap-2 text-sm text-slate-400">
                            <input
                              type="checkbox"
                              class="checkbox"
                              checked={
                                selectedMods().size === filtered().length
                              }
                              onChange={() =>
                                toggleAllMods(
                                  filtered().map((m) => m.file_name),
                                )
                              }
                            />
                            {t('instanceDetail.selectAll')}
                          </label>
                          <button
                            class="btn-danger"
                            classList={{ invisible: selectedMods().size === 0 }}
                            onClick={() => void bulkDeleteMods()}>
                            {t('instanceDetail.deleteSelected', {
                              count: selectedMods().size,
                            })}
                          </button>
                        </div>
                        <div class="overflow-x-auto">
                          <table class="w-full table-fixed border-collapse text-sm">
                            <thead>
                              <tr class="border-b border-edge text-left text-xs tracking-wide text-slate-500 uppercase">
                                <th class="w-8 py-2 pr-2 font-medium"></th>
                                <th class="py-2 pr-3 font-medium">
                                  {t('instanceDetail.colFile')}
                                </th>
                                <th class="w-28 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colSource')}
                                </th>
                                <th class="w-40 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colUpdated')}
                                </th>
                                <th class="w-32 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colModpack')}
                                </th>
                                <th class="w-20 py-2 pl-3 text-right font-medium">
                                  {t('instanceDetail.colActions')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <For each={filtered()}>
                                {(mod) => (
                                  <tr class="border-b border-edge/60 hover:bg-surface/60">
                                    <td class="py-2 pr-2">
                                      <input
                                        type="checkbox"
                                        class="checkbox"
                                        checked={selectedMods().has(
                                          mod.file_name,
                                        )}
                                        onChange={() =>
                                          toggleMod(mod.file_name)
                                        }
                                      />
                                    </td>
                                    <td class="max-w-0 overflow-hidden py-2 pr-3">
                                      <p
                                        class="truncate text-slate-200"
                                        title={mod.name}>
                                        {mod.name}
                                      </p>
                                      <p
                                        class="truncate text-xs text-slate-500"
                                        title={mod.file_name}>
                                        {mod.file_name} · {formatSize(mod.size)}
                                      </p>
                                    </td>
                                    <td class="py-2 pr-3 text-slate-400">
                                      {mod.url
                                        ? t('instanceDetail.modSourceExternal')
                                        : t('instanceDetail.modSourceHosted')}
                                    </td>
                                    <td class="py-2 pr-3 text-slate-400">
                                      {formatDate(mod.updatedAt)}
                                    </td>
                                    <td class="py-2 pr-3">
                                      <Show
                                        when={packName(mod.source)}
                                        fallback={
                                          <span class="block max-w-full truncate rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                                            {t('instanceDetail.userBasedTag')}
                                          </span>
                                        }>
                                        <span class="block max-w-full truncate rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent-soft">
                                          {packName(mod.source)}
                                        </span>
                                      </Show>
                                    </td>
                                    <td class="py-2 pl-3 text-right">
                                      <button
                                        class="btn-danger"
                                        onClick={() =>
                                          void removeMod(mod.file_name)
                                        }>
                                        {t('delete')}
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </For>
                            </tbody>
                          </table>
                        </div>
                      </Show>
                    </>
                  );
                })()}
              </Show>
            </Show>

            <Show when={modFilesTab() === 'files'}>
              <p class="mb-4 text-sm text-slate-400">
                {t('instanceDetail.filesHint')}{' '}
                <code class="ml-1 text-accent-soft">config/mymod.toml</code>).
              </p>
              <div class="mb-4 flex flex-wrap items-center gap-2">
                <input
                  ref={setCfgFileInput}
                  type="file"
                  class="input max-w-60"
                />
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
                {(() => {
                  const packName = (source?: string) =>
                    instance().modpacks.find((p) => p.key === source)?.name;
                  const packOptions = () => [
                    ...new Set(
                      instance()
                        .files.map((f) => f.source)
                        .filter((s): s is string => Boolean(s)),
                    ),
                  ];
                  const filtered = () =>
                    instance().files.filter(
                      (f) =>
                        (!fileSearch() || matches(f.path, fileSearch())) &&
                        matchesPackFilter(f.source, filePackFilter()),
                    );
                  return (
                    <>
                      <div class="mb-3 flex flex-wrap gap-2">
                        <input
                          class="input flex-1"
                          placeholder={t('instanceDetail.searchFiles')}
                          value={fileSearch()}
                          onInput={(e) => setFileSearch(e.currentTarget.value)}
                        />
                        <Show when={packOptions().length > 0}>
                          <PackFilterMenu
                            value={filePackFilter()}
                            onChange={setFilePackFilter}
                            options={[
                              {
                                key: '',
                                label: t('instanceDetail.filterAllPacks'),
                              },
                              {
                                key: '__manual__',
                                label: t('instanceDetail.filterManual'),
                              },
                              ...packOptions().map((key) => ({
                                key,
                                label: packName(key) ?? key,
                              })),
                            ]}
                          />
                        </Show>
                      </div>
                      <Show
                        when={filtered().length > 0}
                        fallback={
                          <p class="text-sm text-slate-400">
                            {t('instanceDetail.noSearchResults')}
                          </p>
                        }>
                        <div class="mb-2 flex items-center gap-3">
                          <label class="flex items-center gap-2 text-sm text-slate-400">
                            <input
                              type="checkbox"
                              class="checkbox"
                              checked={
                                selectedFiles().size === filtered().length
                              }
                              onChange={() =>
                                toggleAllFiles(filtered().map((f) => f.path))
                              }
                            />
                            {t('instanceDetail.selectAll')}
                          </label>
                          <button
                            class="btn-danger"
                            classList={{
                              invisible: selectedFiles().size === 0,
                            }}
                            onClick={() => void bulkDeleteFiles()}>
                            {t('instanceDetail.deleteSelected', {
                              count: selectedFiles().size,
                            })}
                          </button>
                        </div>
                        <div class="overflow-x-auto">
                          <table class="w-full table-fixed border-collapse text-sm">
                            <thead>
                              <tr class="border-b border-edge text-left text-xs tracking-wide text-slate-500 uppercase">
                                <th class="w-8 py-2 pr-2 font-medium"></th>
                                <th class="py-2 pr-3 font-medium">
                                  {t('instanceDetail.colFile')}
                                </th>
                                <th class="w-28 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colSource')}
                                </th>
                                <th class="w-40 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colUpdated')}
                                </th>
                                <th class="w-32 py-2 pr-3 font-medium">
                                  {t('instanceDetail.colModpack')}
                                </th>
                                <th class="w-20 py-2 pl-3 text-right font-medium">
                                  {t('instanceDetail.colActions')}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              <For each={filtered()}>
                                {(file) => (
                                  <tr class="border-b border-edge/60 hover:bg-surface/60">
                                    <td class="py-2 pr-2">
                                      <input
                                        type="checkbox"
                                        class="checkbox"
                                        checked={selectedFiles().has(file.path)}
                                        onChange={() => toggleFile(file.path)}
                                      />
                                    </td>
                                    <td class="max-w-0 overflow-hidden py-2 pr-3">
                                      <p
                                        class="truncate text-slate-200"
                                        title={file.path}>
                                        {file.path}
                                      </p>
                                      <p class="text-xs text-slate-500">
                                        {formatSize(file.size)}
                                      </p>
                                    </td>
                                    <td class="py-2 pr-3 text-slate-400">
                                      {t('instanceDetail.modSourceHosted')}
                                    </td>
                                    <td class="py-2 pr-3 text-slate-400">
                                      {formatDate(file.updatedAt)}
                                    </td>
                                    <td class="py-2 pr-3">
                                      <Show
                                        when={packName(file.source)}
                                        fallback={
                                          <span class="block max-w-full truncate rounded-full bg-slate-500/10 px-1.5 py-0.5 text-[10px] text-slate-400">
                                            {t('instanceDetail.userBasedTag')}
                                          </span>
                                        }>
                                        <span class="block max-w-full truncate rounded-full bg-accent/10 px-1.5 py-0.5 text-[10px] text-accent-soft">
                                          {packName(file.source)}
                                        </span>
                                      </Show>
                                    </td>
                                    <td class="py-2 pl-3 text-right">
                                      <button
                                        class="btn-danger"
                                        onClick={() =>
                                          void removeCfg(file.path)
                                        }>
                                        {t('delete')}
                                      </button>
                                    </td>
                                  </tr>
                                )}
                              </For>
                            </tbody>
                          </table>
                        </div>
                      </Show>
                    </>
                  );
                })()}
              </Show>
            </Show>
          </section>
        </div>
      )}
    </Show>
  );
}
