import { startAuthentication } from '@simplewebauthn/browser';
import { createSignal, Show } from 'solid-js';

import { useSession } from '../App';
import { ApiError, errorMessage, post } from '../api';
import { t } from '../i18n';

const tab = (active: boolean) =>
  `flex-1 rounded-md px-3 py-1.5 text-sm transition ${
    active ? 'bg-surface text-accent' : 'text-slate-400 hover:text-slate-200'
  }`;

export default function Login() {
  const session = useSession();
  const [mode, setMode] = createSignal<'password' | 'passkey'>('password');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [code, setCode] = createSignal('');
  const [needCode, setNeedCode] = createSignal(false);
  const [error, setError] = createSignal('');
  const [busy, setBusy] = createSignal(false);

  const submit = async (event: Event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await post('/api/auth/login', {
        username: username(),
        password: password(),
        code: needCode() ? code() : undefined,
      });
      session.refetch();
    } catch (error_) {
      if (error_ instanceof ApiError && error_.code === 'totp_required') {
        setNeedCode(true);
      } else {
        setError(errorMessage(error_));
      }
    } finally {
      setBusy(false);
    }
  };

  const signInWithPasskey = async () => {
    setBusy(true);
    setError('');
    try {
      const options = await post<Record<string, unknown>>(
        '/api/auth/passkey/login/options',
      );
      const response = await startAuthentication({
        optionsJSON: options as never,
      });
      await post('/api/auth/passkey/login/verify', { response });
      session.refetch();
    } catch (error_) {
      setError(errorMessage(error_));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div class="flex min-h-screen items-center justify-center p-4">
      <div class="panel w-full max-w-sm">
        <div class="mb-6 text-center">
          <img src="/logo.svg" alt="Anvil" class="mx-auto h-10 w-10" />
          <h1 class="mt-2 text-xl font-semibold text-slate-100">
            Anvil <span class="text-accent">Server</span>
          </h1>
          <p class="mt-1 text-sm text-slate-400">{t('login.subtitle')}</p>
        </div>

        <div class="mb-4 flex gap-1 rounded-md border border-edge p-1">
          <button
            type="button"
            class={tab(mode() === 'password')}
            onClick={() => {
              setMode('password');
              setError('');
            }}>
            {t('login.tabPassword')}
          </button>
          <button
            type="button"
            class={tab(mode() === 'passkey')}
            onClick={() => {
              setMode('passkey');
              setError('');
            }}>
            {t('login.tabPasskey')}
          </button>
        </div>

        <Show
          when={mode() === 'password'}
          fallback={
            <div>
              <p class="mb-4 text-sm text-slate-400">
                {t('login.passkeyIntro')}
              </p>
              <button
                type="button"
                class="btn w-full justify-center"
                disabled={busy()}
                onClick={() => void signInWithPasskey()}>
                {busy()
                  ? t('login.passkeySigningIn')
                  : t('login.passkeySignIn')}
              </button>
            </div>
          }>
          <form onSubmit={submit}>
            <Show
              when={!needCode()}
              fallback={
                <div class="mb-4">
                  <label class="label" for="code">
                    {t('login.totpCode')}
                  </label>
                  <input
                    id="code"
                    class="input text-center text-lg tracking-[0.4em]"
                    value={code()}
                    onInput={(e) => setCode(e.currentTarget.value)}
                    placeholder="000000"
                    maxLength={6}
                    autofocus
                  />
                </div>
              }>
              <div class="mb-4">
                <label class="label" for="username">
                  {t('login.username')}
                </label>
                <input
                  id="username"
                  name="username"
                  class="input"
                  value={username()}
                  onInput={(e) => setUsername(e.currentTarget.value)}
                  autocomplete="username"
                  autofocus
                />
              </div>
              <div class="mb-4">
                <label class="label" for="password">
                  {t('login.password')}
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  class="input"
                  value={password()}
                  onInput={(e) => setPassword(e.currentTarget.value)}
                  autocomplete="current-password"
                />
              </div>
            </Show>

            <Show when={error()}>
              <p class="mb-4 text-sm text-red-400">{error()}</p>
            </Show>

            <button class="btn w-full justify-center" disabled={busy()}>
              {busy() ? t('login.submitting') : t('login.submit')}
            </button>
          </form>
        </Show>

        <Show when={mode() === 'passkey' && error()}>
          <p class="mt-4 text-sm text-red-400">{error()}</p>
        </Show>
      </div>
    </div>
  );
}
