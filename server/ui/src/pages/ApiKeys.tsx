import { createResource, createSignal, For, Show } from 'solid-js';

import { api, del, errorMessage, post, type ApiKeyRow } from '../api';

export default function ApiKeys() {
  const [list, { refetch }] = createResource(() =>
    api<ApiKeyRow[]>('/api/keys'),
  );
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [name, setName] = createSignal('');

  const flash = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };

  const create = async (event: Event) => {
    event.preventDefault();
    try {
      await post('/api/keys', { name: name() });
      setName('');
      flash('Clé créée.');
      void refetch();
    } catch (error_) {
      setMessage('');
      setError(errorMessage(error_));
    }
  };

  const copy = async (key: string) => {
    await navigator.clipboard.writeText(key).catch(() => {});
    flash('Clé copiée dans le presse-papier.');
  };

  const remove = async (row: ApiKeyRow) => {
    if (
      !confirm(
        `Révoquer la clé « ${row.name} » ? Les launchers qui l'utilisent ne pourront plus contacter ce serveur.`,
      )
    ) {
      return;
    }
    try {
      await del(`/api/keys/${row.id}`);
      void refetch();
    } catch (error_) {
      setError(errorMessage(error_));
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">Clés API</h1>
      <p class="mb-6 text-sm text-slate-400">
        L'API launcher (instances, sessions, téléchargements) exige une clé.
        Renseignez-la dans le champ{' '}
        <code class="text-accent-soft">"anvil-key"</code> du config.json du
        launcher.
      </p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">Nom (ex : launcher-prod)</label>
          <input
            class="input"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <button class="btn">Générer une clé</button>
      </form>

      <Show when={message()}>
        <p class="mb-4 text-sm text-emerald-400">{message()}</p>
      </Show>
      <Show when={error()}>
        <p class="mb-4 text-sm text-red-400">{error()}</p>
      </Show>

      <div class="grid gap-3">
        <For each={list()}>
          {(row) => (
            <div class="panel flex flex-wrap items-center justify-between gap-3">
              <div class="min-w-0">
                <p class="font-medium text-slate-100">{row.name}</p>
                <code class="block truncate text-xs text-slate-500">
                  {row.key}
                </code>
                <p class="mt-1 text-xs text-slate-500">
                  {row.lastUsedAt
                    ? `Dernière utilisation : ${new Date(row.lastUsedAt).toLocaleString()}`
                    : 'Jamais utilisée'}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn-ghost px-2 py-1 text-xs"
                  onClick={() => void copy(row.key)}>
                  Copier
                </button>
                <button class="btn-danger" onClick={() => void remove(row)}>
                  Révoquer
                </button>
              </div>
            </div>
          )}
        </For>
        <Show when={(list() ?? []).length === 0}>
          <div class="panel text-center text-sm text-slate-400">
            Aucune clé. Sans clé, aucun launcher ne peut utiliser ce serveur.
          </div>
        </Show>
      </div>
    </div>
  );
}
