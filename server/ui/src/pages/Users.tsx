import { createResource, createSignal, For, Show } from 'solid-js';

import { api, del, errorMessage, patch, post, type UserRow } from '../api';

export default function Users() {
  const [list, { refetch }] = createResource(() =>
    api<UserRow[]>('/api/users'),
  );
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [role, setRole] = createSignal<'user' | 'admin'>('user');

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
      await post('/api/users', {
        username: username(),
        password: password(),
        role: role(),
      });
      setUsername('');
      setPassword('');
      setRole('user');
      flash('Utilisateur créé.');
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetPassword = async (user: UserRow) => {
    const next = prompt(`Nouveau mot de passe pour ${user.username} :`);
    if (!next) return;
    try {
      await post(`/api/users/${user.id}/password`, { password: next });
      flash('Mot de passe réinitialisé (sessions révoquées).');
    } catch (error_) {
      fail(error_);
    }
  };

  const resetTotp = async (user: UserRow) => {
    if (!confirm(`Désactiver la 2FA de ${user.username} ?`)) return;
    try {
      await post(`/api/users/${user.id}/totp/reset`);
      flash('2FA réinitialisée.');
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const toggleRole = async (user: UserRow) => {
    try {
      await patch(`/api/users/${user.id}`, {
        role: user.role === 'admin' ? 'user' : 'admin',
      });
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const remove = async (user: UserRow) => {
    if (!confirm(`Supprimer le compte ${user.username} ?`)) return;
    try {
      await del(`/api/users/${user.id}`);
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">Utilisateurs</h1>
      <p class="mb-6 text-sm text-slate-400">
        Comptes d'accès à cette interface web. Les comptes des joueurs
        (launcher) sont gérés dans l'onglet Joueurs.
      </p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">Utilisateur</label>
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
        <div>
          <label class="label">Rôle</label>
          <select
            class="input"
            value={role()}
            onInput={(e) => setRole(e.currentTarget.value as 'user' | 'admin')}>
            <option value="user">Utilisateur</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button class="btn">Créer</button>
      </form>

      <Show when={message()}>
        <p class="mb-4 text-sm text-emerald-400">{message()}</p>
      </Show>
      <Show when={error()}>
        <p class="mb-4 text-sm text-red-400">{error()}</p>
      </Show>

      <div class="panel overflow-x-auto p-0">
        <table class="w-full text-left text-sm">
          <thead class="border-b border-edge text-xs text-slate-400 uppercase">
            <tr>
              <th class="px-4 py-3">Utilisateur</th>
              <th class="px-4 py-3">Rôle</th>
              <th class="px-4 py-3">2FA</th>
              <th class="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-edge">
            <For each={list()}>
              {(user) => (
                <tr>
                  <td class="px-4 py-3 text-slate-200">{user.username}</td>
                  <td class="px-4 py-3">
                    <span
                      class={
                        user.role === 'admin' ? 'text-accent' : 'text-slate-400'
                      }>
                      {user.role}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    {user.totpEnabled ? (
                      <span class="text-emerald-400">activée</span>
                    ) : (
                      <span class="text-slate-500">—</span>
                    )}
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button
                        class="btn-ghost px-2 py-1 text-xs"
                        onClick={() => void toggleRole(user)}>
                        {user.role === 'admin' ? '→ user' : '→ admin'}
                      </button>
                      <button
                        class="btn-ghost px-2 py-1 text-xs"
                        onClick={() => void resetPassword(user)}>
                        Mot de passe
                      </button>
                      <Show when={user.totpEnabled}>
                        <button
                          class="btn-ghost px-2 py-1 text-xs"
                          onClick={() => void resetTotp(user)}>
                          Reset 2FA
                        </button>
                      </Show>
                      <button
                        class="btn-danger"
                        onClick={() => void remove(user)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </div>
    </div>
  );
}
