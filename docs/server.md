# Anvil Server

**anvil-server** is a self-hosted companion server for anvil launchers. It
hosts your instances (Minecraft version, loader, mods, custom config files)
and your player accounts (username + password + optional 2FA), all managed
from a web interface backed by MongoDB.

## Deploy in seconds (Docker)

```bash
cd server
docker compose up -d
```

The web UI is served on `http://localhost:8080`. On first start an admin
account is created from the environment variables — default `admin:admin`,
**change the password right away** from the _Account_ page.

| Variable               | Default                       | Purpose                              |
| ---------------------- | ----------------------------- | ------------------------------------ |
| `PORT`                 | `8080`                        | Listen port                          |
| `MONGO_URL`            | `mongodb://mongo:27017/anvil` | MongoDB connection string            |
| `DATA_DIR`             | `/data`                       | Uploaded mods / config files storage |
| `PUBLIC_URL`           | _(request origin)_            | Base of generated download URLs      |
| `ANVIL_ADMIN_USERNAME` | `admin`                       | Bootstrap admin login                |
| `ANVIL_ADMIN_PASSWORD` | `admin`                       | Bootstrap admin password             |

To build the image manually: `docker build -t anvil-server server/`.

### Pre-built image

Every push to `main` (and every `v*` tag) that touches `server/` is built and
published to the GitHub Container Registry by the `docker.yml` workflow, as a
multi-arch (`linux/amd64` + `linux/arm64`) image:

```bash
docker pull ghcr.io/thomasfarineau/anvil-server:latest
```

Point your `docker-compose.yml`'s `anvil-server` service at that image
instead of `build: .` if you don't want to build it yourself. Tags follow the
package version (`vX.Y.Z`) plus `latest` on `main` and a short commit SHA for
every build.

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

## API key

The whole launcher API (instance list, sessions, file downloads) requires an
API key. Generate one from the _API keys_ page (admin only) and put it in the
launcher's `config.json` under `anvil-key`. Revoking a key immediately cuts
off the launchers using it.

## Remote instances

Create instances in the web UI (id, name, MC version, loader), upload mods
(.jar files or external URLs) and custom config files (e.g.
`config/mymod.toml`). Each instance can be **enabled or disabled** — disabled
instances are not served to launchers. The launcher's `config.json` no longer
declares instances, only the server and the key:

```json
{
  "anvil-server": "https://mods.example.com",
  "anvil-key": "anvil_..."
}
```

At startup the launcher fetches the enabled instances from
`GET /api/launcher/instances`: names, `mc_version`, loaders, mods and config
files are downloaded during setup. The list is cached on disk so the launcher
keeps working offline. Config files are re-downloaded on every setup — the
server is authoritative for them.

## Players, web users & 2FA

Two fully separate account systems:

- **Players** (_Players_ page): accounts used to log in from the launcher
  (`"session": "anvil-session"`). A player cannot access the web UI.
- **Web users** (_Users_ page, admin only): accounts for this administration
  UI. A web user cannot log in from the launcher.

There is no self-registration: both are created from the web UI. TOTP 2FA is
available for both — web users enable it themselves from the _Account_ page;
for players, the QR code is generated from the _Players_ page and shared with
the player (Google Authenticator, Aegis…).

## `"session": "anvil-session"`

With this mode the launcher login is validated against the **player**
accounts of the anvil-server:

```json
{
  "anvil-server": "https://mods.example.com",
  "anvil-key": "anvil_...",
  "session": "anvil-session"
}
```

```js
// Login (rejects with a message on bad credentials)
const res = await MC.anvilSession.login('Steve', 'password');
if (res.status === 'totp_required') {
  // ask the user for their 2FA code, then:
  await MC.anvilSession.login('Steve', 'password', '123456');
}

// Restore the persisted session at startup (null if none/revoked).
// If the server is unreachable, the cached session is kept (offline play).
const session = await MC.anvilSession.restore();

await MC.anvilSession.logout();
```

Unlike `session: "custom"`, launching a game without an active session is
rejected. See [`examples/anvil-server`](https://github.com/ThomasFarineau/anvil/tree/main/examples/anvil-server)
for a complete launcher, and [`server/`](https://github.com/ThomasFarineau/anvil/tree/main/server)
for the server itself.
