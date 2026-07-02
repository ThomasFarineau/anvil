# App icon

Place your logo in `src/` and set the `logo` field in `config.json`. anvil converts it automatically to all required icon sizes:

- `.svg` → converted to PNG via **sharp**, then generated at all sizes
- `.png` → used directly (recommended: 1024×1024)

Icons are generated on `create`/`init`, and **regenerated automatically on `dev`/`build` whenever the logo file changes** (a content hash is kept in `src-anvil/.logo-hash`). Run `npx anvil icons` to force a regeneration.
