import QRCode from 'qrcode';
import { createResource, createSignal, For, Show } from 'solid-js';

import { confirmDialog, promptDialog } from '../alerts';
import { api, del, errorMessage, post, type PlayerRow } from '../api';
import { t } from '../i18n';

interface TotpSetup {
  playerId: string;
  username: string;
  secret: string;
  qr: string;
}

export default function Players() {
  const [list, { refetch }] = createResource(() =>
    api<PlayerRow[]>('/api/players'),
  );
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [totpSetup, setTotpSetup] = createSignal<TotpSetup | null>(null);
  const [totpCode, setTotpCode] = createSignal('');
  const [newAuthKey, setNewAuthKey] = createSignal<{
    username: string;
    key: string;
  } | null>(null);

  const flash = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  };
  const fail = (error_: unknown) => {
    setMessage('');
    setError(errorMessage(error_));
  };

  const create = async (event: Event) => {
    event.preventDefault();
    try {
      await post('/api/players', {
        username: username(),
        password: password(),
      });
      setUsername('');
      setPassword('');
      flash(t('players.created'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetPassword = async (player: PlayerRow) => {
    const next = await promptDialog(
      t('players.resetPasswordPrompt', { username: player.username }),
      { inputType: 'password' },
    );
    if (!next) return;
    try {
      await post(`/api/players/${player.id}/password`, { password: next });
      flash(t('players.passwordReset'));
    } catch (error_) {
      fail(error_);
    }
  };

  const startTotp = async (player: PlayerRow) => {
    try {
      const data = await post<{ secret: string; uri: string }>(
        `/api/players/${player.id}/totp/setup`,
      );
      const qr = await QRCode.toDataURL(data.uri, { margin: 1, width: 192 });
      setTotpCode('');
      setTotpSetup({
        playerId: player.id,
        username: player.username,
        secret: data.secret,
        qr,
      });
    } catch (error_) {
      fail(error_);
    }
  };

  const confirmTotp = async (event: Event) => {
    event.preventDefault();
    const setup = totpSetup();
    if (!setup) return;
    try {
      await post(`/api/players/${setup.playerId}/totp/enable`, {
        code: totpCode(),
      });
      setTotpSetup(null);
      flash(t('players.totpEnabledFor', { username: setup.username }));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetTotp = async (player: PlayerRow) => {
    if (
      !(await confirmDialog(
        t('players.confirmResetTotp', { username: player.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await post(`/api/players/${player.id}/totp/reset`);
      flash(t('players.totpReset'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const useAuthKey = async (player: PlayerRow) => {
    try {
      const data = await post<{ authKey: string }>(
        `/api/players/${player.id}/authkey`,
      );
      setNewAuthKey({ username: player.username, key: data.authKey });
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key).catch(() => {});
    flash(t('apiKeys.copied'));
  };

  const resetAuthKey = async (player: PlayerRow) => {
    if (
      !(await confirmDialog(
        t('players.confirmResetAuthKey', { username: player.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await post(`/api/players/${player.id}/authkey/reset`);
      flash(t('players.authKeyReset'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const remove = async (player: PlayerRow) => {
    if (
      !(await confirmDialog(
        t('players.confirmDelete', { username: player.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await del(`/api/players/${player.id}`);
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">
        {t('players.title')}
      </h1>
      <p class="mb-6 text-sm text-slate-400">{t('players.subtitle')}</p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">{t('players.username')}</label>
          <input
            class="input"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div class="min-w-40 flex-1">
          <label class="label">{t('players.password')}</label>
          <input
            class="input"
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </div>
        <button class="btn">{t('players.create')}</button>
      </form>

      <Show when={message()}>
        <p class="mb-4 text-sm text-emerald-400">{message()}</p>
      </Show>
      <Show when={error()}>
        <p class="mb-4 text-sm text-red-400">{error()}</p>
      </Show>

      <Show when={totpSetup()}>
        {(setup) => (
          <form class="panel mb-6" onSubmit={confirmTotp}>
            <h2 class="mb-2 font-medium text-slate-100">
              {t('players.totpFor', { username: setup().username })}
            </h2>
            <p class="mb-3 text-sm text-slate-400">{t('players.totpHint')}</p>
            <img
              src={setup().qr}
              alt="TOTP QR code"
              class="mb-3 rounded-md bg-white p-2"
              width={192}
              height={192}
            />
            <p class="mb-4 text-xs text-slate-500">
              {t('players.secret')}: <code>{setup().secret}</code>
            </p>
            <div class="flex gap-2">
              <input
                class="input max-w-40 text-center tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
                value={totpCode()}
                onInput={(e) => setTotpCode(e.currentTarget.value)}
              />
              <button class="btn">{t('players.confirm')}</button>
              <button
                type="button"
                class="btn-ghost"
                onClick={() => setTotpSetup(null)}>
                {t('players.cancel')}
              </button>
            </div>
          </form>
        )}
      </Show>

      <Show when={newAuthKey()}>
        {(data) => (
          <div class="panel mb-6">
            <h2 class="mb-2 font-medium text-slate-100">
              {t('players.authKeyGenerated', { username: data().username })}
            </h2>
            <div class="mb-3 flex gap-2">
              <code class="input flex-1 truncate">{data().key}</code>
              <button
                type="button"
                class="btn-ghost"
                onClick={() => void copyKey(data().key)}>
                {t('apiKeys.copy')}
              </button>
            </div>
            <button class="btn" onClick={() => setNewAuthKey(null)}>
              {t('account.done')}
            </button>
          </div>
        )}
      </Show>

      <div class="panel overflow-x-auto p-0">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-edge text-xs text-slate-400 uppercase">
            <tr>
              <th class="px-4 py-3">{t('players.col.username')}</th>
              <th class="px-4 py-3">{t('players.col.uuid')}</th>
              <th class="px-4 py-3">{t('players.col.totp')}</th>
              <th class="px-4 py-3 text-right">{t('players.col.actions')}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-edge">
            <For each={list()}>
              {(player) => (
                <tr>
                  <td class="px-4 py-3 text-slate-200">{player.username}</td>
                  <td class="px-4 py-3">
                    <code class="text-xs text-slate-500">{player.uuid}</code>
                  </td>
                  <td class="px-4 py-3">
                    <Show
                      when={player.authMethod === 'authkey'}
                      fallback={
                        player.totpEnabled ? (
                          <span class="text-emerald-400">
                            {t('players.enabled')}
                          </span>
                        ) : (
                          <span class="text-slate-500">—</span>
                        )
                      }>
                      <span class="text-accent">
                        {t('players.methodAuthKey')}
                      </span>
                    </Show>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <Show
                        when={player.authMethod === 'authkey'}
                        fallback={
                          <>
                            <button
                              class="btn-ghost px-2 py-1 text-xs"
                              onClick={() => void resetPassword(player)}>
                              {t('players.password.action')}
                            </button>
                            <Show
                              when={player.totpEnabled}
                              fallback={
                                <button
                                  class="btn-ghost px-2 py-1 text-xs"
                                  onClick={() => void startTotp(player)}>
                                  {t('players.enable2fa')}
                                </button>
                              }>
                              <button
                                class="btn-ghost px-2 py-1 text-xs"
                                onClick={() => void resetTotp(player)}>
                                {t('players.reset2fa')}
                              </button>
                            </Show>
                            <button
                              class="btn-ghost px-2 py-1 text-xs"
                              onClick={() => void useAuthKey(player)}>
                              {t('players.useAuthKey')}
                            </button>
                          </>
                        }>
                        <button
                          class="btn-ghost px-2 py-1 text-xs"
                          onClick={() => void resetAuthKey(player)}>
                          {t('players.resetAuthKey')}
                        </button>
                      </Show>
                      <button
                        class="btn-danger"
                        onClick={() => void remove(player)}>
                        {t('delete')}
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
        <Show when={(list() ?? []).length === 0}>
          <p class="px-4 py-6 text-center text-sm text-slate-400">
            {t('players.empty')}
          </p>
        </Show>
      </div>
    </div>
  );
}
