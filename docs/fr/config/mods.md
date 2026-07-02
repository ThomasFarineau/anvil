# Mods par instance

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

Voir la [référence complète de l'API JavaScript](../api) pour toutes les méthodes `MC.mods.*`.
