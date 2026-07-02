# config.json

```json
{
  "$schema": "node_modules/@thomasfarineau/anvil/src/client/config.schema.json",
  "identifier": "com.mycompany.launcher",
  "app_name": "My Launcher",
  "data_folder": ".my-launcher",
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
      "name": "Survival",
      "mc_version": "1.21.4"
    },
    {
      "id": "modded",
      "name": "Modded",
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

## Field reference

| Field                | Type                                 | Description                                                                          |
| -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------ |
| `identifier`         | `string`                             | Reverse-domain app identifier (e.g. `com.mycompany.launcher`)                        |
| `app_name`           | `string`                             | App name shown in the native window and UI                                           |
| `data_folder`        | `string`                             | Sub-folder in `%APPDATA%` / `~/Library` for game data                                |
| `java_version`       | `17` \| `21`                         | Java version to download automatically                                               |
| `logo`               | `string`                             | Path to the logo (relative to `src/`) — `.svg` or `.png`, auto-converted to app icon |
| `session`            | `"none"` \| `"mojang"` \| `"custom"` | Authentication mode                                                                  |
| `update_url`         | `string`                             | URL of the update manifest (leave empty to disable)                                  |
| `target`             | `string`                             | Output folder for compiled executables (e.g. `dist`)                                 |
| `window_decorations` | `boolean`                            | Show the native title bar                                                            |
| `window_resizable`   | `boolean`                            | Allow the user to resize the window                                                  |
| `instances`          | `array`                              | List of available Minecraft instances                                                |

## Instance fields

| Field            | Type                                                 | Description                                                         |
| ---------------- | ---------------------------------------------------- | ------------------------------------------------------------------- |
| `id`             | `string`                                             | Unique identifier (used as the folder name)                         |
| `name`           | `string`                                             | Label shown on the play button                                      |
| `mc_version`     | `string`                                             | Minecraft version (e.g. `"1.21.4"`)                                 |
| `loader`         | `"fabric"` \| `"forge"` \| `"neoforge"` \| `"quilt"` | Mod loader (optional)                                               |
| `loader_version` | `string`                                             | Mod loader version (e.g. `"0.16.9"`)                                |
| `server_ip`      | `string`                                             | Server IP for auto-connect on launch                                |
| `server_port`    | `number`                                             | Server port (default: `25565`)                                      |
| `mods`           | `array`                                              | Mods downloaded into the instance — see [Mods per instance](./mods) |

## Next steps

- [Mods per instance](./mods)
- [Session](../session)
