import QRCode from 'qrcode';
import { createSignal, Show } from 'solid-js';

import { useSession } from '../App';
import { errorMessage, post } from '../api';

export default function Account() {
  const session = useSession();
  const [error, setError] = createSignal('');
  const [message, setMessage] = createSignal('');

  const flash = (text: string) => {
    setError('');
    setMessage(text);
    setTimeout(() => setMessage(''), 3000);
  };
  const fail = (error_: unknown) => {
    setMessage('');
    setError(errorMessage(error_));
  };

  // ── Mot de passe ───────────────────────────────────────────────
  const [current, setCurrent] = createSignal('');
  const [next, setNext] = createSignal('');

  const changePassword = async (event: Event) => {
    event.preventDefault();
    try {
      await post('/api/auth/password', { current: current(), next: next() });
      setCurrent('');
      setNext('');
      flash('Mot de passe modifié.');
    } catch (error_) {
      fail(error_);
    }
  };

  // ── 2FA ────────────────────────────────────────────────────────
  const [setup, setSetup] = createSignal<{ secret: string; qr: string } | null>(
    null,
  );
  const [totpCode, setTotpCode] = createSignal('');

  const startSetup = async () => {
    try {
      const data = await post<{ secret: string; uri: string }>(
        '/api/auth/totp/setup',
      );
      const qr = await QRCode.toDataURL(data.uri, { margin: 1, width: 192 });
      setSetup({ secret: data.secret, qr });
    } catch (error_) {
      fail(error_);
    }
  };

  const enableTotp = async (event: Event) => {
    event.preventDefault();
    try {
      await post('/api/auth/totp/enable', { code: totpCode() });
      setSetup(null);
      setTotpCode('');
      flash('2FA activée.');
      session.refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const disableTotp = async (event: Event) => {
    event.preventDefault();
    try {
      await post('/api/auth/totp/disable', { code: totpCode() });
      setTotpCode('');
      flash('2FA désactivée.');
      session.refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-6 text-2xl font-semibold text-slate-100">Mon compte</h1>

      <Show when={message()}>
        <p class="mb-4 text-sm text-emerald-400">{message()}</p>
      </Show>
      <Show when={error()}>
        <p class="mb-4 text-sm text-red-400">{error()}</p>
      </Show>

      <form class="panel mb-6" onSubmit={changePassword}>
        <h2 class="mb-4 font-medium text-slate-100">Changer le mot de passe</h2>
        <div class="mb-4">
          <label class="label">Mot de passe actuel</label>
          <input
            class="input"
            type="password"
            value={current()}
            onInput={(e) => setCurrent(e.currentTarget.value)}
            autocomplete="current-password"
          />
        </div>
        <div class="mb-4">
          <label class="label">Nouveau mot de passe (8 min.)</label>
          <input
            class="input"
            type="password"
            value={next()}
            onInput={(e) => setNext(e.currentTarget.value)}
            autocomplete="new-password"
          />
        </div>
        <button class="btn">Modifier</button>
      </form>

      <section class="panel">
        <h2 class="mb-2 font-medium text-slate-100">
          Authentification à deux facteurs (TOTP)
        </h2>

        <Show
          when={session.me()?.totpEnabled}
          fallback={
            <Show
              when={setup()}
              fallback={
                <div>
                  <p class="mb-4 text-sm text-slate-400">
                    Protégez votre compte avec une application
                    d'authentification (Google Authenticator, Aegis…). La 2FA
                    s'applique aussi à la connexion depuis le launcher.
                  </p>
                  <button class="btn" onClick={() => void startSetup()}>
                    Activer la 2FA
                  </button>
                </div>
              }>
              {(data) => (
                <form onSubmit={enableTotp}>
                  <p class="mb-4 text-sm text-slate-400">
                    Scannez ce QR code puis saisissez le code généré :
                  </p>
                  <img
                    src={data().qr}
                    alt="QR code TOTP"
                    class="mb-3 rounded-md bg-white p-2"
                    width={192}
                    height={192}
                  />
                  <p class="mb-4 text-xs text-slate-500">
                    Secret : <code>{data().secret}</code>
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
                      onClick={() => setSetup(null)}>
                      Annuler
                    </button>
                  </div>
                </form>
              )}
            </Show>
          }>
          <form onSubmit={disableTotp}>
            <p class="mb-4 text-sm text-emerald-400">
              La 2FA est activée sur ce compte.
            </p>
            <div class="flex gap-2">
              <input
                class="input max-w-40 text-center tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
                value={totpCode()}
                onInput={(e) => setTotpCode(e.currentTarget.value)}
              />
              <button class="btn-danger">Désactiver la 2FA</button>
            </div>
          </form>
        </Show>
      </section>
    </div>
  );
}
