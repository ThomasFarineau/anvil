import QRCode from 'qrcode';
import { createResource, createSignal, For, Show } from 'solid-js';

import { api, del, errorMessage, post, type PlayerRow } from '../api';

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
      flash('Joueur créé.');
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetPassword = async (player: PlayerRow) => {
    const next = prompt(`Nouveau mot de passe pour ${player.username} :`);
    if (!next) return;
    try {
      await post(`/api/players/${player.id}/password`, { password: next });
      flash('Mot de passe réinitialisé (sessions launcher révoquées).');
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
      flash(`2FA activée pour ${setup.username}.`);
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetTotp = async (player: PlayerRow) => {
    if (!confirm(`Désactiver la 2FA de ${player.username} ?`)) return;
    try {
      await post(`/api/players/${player.id}/totp/reset`);
      flash('2FA réinitialisée.');
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const remove = async (player: PlayerRow) => {
    if (!confirm(`Supprimer le joueur ${player.username} ?`)) return;
    try {
      await del(`/api/players/${player.id}`);
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">Joueurs</h1>
      <p class="mb-6 text-sm text-slate-400">
        Comptes utilisés par les launchers (
        <code class="text-accent-soft">"session": "anvil-session"</code>).
        Séparés des comptes de cette interface.
      </p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">Pseudo</label>
          <input
            class="input"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div class="min-w-40 flex-1">
          <label class="label">Mot de passe</label>
          <input
            class="input"
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </div>
        <button class="btn">Créer</button>
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
              2FA pour {setup().username}
            </h2>
            <p class="mb-3 text-sm text-slate-400">
              Faites scanner ce QR code au joueur (Google Authenticator,
              Aegis…), puis saisissez un code généré pour confirmer :
            </p>
            <img
              src={setup().qr}
              alt="QR code TOTP"
              class="mb-3 rounded-md bg-white p-2"
              width={192}
              height={192}
            />
            <p class="mb-4 text-xs text-slate-500">
              Secret : <code>{setup().secret}</code>
            </p>
            <div class="flex gap-2">
              <input
                class="input max-w-40 text-center tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
                value={totpCode()}
                onInput={(e) => setTotpCode(e.currentTarget.value)}
              />
              <button class="btn">Confirmer</button>
              <button
                type="button"
                class="btn-ghost"
                onClick={() => setTotpSetup(null)}>
                Annuler
              </button>
            </div>
          </form>
        )}
      </Show>

      <div class="panel overflow-x-auto p-0">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-edge text-xs text-slate-400 uppercase">
            <tr>
              <th class="px-4 py-3">Pseudo</th>
              <th class="px-4 py-3">UUID</th>
              <th class="px-4 py-3">2FA</th>
              <th class="px-4 py-3 text-right">Actions</th>
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
                    {player.totpEnabled ? (
                      <span class="text-emerald-400">activée</span>
                    ) : (
                      <span class="text-slate-500">—</span>
                    )}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button
                        class="btn-ghost px-2 py-1 text-xs"
                        onClick={() => void resetPassword(player)}>
                        Mot de passe
                      </button>
                      <Show
                        when={player.totpEnabled}
                        fallback={
                          <button
                            class="btn-ghost px-2 py-1 text-xs"
                            onClick={() => void startTotp(player)}>
                            Activer 2FA
                          </button>
                        }>
                        <button
                          class="btn-ghost px-2 py-1 text-xs"
                          onClick={() => void resetTotp(player)}>
                          Reset 2FA
                        </button>
                      </Show>
                      <button
                        class="btn-danger"
                        onClick={() => void remove(player)}>
                        Supprimer
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
            Aucun joueur. Créez les comptes que vos joueurs utiliseront dans le
            launcher.
          </p>
        </Show>
      </div>
    </div>
  );
}
