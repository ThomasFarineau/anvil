# anvil-server

Self-hosted companion server for **anvil** launchers: instances (MC version,
loader, mods, custom config files, enable/disable) + player accounts with 2FA
for the `anvil-session` session type, protected by API keys. Web UI, MongoDB
storage.

## Deploy (Docker)

```bash
cd server
docker compose up -d
```

The UI is available on `http://localhost:8080`. An admin account is created
on first start from the environment variables (`ANVIL_ADMIN_USERNAME` /
`ANVIL_ADMIN_PASSWORD`, default `admin:admin`) — **change the password right
away**.

| Variable               | Default                       | Purpose                              |
| ---------------------- | ------------------------------ | ------------------------------------- |
| `PORT`                 | `8080`                         | Listen port                           |
| `MONGO_URL`            | `mongodb://mongo:27017/anvil` | MongoDB connection string             |
| `DATA_DIR`             | `/data`                        | Uploaded mods / config files storage |
| `PUBLIC_URL`           | _(request origin)_             | Base of generated download URLs      |
| `ANVIL_ADMIN_USERNAME` | `admin`                        | Bootstrap admin login                 |
| `ANVIL_ADMIN_PASSWORD` | `admin`                        | Bootstrap admin password              |

## Concepts

- **Instances**: MC version, loader, mods (upload or URL), custom config
  files. Can be enabled/disabled — only enabled instances are served to
  launchers.
- **API keys** (admin): the whole launcher API requires a key, set in the
  `anvil-key` field of `config.json`.
- **Players**: launcher accounts (`session: "anvil-session"`), with optional
  TOTP 2FA. Separate from **Users**, accounts for accessing the web UI.

## Launcher side

```jsonc
// config.json — no more instance declarations
{
  "anvil-server": "https://mods.example.com",
  "anvil-key": "anvil_...",
  "session": "anvil-session",
}
```

At startup, the launcher fetches the enabled instances
(`GET /api/launcher/instances`): name, MC version, loader, mods and config
files are downloaded automatically (with an offline disk cache). With
`"session": "anvil-session"`, login (player + password + optional 2FA) is
validated by this server.

## Development

```bash
cd server
bun install
bun run dev      # API on :8080 (requires a local MongoDB)
bun run dev:ui   # Vite UI on :5173 (proxies /api → :8080)
bun test         # unit tests
```

## Launcher API (API key required: `x-anvil-key` header)

| Route                                 | Description                          |
| -------------------------------------- | ------------------------------------- |
| `GET /api/launcher/instances`         | List of enabled instances (mods, files, URLs) |
| `GET /api/launcher/instances/:id`     | Definition of an enabled instance    |
| `POST /api/launcher/session`          | Player login → `{username, uuid, access_token}` |
| `POST /api/launcher/session/validate` | Validate an existing token           |
| `POST /api/launcher/session/logout`   | Revoke a token                        |
| `GET /files/:id/mods/:file`           | Download a hosted mod                |
| `GET /files/:id/files/*`              | Download a config file               |
