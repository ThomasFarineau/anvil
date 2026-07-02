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
