# Session

## `"none"` — Offline

The player types their username directly in the UI. No authentication required.

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
