import { startRegistration } from '@simplewebauthn/browser';
import QRCode from 'qrcode';
import { createSignal, For, Show } from 'solid-js';

import { useSession } from '../App';
import { confirmDialog, promptDialog } from '../alerts';
import { del, errorMessage, post, type Passkey } from '../api';
import { t } from '../i18n';

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
      flash(t('account.passwordChanged'));
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
      flash(t('account.totpEnabled'));
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
      flash(t('account.totpDisabled'));
      session.refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  // ── Passkeys ─────────────────────────────────────────────────────────────

  const addPasskey = async () => {
    try {
      const { defaultName, ...options } = await post<
        Record<string, unknown> & { defaultName: string }
      >('/api/auth/passkey/register/options');
      const response = await startRegistration({
        optionsJSON: options as never,
      });
      const name =
        (await promptDialog(t('account.passkeyNamePrompt'), {
          defaultValue: defaultName,
        })) || defaultName;
      await post('/api/auth/passkey/register/verify', { response, name });
      flash(t('account.passkeyAdded'));
      session.refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  const removePasskey = async (passkey: Passkey) => {
    if (
      !(await confirmDialog(
        t('account.confirmRemovePasskey', { name: passkey.name }),
        { danger: true },
      ))
    )
      return;
    try {
      await del(`/api/auth/passkey/${passkey.id}`);
      flash(t('account.passkeyRemoved'));
      session.refetch();
    } catch (error_) {
      fail(error_);
    }
  };

  return (
    <div class="mx-auto max-w-2xl">
      <h1 class="mb-6 text-2xl font-semibold text-slate-100">
        {t('account.title')}
      </h1>

      <Show when={message()}>
        <p class="mb-4 text-sm text-emerald-400">{message()}</p>
      </Show>
      <Show when={error()}>
        <p class="mb-4 text-sm text-red-400">{error()}</p>
      </Show>

      <section class="panel mb-6">
        <h2 class="mb-1 font-medium text-slate-100">
          {t('account.passkeysTitle')}
        </h2>
        <p class="mb-4 text-sm text-slate-400">{t('account.passkeysIntro')}</p>

        <Show
          when={(session.me()?.passkeys.length ?? 0) > 0}
          fallback={
            <p class="mb-4 text-sm text-slate-500">{t('account.noPasskeys')}</p>
          }>
          <ul class="mb-4 divide-y divide-edge">
            <For each={session.me()?.passkeys}>
              {(passkey) => (
                <li class="flex items-center justify-between py-2 text-sm">
                  <span class="text-slate-200">{passkey.name}</span>
                  <button
                    class="btn-danger px-2 py-1 text-xs"
                    onClick={() => void removePasskey(passkey)}>
                    {t('account.removePasskey')}
                  </button>
                </li>
              )}
            </For>
          </ul>
        </Show>

        <button class="btn" onClick={() => void addPasskey()}>
          {t('account.addPasskey')}
        </button>
      </section>

      <form class="panel mb-6" onSubmit={changePassword}>
        <h2 class="mb-4 font-medium text-slate-100">
          {t('account.changePassword')}
        </h2>
        <div class="mb-4">
          <label class="label">{t('account.currentPassword')}</label>
          <input
            class="input"
            type="password"
            value={current()}
            onInput={(e) => setCurrent(e.currentTarget.value)}
            autocomplete="current-password"
          />
        </div>
        <div class="mb-4">
          <label class="label">{t('account.newPassword')}</label>
          <input
            class="input"
            type="password"
            value={next()}
            onInput={(e) => setNext(e.currentTarget.value)}
            autocomplete="new-password"
          />
        </div>
        <button class="btn">{t('account.update')}</button>
      </form>

      <section class="panel">
        <h2 class="mb-2 font-medium text-slate-100">
          {t('account.totpTitle')}
        </h2>

        <Show
          when={session.me()?.totpEnabled}
          fallback={
            <Show
              when={setup()}
              fallback={
                <div>
                  <p class="mb-4 text-sm text-slate-400">
                    {t('account.totpIntro')}
                  </p>
                  <button class="btn" onClick={() => void startSetup()}>
                    {t('account.enableTotp')}
                  </button>
                </div>
              }>
              {(data) => (
                <form onSubmit={enableTotp}>
                  <p class="mb-4 text-sm text-slate-400">
                    {t('account.scanQr')}
                  </p>
                  <img
                    src={data().qr}
                    alt="TOTP QR code"
                    class="mb-3 rounded-md bg-white p-2"
                    width={192}
                    height={192}
                  />
                  <p class="mb-4 text-xs text-slate-500">
                    {t('account.secret')}: <code>{data().secret}</code>
                  </p>
                  <div class="flex gap-2">
                    <input
                      class="input max-w-40 text-center tracking-[0.3em]"
                      placeholder="000000"
                      maxLength={6}
                      value={totpCode()}
                      onInput={(e) => setTotpCode(e.currentTarget.value)}
                    />
                    <button class="btn">{t('account.confirm')}</button>
                    <button
                      type="button"
                      class="btn-ghost"
                      onClick={() => setSetup(null)}>
                      {t('account.cancel')}
                    </button>
                  </div>
                </form>
              )}
            </Show>
          }>
          <form onSubmit={disableTotp}>
            <p class="mb-4 text-sm text-emerald-400">
              {t('account.totpEnabledOnAccount')}
            </p>
            <div class="flex gap-2">
              <input
                class="input max-w-40 text-center tracking-[0.3em]"
                placeholder="000000"
                maxLength={6}
                value={totpCode()}
                onInput={(e) => setTotpCode(e.currentTarget.value)}
              />
              <button class="btn-danger">{t('account.disableTotp')}</button>
            </div>
          </form>
        </Show>
      </section>
    </div>
  );
}
