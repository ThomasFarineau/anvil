<div align="center">
  <img src="https://raw.githubusercontent.com/ThomasFarineau/anvil/refs/heads/main/logo.svg" width="96" height="96" alt="anvil" />
  <h1>anvil</h1>
  <p>Crée un launcher Minecraft natif en écrivant seulement du HTML.<br>Le backend Rust gère tout le reste.</p>

[![npm](https://img.shields.io/npm/v/%40thomasfarineau%2Fanvil?style=flat-square)](https://www.npmjs.com/package/@thomasfarineau/anvil)
[![release](https://img.shields.io/github/v/release/ThomasFarineau/anvil?style=flat-square)](https://github.com/ThomasFarineau/anvil/releases)
[![license](https://img.shields.io/github/license/ThomasFarineau/anvil?style=flat-square)](./LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/ThomasFarineau/anvil/ci.yml?style=flat-square&label=CI)](https://github.com/ThomasFarineau/anvil/actions)

</div>

---

**anvil** est un framework qui génère un launcher Minecraft natif (Windows · macOS · Linux) à partir d'un fichier `config.json` et d'une page HTML. Le backend Rust intégré gère :

- Téléchargement et gestion de Java
- Téléchargement des assets Minecraft (vanilla, Fabric, Forge…)
- Lancement du jeu avec gestion des sessions
- Mises à jour automatiques via URL
- Génération des icônes d'application

Vous ne touchez qu'au **frontend**.

📖 Documentation complète : **[thomasfarineau.github.io/anvil/fr](https://thomasfarineau.github.io/anvil/fr/)**

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

Templates disponibles : `vanilla-js` (défaut), `vanilla-ts`, `react-js`, `react-ts`, `vue-js`, `vue-ts`, `solid-js`, `solid-ts` — voir [`examples/`](./examples) pour un projet prêt à l'emploi de chaque.

Ou dans un projet existant :

```bash
npm install -D @thomasfarineau/anvil
npx anvil init
npm run dev
```

## Commandes

| Commande                                      | Description                                                     |
| --------------------------------------------- | --------------------------------------------------------------- |
| `npx @thomasfarineau/anvil create <nom>`      | Crée un nouveau projet dans `<nom>/` (interactif)               |
| `npx @thomasfarineau/anvil create <nom> -t X` | Crée un projet avec le template `X`, sans questions             |
| `npx anvil init`                              | Initialise anvil dans le dossier courant                        |
| `npx anvil dev`                               | Lance le launcher en mode développement                         |
| `npx anvil build`                             | Compile le launcher pour la distribution                        |
| `npx anvil update`                            | Met à jour le backend Rust et `api.js` vers la dernière version |
| `npx anvil icons`                             | Régénère les icônes d'application depuis le logo configuré      |

## Structure du projet

```
mon-launcher/
├── config.json          ← configuration du launcher
├── vite.config.*        ← uniquement pour les templates framework/TypeScript
├── src/
│   ├── index.html       ← votre interface
│   ├── api.js           ← pont JS ↔ Rust  (ne pas modifier)
│   ├── style.css        ← feuille de style de base
│   └── logo.svg         ← logo de votre launcher
└── src-anvil/           ← généré par anvil  (ne pas modifier)
```

## config.json

```json
{
  "$schema": "node_modules/@thomasfarineau/anvil/src/client/config.schema.json",
  "identifier": "com.monentreprise.launcher",
  "app_name": "Mon Launcher",
  "data_folder": ".mon-launcher",
  "java_version": 21,
  "logo": "logo.svg",
  "session": "none",
  "update_url": "",
  "target": "dist",
  "window_decorations": true,
  "window_resizable": false,
  "instances": [
    {
      "id": "survival",
      "name": "Survie",
      "mc_version": "1.21.4"
    },
    {
      "id": "modded",
      "name": "Moddé",
      "mc_version": "1.21.4",
      "loader": "fabric",
      "loader_version": "0.16.9",
      "mods": [
        {
          "name": "Sodium",
          "url": "https://cdn.modrinth.com/data/AANobbMI/versions/.../sodium-fabric-0.6.5.jar"
        }
      ]
    }
  ]
}
```

### Référence des champs

| Champ                | Type                                 | Description                                                                       |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------- |
| `identifier`         | `string`                             | Identifiant reverse-domain (ex: `com.studio.launcher`)                            |
| `app_name`           | `string`                             | Nom affiché dans la fenêtre native et l'interface                                 |
| `data_folder`        | `string`                             | Sous-dossier dans `%APPDATA%` / `~/Library` pour les données du jeu               |
| `java_version`       | `17` \| `21`                         | Version Java à télécharger automatiquement                                        |
| `logo`               | `string`                             | Chemin vers le logo (relatif à `src/`) — `.svg` ou `.png`, converti auto en icône |
| `session`            | `"none"` \| `"mojang"` \| `"custom"` | Mode d'authentification                                                           |
| `update_url`         | `string`                             | URL du manifeste de mise à jour (laisser vide pour désactiver)                    |
| `target`             | `string`                             | Dossier de sortie des exécutables compilés (ex: `dist`)                           |
| `window_decorations` | `boolean`                            | Affiche la barre de titre native                                                  |
| `window_resizable`   | `boolean`                            | Autorise le redimensionnement de la fenêtre                                       |
| `instances`          | `array`                              | Liste des instances Minecraft disponibles                                         |

### Champs des instances

| Champ            | Type                                                 | Description                                        |
| ---------------- | ---------------------------------------------------- | -------------------------------------------------- |
| `id`             | `string`                                             | Identifiant unique (utilisé comme nom de dossier)  |
| `name`           | `string`                                             | Nom affiché sur le bouton de jeu                   |
| `mc_version`     | `string`                                             | Version Minecraft (ex: `"1.21.4"`)                 |
| `loader`         | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"quilt"` | Mod loader (optionnel)                             |
| `loader_version` | `string`                                             | Version du mod loader (ex: `"0.16.9"`)             |
| `server_ip`      | `string`                                             | IP du serveur pour connexion automatique           |
| `server_port`    | `number`                                             | Port du serveur (défaut: `25565`)                  |
| `mods`           | `array`                                              | Mods téléchargés dans l'instance (voir ci-dessous) |

### Mods par instance

Chaque instance peut déclarer des mods dans `config.json`. Ils sont téléchargés dans le dossier `mods/` de l'instance pendant le setup (et resynchronisés à chaque setup : ajouter un mod plus tard fonctionne directement) :

| Champ       | Type     | Description                                          |
| ----------- | -------- | ---------------------------------------------------- |
| `url`       | `string` | URL de téléchargement direct du `.jar` (obligatoire) |
| `name`      | `string` | Nom affiché dans l'interface                         |
| `file_name` | `string` | Nom de fichier cible (défaut : nom de l'URL)         |

Les joueurs peuvent aussi gérer les mods à l'exécution via l'API — lister, ajouter depuis une URL, activer/désactiver (renommage en `.jar.disabled`) et supprimer :

```js
await MC.mods.list('modded'); // → ModInfo[] { file_name, name, enabled, size, managed }
await MC.mods.add('modded', 'https://…/mod.jar');
await MC.mods.disable('modded', 'sodium-fabric-0.6.5.jar');
await MC.mods.enable('modded', 'sodium-fabric-0.6.5.jar');
await MC.mods.remove('modded', 'un-mod.jar'); // les mods déclarés en config sont re-téléchargés au prochain setup
await MC.mods.openFolder('modded'); // ouvre mods/ dans l'explorateur
```

Les mods déclarés dans `config.json` sont `managed: true` — le template par défaut masque leur bouton de suppression, et `verify` les signale s'ils manquent.

## Session

### `"none"` — Offline

Le joueur entre son pseudo directement dans l'interface. Aucune authentification requise.

### `"custom"` — Authentification externe

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

## API JavaScript

Importez `api.js` dans votre HTML :

```html
<script type="module">
  import { MC } from '/api.js';
</script>
```

### Référence

```js
// Config & paramètres
MC.getConfig(); // → LauncherConfig
MC.getSettings(); // → Settings
MC.saveSettings(settings); // → void
MC.getDefaultDir(); // → string (chemin %APPDATA%/... par défaut)
MC.getVersion(); // → string (version de l'application)

// Installation
MC.getInitStatus(); // → InitStatus  (java_ok, instances[] avec installed/running)
MC.runSetup(); // → void  (télécharge Java, le jeu et les mods déclarés)

// Jeu
MC.verify(instanceId); // → void  (vérifie les fichiers et les mods déclarés)
MC.play(instanceId); // → void  (lance le jeu)
MC.stop(instanceId); // → void  (arrête le processus du jeu)
MC.getRunning(); // → string[]  (ids des instances en cours)
MC.isRunning(instanceId); // → boolean

// Mods (par instance)
MC.mods.list(instanceId); // → ModInfo[]
MC.mods.add(instanceId, url, fileName?); // → ModInfo  (télécharge un .jar)
MC.mods.remove(instanceId, fileName); // → void
MC.mods.enable(instanceId, fileName); // → void
MC.mods.disable(instanceId, fileName); // → void  (renomme en .jar.disabled)
MC.mods.openFolder(instanceId); // ouvre mods/ dans l'explorateur

// Dossiers
MC.openInstanceFolder(instanceId); // ouvre le dossier de l'instance

// Session  (session: "custom")
MC.setSession({ username, uuid, access_token });
MC.clearSession();

// Mises à jour
MC.checkUpdate(); // → UpdateInfo | null
MC.doUpdate(url); // → void

// Fenêtre
MC.close(); // ferme l'application
MC.minimize(); // réduit la fenêtre
MC.toggleMaximize(); // maximise/restaure la fenêtre
MC.startDrag(); // déplacement fenêtre (barres de titre custom)

// Événements
MC.on.setupProgress(cb); // cb({ step, current, total, label, error })
MC.on.setupDone(cb); // cb()
MC.on.gameStarting(cb); // cb(instanceId)
MC.on.gameOutput(cb); // cb({ instance_id, text, stderr })
MC.on.gameExit(cb); // cb({ instance_id, code })
```

Les templates TypeScript incluent un `src/api.d.ts` avec le typage complet de `MC` et de tous les payloads.

## Icône d'application

Placez votre logo dans `src/` et renseignez le champ `logo` dans `config.json`. anvil le convertit automatiquement en icônes multi-tailles :

- `.svg` → converti en PNG via **sharp**, puis généré en toutes tailles
- `.png` → utilisé directement (recommandé : 1024×1024)

Les icônes sont générées au `create`/`init`, puis **régénérées automatiquement au `dev`/`build` dès que le fichier logo change** (un hash du contenu est stocké dans `src-anvil/.logo-hash`). `npx anvil icons` force la régénération.

## Build & distribution

```bash
npm run build   # → anvil build → tauri build
```

Les artefacts de distribution sont générés dans le dossier `target` configuré :

| Plateforme | Format                             |
| ---------- | ---------------------------------- |
| Windows    | `<nom>_<ver>_x64-setup.exe` (NSIS) |
| Linux      | `<nom>_<ver>_amd64.AppImage`       |
| macOS      | `<nom>_<ver>_x64.dmg`              |

## Licence

MIT © [Thomas Farineau](https://github.com/ThomasFarineau)
