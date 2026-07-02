<div align="center">
  <img src="https://raw.githubusercontent.com/ThomasFarineau/anvil/refs/heads/main/logo.svg" width="96" height="96" alt="anvil" />
  <h1>anvil</h1>
  <p>Build a native Minecraft launcher by writing only HTML.<br>The Rust backend handles everything else.</p>

[![npm](https://img.shields.io/npm/v/%40thomasfarineau%2Fanvil?style=flat-square)](https://www.npmjs.com/package/@thomasfarineau/anvil)
[![release](https://img.shields.io/github/v/release/ThomasFarineau/anvil?style=flat-square)](https://github.com/ThomasFarineau/anvil/releases)
[![license](https://img.shields.io/github/license/ThomasFarineau/anvil?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/ThomasFarineau/anvil/ci.yml?style=flat-square&label=CI)](https://github.com/ThomasFarineau/anvil/actions)

</div>

---

**anvil** is a framework that generates a native Minecraft launcher (Windows · macOS · Linux) from a `config.json` file and an HTML page. The built-in Rust backend handles Java, Minecraft downloads (vanilla, Fabric, Forge…), mods, launching, sessions, auto-updates and app icons. You only touch the **frontend**.

## Quick start

```bash
npx @thomasfarineau/anvil create my-launcher
cd my-launcher
npm install
npm run dev
```

`create` is interactive: pick **TypeScript** or **JavaScript**, then **Vanilla**, **React**, **Vue** or **Solid**. Skip the prompts with `--template <id>` — see [`examples/`](./examples) for a ready-made project of each template.

## 📖 Documentation

Full docs, guides and API reference: **[thomasfarineau.github.io/anvil](https://thomasfarineau.github.io/anvil/)** ([français](https://thomasfarineau.github.io/anvil/fr/))

- [Getting started](https://thomasfarineau.github.io/anvil/guide/getting-started)
- [CLI commands](https://thomasfarineau.github.io/anvil/guide/commands)
- [Project structure](https://thomasfarineau.github.io/anvil/guide/project-structure)
- [config.json reference](https://thomasfarineau.github.io/anvil/config/)
- [Mods per instance](https://thomasfarineau.github.io/anvil/config/mods)
- [Session (offline / custom auth)](https://thomasfarineau.github.io/anvil/session)
- [JavaScript API](https://thomasfarineau.github.io/anvil/api)
- [App icon generation](https://thomasfarineau.github.io/anvil/icons)
- [Build & distribution](https://thomasfarineau.github.io/anvil/build)

## License

MIT © [Thomas Farineau](https://github.com/ThomasFarineau)
