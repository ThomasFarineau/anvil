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

## Référence des champs

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

## Champs des instances

| Champ            | Type                                                 | Description                                                         |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `id`             | `string`                                             | Identifiant unique (utilisé comme nom de dossier)                   |
| `name`           | `string`                                             | Nom affiché sur le bouton de jeu                                    |
| `mc_version`     | `string`                                             | Version Minecraft (ex: `"1.21.4"`)                                  |
| `loader`         | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"quilt"` | Mod loader (optionnel)                                              |
| `loader_version` | `string`                                             | Version du mod loader (ex: `"0.16.9"`)                              |
| `server_ip`      | `string`                                             | IP du serveur pour connexion automatique                            |
| `server_port`    | `number`                                             | Port du serveur (défaut: `25565`)                                   |
| `mods`           | `array`                                              | Mods téléchargés dans l'instance — voir [Mods par instance](./mods) |

## Suite

- [Mods par instance](./mods)
- [Session](../session)
