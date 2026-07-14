# Anvil Server

**anvil-server** est un serveur compagnon auto-hébergé pour les launchers
anvil. Il héberge vos instances (version Minecraft, loader, mods, fichiers de
config custom) et vos comptes joueurs (utilisateur + mot de passe + 2FA
optionnelle), le tout géré depuis une interface web adossée à MongoDB.

## Déploiement en 2 secondes (Docker)

```bash
cd server
docker compose up -d
```

L'interface web est servie sur `http://localhost:8080`. Au premier démarrage,
un compte admin est créé à partir des variables d'environnement — défaut
`admin:admin`, **changez le mot de passe immédiatement** depuis la page
_Mon compte_.

| Variable               | Défaut                        | Rôle                                  |
| ---------------------- | ----------------------------- | ------------------------------------- |
| `PORT`                 | `8080`                        | Port d'écoute                         |
| `MONGO_URL`            | `mongodb://mongo:27017/anvil` | Connexion MongoDB                     |
| `DATA_DIR`             | `/data`                       | Stockage des mods / fichiers uploadés |
| `PUBLIC_URL`           | _(origine de la requête)_     | Base des URLs de téléchargement       |
| `ANVIL_ADMIN_USERNAME` | `admin`                       | Login admin bootstrap                 |
| `ANVIL_ADMIN_PASSWORD` | `admin`                       | Mot de passe admin bootstrap          |

Pour construire l'image manuellement : `docker build -t anvil-server server/`.

### Image pré-construite

Chaque push sur `main` (et chaque tag `v*`) qui touche `server/` est construit
et publié sur le GitHub Container Registry par le workflow `docker.yml`, sous
forme d'image multi-arch (`linux/amd64` + `linux/arm64`) :

```bash
docker pull ghcr.io/thomasfarineau/anvil-server:latest
```

Faites pointer le service `anvil-server` de votre `docker-compose.yml` vers
cette image au lieu de `build: .` si vous ne souhaitez pas la construire
vous-même. Les tags suivent la version du package (`vX.Y.Z`), plus `latest`
sur `main` et un SHA de commit court pour chaque build.

```yaml
services:
  anvil-server:
    image: ghcr.io/thomasfarineau/anvil-server:latest
    restart: unless-stopped
    ports:
      - '8080:8080'
    environment:
      MONGO_URL: mongodb://mongo:27017/anvil
      ANVIL_ADMIN_USERNAME: admin
      ANVIL_ADMIN_PASSWORD: admin
      # PUBLIC_URL: https://mods.example.com
    volumes:
      - anvil-data:/data
    depends_on:
      - mongo

  mongo:
    image: mongo:7
    restart: unless-stopped
    volumes:
      - mongo-data:/data/db

volumes:
  anvil-data:
  mongo-data:
```

## Clé d'API

Toute l'API launcher (liste des instances, sessions, téléchargements) exige
une clé d'API. Générez-en une depuis la page _Clés API_ (admin uniquement) et
renseignez-la dans le `config.json` du launcher via `anvil-key`. Révoquer une
clé coupe immédiatement les launchers qui l'utilisent.

## Instances distantes

Créez les instances dans l'interface web (id, nom, version MC, loader),
uploadez les mods (fichiers .jar ou URLs externes) et les fichiers de config
custom (ex : `config/monmod.toml`). Chaque instance peut être **activée ou
désactivée** — une instance désactivée n'est pas servie aux launchers. Le
`config.json` du launcher ne déclare plus d'instances, seulement le serveur
et la clé :

```json
{
  "anvil-server": "https://mods.example.com",
  "anvil-key": "anvil_..."
}
```

Au démarrage, le launcher récupère les instances actives via
`GET /api/launcher/instances` : noms, `mc_version`, loaders, mods et fichiers
de config sont téléchargés pendant le setup. La liste est mise en cache sur
disque : le launcher reste utilisable hors-ligne. Les fichiers de config sont
re-téléchargés à chaque setup — le serveur fait autorité.

## Joueurs, utilisateurs web & 2FA

Deux systèmes de comptes totalement séparés :

- **Joueurs** (page _Joueurs_) : comptes utilisés pour se connecter depuis le
  launcher (`"session": "anvil-session"`). Un joueur ne peut pas accéder à
  l'interface web.
- **Utilisateurs web** (page _Utilisateurs_, admin uniquement) : comptes
  d'accès à cette interface d'administration. Un utilisateur web ne peut pas
  se connecter depuis le launcher.

Pas d'inscription libre : les deux se créent depuis l'interface. La 2FA TOTP
est disponible pour les deux — les utilisateurs web l'activent eux-mêmes
depuis _Mon compte_ ; pour les joueurs, le QR code est généré depuis la page
_Joueurs_ et transmis au joueur (Google Authenticator, Aegis…).

## `"session": "anvil-session"`

Avec ce mode, la connexion du launcher est validée contre les comptes
**joueurs** du anvil-server :

```json
{
  "anvil-server": "https://mods.example.com",
  "anvil-key": "anvil_...",
  "session": "anvil-session"
}
```

```js
// Connexion (rejette avec un message si identifiants invalides)
const res = await MC.anvilSession.login('Steve', 'password');
if (res.status === 'totp_required') {
  // demander le code 2FA à l'utilisateur, puis :
  await MC.anvilSession.login('Steve', 'password', '123456');
}

// Restaure la session persistée au démarrage (null si aucune/révoquée).
// Si le serveur est injoignable, la session en cache est conservée
// (jeu hors-ligne possible).
const session = await MC.anvilSession.restore();

await MC.anvilSession.logout();
```

Contrairement à `session: "custom"`, lancer le jeu sans session active est
refusé. Voir [`examples/anvil-server`](https://github.com/ThomasFarineau/anvil/tree/main/examples/anvil-server)
pour un launcher complet, et [`server/`](https://github.com/ThomasFarineau/anvil/tree/main/server)
pour le serveur lui-même.
