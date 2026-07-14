import { A } from '@solidjs/router';
import { createResource, createSignal, For, Show } from 'solid-js';

import { api, errorMessage, post, type Instance } from '../api';

export default function Instances() {
  const [list, { refetch }] = createResource(() =>
    api<Instance[]>('/api/instances'),
  );
  const [showForm, setShowForm] = createSignal(false);
  const [error, setError] = createSignal('');
  const [id, setId] = createSignal('');
  const [name, setName] = createSignal('');
  const [mcVersion, setMcVersion] = createSignal('');
  const [loader, setLoader] = createSignal('');

  const create = async (event: Event) => {
    event.preventDefault();
    setError('');
    try {
      await post('/api/instances', {
        id: id(),
        name: name(),
        mc_version: mcVersion(),
        loader: loader(),
      });
      setShowForm(false);
      setId('');
      setName('');
      setMcVersion('');
      setLoader('');
      void refetch();
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-semibold text-slate-100">Instances</h1>
        <button class="btn" onClick={() => setShowForm(!showForm())}>
          + Nouvelle instance
        </button>
      </div>

      <Show when={showForm()}>
        <form class="panel mb-6 grid grid-cols-2 gap-4" onSubmit={create}>
          <div>
            <label class="label">ID (utilisé dans config.json)</label>
            <input
              class="input"
              value={id()}
              onInput={(e) => setId(e.currentTarget.value)}
              placeholder="server-exemple"
            />
          </div>
          <div>
            <label class="label">Nom affiché</label>
            <input
              class="input"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder="Survie 1.21"
            />
          </div>
          <div>
            <label class="label">Version Minecraft</label>
            <input
              class="input"
              value={mcVersion()}
              onInput={(e) => setMcVersion(e.currentTarget.value)}
              placeholder="1.21.4"
            />
          </div>
          <div>
            <label class="label">Loader</label>
            <select
              class="input"
              value={loader()}
              onInput={(e) => setLoader(e.currentTarget.value)}>
              <option value="">Vanilla</option>
              <option value="fabric">Fabric</option>
              <option value="forge">Forge</option>
              <option value="neoforge">NeoForge</option>
              <option value="quilt">Quilt</option>
            </select>
          </div>
          <Show when={error()}>
            <p class="col-span-2 text-sm text-red-400">{error()}</p>
          </Show>
          <div class="col-span-2">
            <button class="btn">Créer</button>
          </div>
        </form>
      </Show>

      <Show
        when={(list() ?? []).length > 0}
        fallback={
          <div class="panel text-center text-slate-400">
            Aucune instance. Créez-en une pour la référencer dans le config.json
            du launcher.
          </div>
        }>
        <div class="grid gap-3">
          <For each={list()}>
            {(inst) => (
              <A
                href={`/instances/${inst._id}`}
                class="panel flex items-center justify-between transition hover:border-accent">
                <div>
                  <p class="font-medium text-slate-100">
                    {inst.name}
                    <Show when={!inst.enabled}>
                      <span class="ml-2 rounded-full border border-edge px-2 py-0.5 text-xs text-slate-500">
                        désactivée
                      </span>
                    </Show>
                  </p>
                  <p class="text-sm text-slate-400">
                    <code class="text-accent-soft">{inst._id}</code> · MC{' '}
                    {inst.mc_version}
                    {inst.loader ? ` · ${inst.loader}` : ' · vanilla'}
                  </p>
                </div>
                <div class="text-right text-sm text-slate-400">
                  <p>{inst.mods.length} mod(s)</p>
                  <p>{inst.files.length} fichier(s) de config</p>
                </div>
              </A>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
