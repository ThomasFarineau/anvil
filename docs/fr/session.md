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

## `"anvil-session"` — Comptes Anvil Server

L'authentification (utilisateur + mot de passe + 2FA optionnelle) est validée
par le [anvil-server](./server) déclaré dans le champ `anvil-server` :

```js
const res = await MC.anvilSession.login('Steve', 'password');
if (res.status === 'totp_required') {
  await MC.anvilSession.login('Steve', 'password', '123456');
}

await MC.anvilSession.restore(); // session persistée, au démarrage
await MC.anvilSession.logout();
```

Voir [Anvil Server](./server) pour la mise en place complète.
