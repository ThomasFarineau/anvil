import { createSignal, Show } from 'solid-js';

import { useSession } from '../App';
import { ApiError, errorMessage, post } from '../api';

export default function Login() {
  const session = useSession();
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

  return (
    <div class="flex min-h-screen items-center justify-center p-4">
      <form class="panel w-full max-w-sm" onSubmit={submit}>
        <div class="mb-6 text-center">
          <img src="/logo.svg" alt="anvil" class="mx-auto h-10 w-10" />
          <h1 class="mt-2 text-xl font-semibold text-slate-100">
            anvil <span class="text-accent">server</span>
          </h1>
          <p class="mt-1 text-sm text-slate-400">Connexion à l'interface</p>
        </div>

        <Show
          when={!needCode()}
          fallback={
            <div class="mb-4">
              <label class="label" for="code">
                Code 2FA
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
              Utilisateur
            </label>
            <input
              id="username"
              class="input"
              value={username()}
              onInput={(e) => setUsername(e.currentTarget.value)}
              autocomplete="username"
              autofocus
            />
          </div>
          <div class="mb-4">
            <label class="label" for="password">
              Mot de passe
            </label>
            <input
              id="password"
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
          {busy() ? 'Connexion…' : 'Se connecter'}
        </button>
      </form>
    </div>
  );
}
