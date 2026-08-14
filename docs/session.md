# Session

## `"none"` — Offline

The player types their username directly in the UI. No authentication required.

## `"microsoft"` — Microsoft account

This mode signs the player in with a personal Microsoft account, obtains the
Xbox/XSTS tokens required by Minecraft Services, verifies the Minecraft Java
profile, and refreshes the session on later launcher starts.

First, [register an application in Microsoft Entra](https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app). It must accept personal Microsoft accounts and be configured as a public client. Under **Authentication**, add the **Mobile and desktop applications** platform with this redirect URI: `https://login.microsoftonline.com/common/oauth2/nativeclient`. Copy its application (client) ID into `config.json`:

```json
{
  "session": "microsoft",
  "microsoft-client-id": "00000000-0000-0000-0000-000000000000"
}
```

The bundled templates restore the saved session automatically and open the
in-app Xbox/Microsoft sign-in window when the player first presses Play. For a
custom UI, use the same flow directly:

```js
const saved = await MC.microsoftSession.restore();

if (!saved) {
  const profile = await MC.microsoftSession.signIn();
  console.log(`Connected as ${profile.username}`);
}

await MC.microsoftSession.logout();
```

`signIn()` uses authorization code + PKCE and the Xbox scopes in a dedicated
launcher window, so there is no code to copy. As a fallback,
`MC.microsoftSession.login(onCode)` combines `start()` and `finish()` and opens
the device-code validation page in the default browser. The refresh token is
stored locally in the launcher's application-data directory; never commit that
session file or expose it to frontend logs.

## `"custom"` — External authentication

Handle authentication on the client side (OAuth, custom API…) and pass the session to anvil:

```js
await MC.setSession({
  username: 'Steve',
  uuid: '...',
  access_token: '...',
});

// To log out:
await MC.clearSession();
```

## `"anvil-session"` — Anvil Server accounts

Authentication (username + password + optional 2FA) is validated by the
[anvil-server](./server) declared in the `anvil-server` config field:

```js
const res = await MC.anvilSession.login('Steve', 'password');
if (res.status === 'totp_required') {
  await MC.anvilSession.login('Steve', 'password', '123456');
}

await MC.anvilSession.restore(); // persisted session, at startup
await MC.anvilSession.logout();
```

See [Anvil Server](./server) for the full setup.
