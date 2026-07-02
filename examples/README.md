# Examples

A minimal set of runnable examples. anvil ships **eight** frontend templates
(`vanilla`, `react`, `vue`, `solid` × `js`/`ts`) — see `anvil create --help` —
but only two are kept here as living demos, plus a feature demo. The other six
are just the byte-for-byte output of `anvil create --template <id>`, so there is
no need to vendor a copy of each in the repo.

| Folder                               | Template                | Description                             |
|--------------------------------------|-------------------------|-----------------------------------------|
| [`vanilla-js`](./vanilla-js)         | `--template vanilla-js` | Plain HTML/JS, no build step (default)  |
| [`vanilla-ts`](./vanilla-ts)         | `--template vanilla-ts` | TypeScript + Vite                       |
| [`custom-session`](./custom-session) | —                       | `session: "custom"` authentication demo |

Want React/Vue/Solid? Generate one anywhere with
`npx @thomasfarineau/anvil create my-app --template react-ts` — every template
is fully supported, it just isn't checked in here.

## Running an example

The examples run the repo's local anvil CLI straight from TypeScript source
(`bun ../../src/cli/index.ts`), so `@tauri-apps/cli` and `sharp` are not
declared here — they come with anvil itself. Install the repo dependencies
once, then run the example:

```bash
# once, at the repo root
bun install

cd examples/vanilla-ts
bun install   # framework deps only (vite…) — nothing for vanilla-js
bun run dev   # regenerates src-anvil/ automatically on first run
```

The `src-anvil/` folder (Rust backend) is generated and not committed — `anvil dev`
recreates it when missing.

Each example matches the output of:

```bash
npx @thomasfarineau/anvil create <name> --template <template>
```

## Building for Linux, Windows and macOS

[`.github/workflows/build-launcher.yml`](./.github/workflows/build-launcher.yml)
is a ready-to-use GitHub Actions workflow that compiles a launcher on all three
platforms and uploads the installers (`.AppImage`, NSIS `.exe`, `.dmg`) as build
artifacts. Copy it into your own launcher repository at
`.github/workflows/build.yml`:

```bash
mkdir -p .github/workflows
curl -o .github/workflows/build.yml \
  https://raw.githubusercontent.com/thomasfarineau/anvil/main/examples/.github/workflows/build-launcher.yml
```

It runs on demand (`workflow_dispatch`) and on version tags (`v*`). Each OS
builds its own bundle target — Tauri cannot cross-compile installers — so the
matrix uses `ubuntu-latest`, `windows-latest` and `macos-latest`.
