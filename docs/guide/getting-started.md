# Getting started

**anvil** is a framework that generates a native Minecraft launcher (Windows · macOS · Linux) from a `config.json` file and an HTML page. The built-in Rust backend takes care of:

- Downloading and managing Java
- Downloading Minecraft assets (vanilla, Fabric, Forge…)
- Launching the game with session management
- Auto-updates via URL
- App icon generation from your logo

You only touch the **frontend**.

## Prerequisites

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) (stable)
- [Tauri v2 prerequisites](https://tauri.app/start/prerequisites/) (WebView2 on Windows, Xcode on macOS)

### How to install Rust

**Windows** (PowerShell):

```powershell
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile "$env:TEMP\rustup-init.exe"; & "$env:TEMP\rustup-init.exe" -y
```

**Linux** (bash):

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

**macOS** (bash, via Homebrew):

```bash
brew install rustup && rustup-init -y
```

Then restart your terminal (or run `source "$HOME/.cargo/env"` on Linux/macOS) and check with `rustc --version`.

## Quick start

```bash
npx @thomasfarineau/anvil create my-launcher
cd my-launcher
npm install
npm run dev
```

`create` is interactive: pick **TypeScript** or **JavaScript**, then **Vanilla**, **React**, **Vue** or **Solid**. Skip the prompts with `--template`:

```bash
npx @thomasfarineau/anvil create my-launcher --template react-ts
```

Available templates: `vanilla-js` (default), `vanilla-ts`, `react-js`, `react-ts`, `vue-js`, `vue-ts`, `solid-js`, `solid-ts` — see [`examples/`](https://github.com/ThomasFarineau/anvil/tree/main/examples) for a ready-made project of each.

Or in an existing project:

```bash
npm install -D @thomasfarineau/anvil
npx anvil init
npm run dev
```

## Next steps

- [CLI commands](./commands)
- [Project structure](./project-structure)
- [config.json reference](../config/)
