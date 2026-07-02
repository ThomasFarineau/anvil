# Build & distribution

```bash
npm run build   # → anvil build → tauri build
```

Les artefacts de distribution sont générés dans le dossier `target` configuré :

| Plateforme | Format                             |
| ---------- | ---------------------------------- |
| Windows    | `<nom>_<ver>_x64-setup.exe` (NSIS) |
| Linux      | `<nom>_<ver>_amd64.AppImage`       |
| macOS      | `<nom>_<ver>_x64.dmg`              |
