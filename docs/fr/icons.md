# Icône d'application

Placez votre logo dans `src/` et renseignez le champ `logo` dans `config.json`. anvil le convertit automatiquement en icônes multi-tailles :

- `.svg` → converti en PNG via **sharp**, puis généré en toutes tailles
- `.png` → utilisé directement (recommandé : 1024×1024)

Les icônes sont générées au `create`/`init`, puis **régénérées automatiquement au `dev`/`build` dès que le fichier logo change** (un hash du contenu est stocké dans `src-anvil/.logo-hash`). `npx anvil icons` force la régénération.
