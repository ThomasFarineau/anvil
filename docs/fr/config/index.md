# config.json

```json
{
  "$schema": "node_modules/@thomasfarineau/anvil/src/client/config.schema.json",
  "identifier": "com.monentreprise.launcher",
  "app_name": "Mon Launcher",
  "data_folder": ".mon-launcher",
  "java_version": 21,
  "logo": "logo.svg",
  "session": "none",
  "microsoft-client-id": "",
  "update_url": "",
  "target": "dist",
  "window": {
    "decorations": true,
    "resizable": true,
    "width": 1000,
    "height": 660,
    "shadow": true,
    "transparent": false,
    "devtools": true
  },
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

## Référence des champs

| Champ                 | Type                                                         | Description                                                                                              |
| --------------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `identifier`          | `string`                                                     | Identifiant reverse-domain (ex: `com.studio.launcher`)                                                   |
| `app_name`            | `string`                                                     | Nom affiché dans la fenêtre native et l'interface                                                        |
| `data_folder`         | `string`                                                     | Sous-dossier dans `%APPDATA%` / `~/Library` pour les données du jeu                                      |
| `java_version`        | `17` \| `21`                                                 | Version Java à télécharger automatiquement                                                               |
| `logo`                | `string`                                                     | Chemin vers le logo (relatif à `src/`) — `.svg` ou `.png`, converti auto en icône                        |
| `session`             | `"none"` \| `"microsoft"` \| `"custom"` \| `"anvil-session"` | Mode d'authentification — voir [Session](../session) et [Anvil Server](../server)                        |
| `microsoft-client-id` | `string`                                                     | Identifiant d'application Microsoft Entra requis par la session `"microsoft"`                            |
| `update_url`          | `string`                                                     | URL du manifeste de mise à jour (laisser vide pour désactiver)                                           |
| `target`              | `string`                                                     | Dossier de sortie des exécutables compilés (ex: `dist`)                                                  |
| `window`              | `object`                                                     | Paramètres de la fenêtre native du launcher                                                               |
| `window.decorations`  | `boolean`                                                    | Affiche la barre de titre native                                                                          |
| `window.resizable`    | `boolean`                                                    | Autorise le redimensionnement de la fenêtre                                                               |
| `window.width`        | `integer`                                                    | Largeur initiale du launcher en pixels logiques (minimum `800`)                                           |
| `window.height`       | `integer`                                                    | Hauteur initiale du launcher en pixels logiques (minimum `520`)                                           |
| `window.shadow`       | `boolean`                                                    | Affiche l'ombre native de la fenêtre                                                                      |
| `window.transparent`  | `boolean`                                                    | Utilise un arrière-plan transparent pour la fenêtre native                                                |
| `window.devtools`     | `boolean`                                                    | Active ou désactive les outils de développement de la WebView avec `npm run dev`                          |
| `instances`           | `array`                                                      | Liste des instances Minecraft disponibles (ignorée si `anvil-server` est défini)                         |
| `anvil-server`        | `string`                                                     | URL de base d'un [anvil-server](../server) : le launcher y récupère ses instances actives au démarrage   |
| `anvil-key`           | `string`                                                     | Clé d'API générée dans l'interface web du [anvil-server](../server) — requise pour interroger le serveur |

## Champs des instances

| Champ            | Type                                                 | Description                                                                                                                                 |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`             | `string`                                             | Identifiant unique (utilisé comme nom de dossier)                                                                                           |
| `name`           | `string`                                             | Nom affiché sur le bouton de jeu                                                                                                            |
| `mc_version`     | `string`                                             | Version Minecraft (ex: `"1.21.4"`)                                                                                                          |
| `loader`         | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"quilt"` | Mod loader (optionnel)                                                                                                                      |
| `loader_version` | `string`                                             | Version du mod loader (ex: `"0.16.9"`)                                                                                                      |
| `server_ip`      | `string`                                             | IP du serveur pour connexion automatique                                                                                                    |
| `server_port`    | `number`                                             | Port du serveur (défaut: `25565`)                                                                                                           |
| `mods`           | `array`                                              | Mods téléchargés dans l'instance — voir [Mods par instance](./mods)                                                                         |
| `files`          | `array`                                              | Fichiers additionnels (`{path, url}`) déployés dans le dossier de l'instance au setup — fournis par un [anvil-server](../server) en général |

## Suite

- [Mods par instance](./mods)
- [Session](../session)
- [Anvil Server](../server)
