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
MC.getSystemMemory(); // → number (RAM physique totale, en Mo)
MC.getDefaultDir(); // → string (chemin %APPDATA%/... par défaut)
MC.pickFolder(start?); // → string | null (sélecteur de dossier natif)
MC.getVersion(); // → string (version de l'application)

// Installation
MC.getInitStatus(); // → InitStatus  (java_ok, instances[] avec installed/running)
MC.runSetup(); // → void  (télécharge Java, le jeu et les mods déclarés)
MC.resetLauncherDir(); // → void (vide le dossier du launcher — irréversible)

// Événements du cycle d'installation
MC.on.install(cb);     // reset terminé ; l'installation peut démarrer
MC.on.installing(cb);  // installation en cours
MC.on.reset(cb);       // réinitialisation démarrée

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

// Compte Microsoft (session: "microsoft")
MC.microsoftSession.signIn(); // → MicrosoftLoginResult (fenêtre Xbox/Microsoft intégrée)
MC.microsoftSession.start(); // → { user_code, verification_uri, expires_in }
MC.microsoftSession.finish(); // → { username, uuid }
MC.microsoftSession.login(onCode?); // raccourci start + finish
MC.microsoftSession.restore(); // → { username, uuid } | null
MC.microsoftSession.logout(); // efface la session Microsoft locale

// Mises à jour
MC.checkUpdate(); // → UpdateInfo | null
MC.doUpdate(url); // → void

// Fenêtre
MC.close(); // ferme l'application
MC.minimize(); // réduit la fenêtre
MC.toggleMaximize(); // maximise/restaure la fenêtre
MC.startDrag(); // déplacement fenêtre (barres de titre custom)
MC.setShadow(enabled); // ombre portée native (Windows/macOS, sans effet sur Linux)

// Événements
MC.on.setupProgress(cb); // cb({ step, current, total, label, error })
MC.on.setupDone(cb); // cb()
MC.on.gameStarting(cb); // cb(instanceId)
MC.on.gameOutput(cb); // cb({ instance_id, text, stderr })
MC.on.gameExit(cb); // cb({ instance_id, code })
```

Les templates TypeScript incluent un `src/api.d.ts` avec le typage complet de `MC` et de tous les payloads.
