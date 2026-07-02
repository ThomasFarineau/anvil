# JavaScript API

Import `api.js` in your HTML:

```html
<script type="module">
  import { MC } from '/api.js';
</script>
```

## Reference

```js
// Config & settings
MC.getConfig(); // → LauncherConfig
MC.getSettings(); // → Settings
MC.saveSettings(settings); // → void
MC.getDefaultDir(); // → string  (default %APPDATA%/... path)
MC.getVersion(); // → string  (launcher app version)

// Installation
MC.getInitStatus(); // → InitStatus  (java_ok, instances[] with installed/running)
MC.runSetup(); // → void  (downloads Java, game files and declared mods)

// Game
MC.verify(instanceId); // → void  (verifies game files and declared mods)
MC.play(instanceId); // → void  (launches the game)
MC.stop(instanceId); // → void  (kills the running game process)
MC.getRunning(); // → string[]  (ids of running instances)
MC.isRunning(instanceId); // → boolean

// Mods (per instance)
MC.mods.list(instanceId); // → ModInfo[]
MC.mods.add(instanceId, url, fileName?); // → ModInfo  (downloads a .jar)
MC.mods.remove(instanceId, fileName); // → void
MC.mods.enable(instanceId, fileName); // → void
MC.mods.disable(instanceId, fileName); // → void  (renames to .jar.disabled)
MC.mods.openFolder(instanceId); // opens mods/ in the file explorer

// Folders
MC.openInstanceFolder(instanceId); // opens the instance data folder

// Session  (when session: "custom")
MC.setSession({ username, uuid, access_token });
MC.clearSession();

// Updates
MC.checkUpdate(); // → UpdateInfo | null
MC.doUpdate(url); // → void

// Window
MC.close(); // closes the application
MC.minimize(); // minimizes the window
MC.toggleMaximize(); // toggles maximized state
MC.startDrag(); // starts dragging (custom title bars)

// Events
MC.on.setupProgress(cb); // cb({ step, current, total, label, error })
MC.on.setupDone(cb); // cb()
MC.on.gameStarting(cb); // cb(instanceId)
MC.on.gameOutput(cb); // cb({ instance_id, text, stderr })
MC.on.gameExit(cb); // cb({ instance_id, code })
```

TypeScript templates ship a `src/api.d.ts` with full typings for `MC` and every payload.
