# Build & distribution

```bash
npm run build   # → anvil build → tauri build
```

Distribution artifacts are generated in the `target` folder configured in `config.json`:

| Platform | Format                              |
| -------- | ----------------------------------- |
| Windows  | `<name>_<ver>_x64-setup.exe` (NSIS) |
| Linux    | `<name>_<ver>_amd64.AppImage`       |
| macOS    | `<name>_<ver>_x64.dmg`              |
