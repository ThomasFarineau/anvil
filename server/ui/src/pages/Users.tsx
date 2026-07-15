import { createResource, createSignal, For, Show } from 'solid-js';

import { confirmDialog, promptDialog } from '../alerts';
import { api, del, errorMessage, patch, post, type UserRow } from '../api';
import { t } from '../i18n';

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
      flash(t('users.created'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetPassword = async (user: UserRow) => {
    const next = await promptDialog(
      t('users.resetPasswordPrompt', { username: user.username }),
      { inputType: 'password' },
    );
    if (!next) return;
    try {
      await post(`/api/users/${user.id}/password`, { password: next });
      flash(t('users.passwordReset'));
    } catch (error_) {
      fail(error_);
    }
  };

  const resetTotp = async (user: UserRow) => {
    if (
      !(await confirmDialog(
        t('users.confirmResetTotp', { username: user.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await post(`/api/users/${user.id}/totp/reset`);
      flash(t('users.totpReset'));
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const resetPasskeys = async (user: UserRow) => {
    if (
      !(await confirmDialog(
        t('users.confirmResetPasskeys', { username: user.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await post(`/api/users/${user.id}/passkeys/reset`);
      flash(t('users.passkeysReset'));
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
    if (
      !(await confirmDialog(
        t('users.confirmDelete', { username: user.username }),
        { danger: true },
      ))
    )
      return;
    try {
      await del(`/api/users/${user.id}`);
      void refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-4xl">
      <h1 class="mb-1 text-2xl font-semibold text-slate-100">
        {t('users.title')}
      </h1>
      <p class="mb-6 text-sm text-slate-400">{t('users.subtitle')}</p>

      <form class="panel mb-6 flex flex-wrap items-end gap-3" onSubmit={create}>
        <div class="min-w-40 flex-1">
          <label class="label">{t('users.username')}</label>
          <input
            class="input"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
          />
        </div>
        <div class="min-w-40 flex-1">
          <label class="label">{t('users.password')}</label>
          <input
            class="input"
            type="password"
            value={password()}
            onInput={(e) => setPassword(e.currentTarget.value)}
          />
        </div>
        <div>
          <label class="label">{t('users.role')}</label>
          <select
            class="input"
            value={role()}
            onInput={(e) => setRole(e.currentTarget.value as 'user' | 'admin')}>
            <option value="user">{t('role.user')}</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <button class="btn">{t('users.create')}</button>
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
              <th class="px-4 py-3">{t('users.col.username')}</th>
              <th class="px-4 py-3">{t('users.col.role')}</th>
              <th class="px-4 py-3">{t('users.col.totp')}</th>
              <th class="px-4 py-3 text-right">{t('users.col.actions')}</th>
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
                    <Show
                      when={user.totpEnabled}
                      fallback={<span class="text-slate-500">—</span>}>
                      <span class="text-emerald-400">
                        {t('users.enabled')}
                      </span>
                    </Show>
                    <Show when={user.passkeyCount > 0}>
                      <span class="ml-2 text-accent">
                        {t('users.passkeys', { count: user.passkeyCount })}
                      </span>
                    </Show>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex justify-end gap-2">
                      <button
                        class="btn-ghost px-2 py-1 text-xs"
                        onClick={() => void toggleRole(user)}>
                        {user.role === 'admin'
                          ? t('users.toUser')
                          : t('users.toAdmin')}
                      </button>
                      <button
                        class="btn-ghost px-2 py-1 text-xs"
                        onClick={() => void resetPassword(user)}>
                        {t('users.password.action')}
                      </button>
                      <Show when={user.totpEnabled}>
                        <button
                          class="btn-ghost px-2 py-1 text-xs"
                          onClick={() => void resetTotp(user)}>
                          {t('users.reset2fa')}
                        </button>
                      </Show>
                      <Show when={user.passkeyCount > 0}>
                        <button
                          class="btn-ghost px-2 py-1 text-xs"
                          onClick={() => void resetPasskeys(user)}>
                          {t('users.resetPasskeys')}
                        </button>
                      </Show>
                      <button
                        class="btn-danger"
                        onClick={() => void remove(user)}>
                        {t('delete')}
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
