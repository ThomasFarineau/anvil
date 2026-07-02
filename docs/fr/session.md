# Session

## `"none"` — Offline

Le joueur entre son pseudo directement dans l'interface. Aucune authentification requise.

## `"custom"` — Authentification externe

Vous gérez l'authentification côté client (OAuth, API maison…) et transmettez la session à anvil :

```js
await MC.setSession({
  username: 'Steve',
  uuid: '...',
  access_token: '...',
});

// Pour déconnecter :
await MC.clearSession();
```
