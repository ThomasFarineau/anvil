# Session

## `"none"` — Offline

Le joueur entre son pseudo directement dans l'interface. Aucune authentification requise.

## `"microsoft"` — Compte Microsoft

Ce mode connecte le joueur avec un compte Microsoft personnel, obtient les
jetons Xbox/XSTS requis par Minecraft Services, vérifie le profil Minecraft
Java et renouvelle la session aux démarrages suivants.

Commencez par [enregistrer une application dans Microsoft Entra](https://learn.microsoft.com/fr-fr/entra/identity-platform/quickstart-register-app). Elle doit accepter les comptes Microsoft personnels et être configurée comme client public. Dans **Authentification**, ajoutez la plateforme **Applications mobiles et de bureau** avec cette URI de redirection : `https://login.microsoftonline.com/common/oauth2/nativeclient`. Copiez son identifiant d'application (client) dans `config.json` :

```json
{
  "session": "microsoft",
  "microsoft-client-id": "00000000-0000-0000-0000-000000000000"
}
```

Les templates fournis restaurent automatiquement la session et ouvrent la
fenêtre de connexion Xbox/Microsoft intégrée au premier clic sur Jouer. Pour
une interface personnalisée, utilisez directement le même flux :

```js
const saved = await MC.microsoftSession.restore();

if (!saved) {
  const profile = await MC.microsoftSession.signIn();
  console.log(`Connecté en tant que ${profile.username}`);
}

await MC.microsoftSession.logout();
```

`signIn()` utilise le flux authorization code + PKCE et les portées Xbox dans
une fenêtre dédiée au launcher : aucun code n'est à recopier. En solution de
repli, `MC.microsoftSession.login(onCode)` combine `start()` et `finish()` et
ouvre la page de validation par code d'appareil dans le navigateur par défaut.
Le refresh token est conservé localement dans le dossier de données de
l'application ; ne versionnez jamais ce fichier de session et ne l'affichez
pas dans les logs du frontend.

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
