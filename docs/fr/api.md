# API JavaScript

Importez `api.js` dans votre HTML :

```html
<script type="module">
  import { MC } from '/api.js';
</script>
```

## Référence

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
