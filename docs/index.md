---
layout: home

hero:
  name: Anvil
  text: Build a native Minecraft launcher by writing only HTML.
  tagline: The Rust backend handles Java, downloads, launch and updates. You only touch the frontend.
  image:
    src: /logo.svg
    alt: anvil
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/ThomasFarineau/anvil

features:
  - title: Zero-config native launcher
    details: Generate a Windows · macOS · Linux launcher from a config.json file and an HTML page — no native code to write.
  - title: Java & Minecraft handled for you
    details: Downloads and manages Java, vanilla/Fabric/Forge assets, and launches the game with session management.
  - title: Any frontend you like
    details: Vanilla, React, Vue or Solid — with or without TypeScript. Eight ready-made templates.
  - title: Mods per instance
    details: Declare mods in config.json and they're downloaded, verified and kept in sync automatically.
  - title: Auto-updates & icons
    details: Ship update manifests via URL and generate every app icon size from a single logo file.
  - title: Custom sessions
    details: Bring your own authentication (OAuth, custom API…) or use offline mode out of the box.
---
