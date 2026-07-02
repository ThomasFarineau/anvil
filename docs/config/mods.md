# Mods per instance

Each instance can declare mods in `config.json`. They are downloaded into the instance's `mods/` folder during setup (and re-synced on every setup run, so adding a mod later just works):

| Field       | Type     | Description                                      |
| ----------- | -------- | ------------------------------------------------ |
| `url`       | `string` | Direct download URL of the mod `.jar` (required) |
| `name`      | `string` | Display name shown in the UI                     |
| `file_name` | `string` | Target file name (defaults to the URL basename)  |

Players can also manage mods at runtime through the API — list, add from URL, enable/disable (renames to `.jar.disabled`) and remove:

```js
await MC.mods.list('modded'); // → ModInfo[] { file_name, name, enabled, size, managed }
await MC.mods.add('modded', 'https://…/mod.jar');
await MC.mods.disable('modded', 'sodium-fabric-0.6.5.jar');
await MC.mods.enable('modded', 'sodium-fabric-0.6.5.jar');
await MC.mods.remove('modded', 'some-mod.jar'); // config-managed mods are re-downloaded at next setup
await MC.mods.openFolder('modded'); // opens mods/ in the file explorer
```

Mods declared in `config.json` are `managed: true` — the default template UI hides their delete button, and `verify` reports them when missing.

See the [full JavaScript API reference](../api) for every `MC.mods.*` method.
