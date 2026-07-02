# Démarrage rapide

**anvil** est un framework qui génère un launcher Minecraft natif (Windows · macOS · Linux) à partir d'un fichier `config.json` et d'une page HTML. Le backend Rust intégré gère :

- Téléchargement et gestion de Java
- Téléchargement des assets Minecraft (vanilla, Fabric, Forge…)
- Lancement du jeu avec gestion des sessions
- Mises à jour automatiques via URL
- Génération des icônes d'application

Vous ne touchez qu'au **frontend**.

## Prérequis

- [Node.js](https://nodejs.org) ≥ 18
- [Rust](https://rustup.rs) (stable)
- [Prérequis Tauri v2](https://tauri.app/start/prerequisites/) (WebView2 sur Windows, Xcode sur macOS)

### Installer Rust

**Windows** (PowerShell) :

```powershell
Invoke-WebRequest -Uri https://win.rustup.rs/x86_64 -OutFile "$env:TEMP\rustup-init.exe"; & "$env:TEMP\rustup-init.exe" -y
```

**Linux** (bash) :

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
```

**macOS** (bash, via Homebrew) :

```bash
brew install rustup && rustup-init -y
```

Redémarrez ensuite votre terminal (ou lancez `source "$HOME/.cargo/env"` sous Linux/macOS) et vérifiez avec `rustc --version`.

## Démarrage rapide

```bash
npx @thomasfarineau/anvil create mon-launcher
cd mon-launcher
npm install
npm run dev
```

`create` est interactif : choisissez **TypeScript** ou **JavaScript**, puis **Vanilla**, **React**, **Vue** ou **Solid**. Sautez les questions avec `--template` :

```bash
npx @thomasfarineau/anvil create mon-launcher --template react-ts
```

Templates disponibles : `vanilla-js` (défaut), `vanilla-ts`, `react-js`, `react-ts`, `vue-js`, `vue-ts`, `solid-js`, `solid-ts` — voir [`examples/`](https://github.com/ThomasFarineau/anvil/tree/main/examples) pour un projet prêt à l'emploi de chaque.

Ou dans un projet existant :

```bash
npm install -D @thomasfarineau/anvil
npx anvil init
npm run dev
```

## Suite

- [Commandes CLI](./commands)
- [Structure du projet](./project-structure)
- [Référence config.json](../config/)
