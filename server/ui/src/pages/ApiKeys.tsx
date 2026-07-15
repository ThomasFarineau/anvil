import { createResource, createSignal, For, Show } from 'solid-js';

import { confirmDialog } from '../alerts';
import { api, del, errorMessage, post, type ApiKeyRow } from '../api';
import { t } from '../i18n';

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
      flash(t('apiKeys.created'));
      void refetch();
    } catch (error_) {
      setMessage('');
      setError(errorMessage(error_));
    }
  };

  const copy = async (key: string) => {
    await navigator.clipboard.writeText(key).catch(() => {});
    flash(t('apiKeys.copied'));
  };

  const remove = async (row: ApiKeyRow) => {
    if (
      !(await confirmDialog(t('apiKeys.confirmRevoke', { name: row.name }), {
        danger: true,
      }))
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
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">
        {t('apiKeys.title')}
      </h1>
      <p class="mb-6 text-sm text-slate-400">
        {t('apiKeys.subtitle')}{' '}
        <code class="text-accent-soft">"anvil-key"</code>{' '}
        {t('apiKeys.subtitleEnd')}
      </p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">{t('apiKeys.nameLabel')}</label>
          <input
            class="input"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
          />
        </div>
        <button class="btn">{t('apiKeys.generate')}</button>
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
                    ? t('apiKeys.lastUsed', {
                        date: new Date(row.lastUsedAt).toLocaleString(),
                      })
                    : t('apiKeys.neverUsed')}
                </p>
              </div>
              <div class="flex gap-2">
                <button
                  class="btn-ghost px-2 py-1 text-xs"
                  onClick={() => void copy(row.key)}>
                  {t('apiKeys.copy')}
                </button>
                <button class="btn-danger" onClick={() => void remove(row)}>
                  {t('apiKeys.revoke')}
                </button>
              </div>
            </div>
          )}
        </For>
        <Show when={(list() ?? []).length === 0}>
          <div class="panel text-center text-sm text-slate-400">
            {t('apiKeys.empty')}
          </div>
        </Show>
      </div>
    </div>
  );
}
