import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'anvil',
  description: 'Build a native Minecraft launcher by writing only HTML.',
  base: '/anvil/',
  cleanUrls: true,
  lastUpdated: true,

  head: [['link', { rel: 'icon', href: '/anvil/logo.svg' }]],

  themeConfig: {
    logo: '/logo.svg',
    search: { provider: 'local' },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/ThomasFarineau/anvil' },
      {
        icon: 'npm',
        link: 'https://www.npmjs.com/package/@thomasfarineau/anvil',
      },
    ],
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: nav('en'),
        sidebar: sidebar('en'),
        editLink: {
          pattern:
            'https://github.com/ThomasFarineau/anvil/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © Thomas Farineau',
        },
      },
    },
    fr: {
      label: 'Français',
      lang: 'fr',
      link: '/fr/',
      themeConfig: {
        nav: nav('fr'),
        sidebar: sidebar('fr'),
        editLink: {
          pattern:
            'https://github.com/ThomasFarineau/anvil/edit/main/docs/:path',
          text: 'Éditer cette page sur GitHub',
        },
        footer: {
          message: 'Publié sous licence MIT.',
          copyright: 'Copyright © Thomas Farineau',
        },
        outline: { label: 'Sur cette page' },
        docFooter: { prev: 'Page précédente', next: 'Page suivante' },
        darkModeSwitchLabel: 'Thème',
        returnToTopLabel: 'Retour en haut',
        langMenuLabel: 'Changer de langue',
        sidebarMenuLabel: 'Menu',
      },
    },
  },
});

function nav(lang: 'en' | 'fr') {
  const t =
    lang === 'en'
      ? { guide: 'Guide', config: 'config.json', api: 'API' }
      : { guide: 'Guide', config: 'config.json', api: 'API' };
  const p = lang === 'en' ? '' : '/fr';
  return [
    { text: t.guide, link: `${p}/guide/getting-started` },
    { text: t.config, link: `${p}/config/` },
    { text: t.api, link: `${p}/api` },
  ];
}

function sidebar(lang: 'en' | 'fr') {
  const p = lang === 'en' ? '' : '/fr';
  if (lang === 'fr') {
    return [
      {
        text: 'Guide',
        items: [
          { text: 'Démarrage rapide', link: `${p}/guide/getting-started` },
          { text: 'Commandes CLI', link: `${p}/guide/commands` },
          { text: 'Structure du projet', link: `${p}/guide/project-structure` },
        ],
      },
      {
        text: 'config.json',
        items: [
          { text: 'Référence des champs', link: `${p}/config/` },
          { text: 'Mods par instance', link: `${p}/config/mods` },
        ],
      },
      { text: 'Session', link: `${p}/session` },
      { text: 'API JavaScript', link: `${p}/api` },
      { text: "Icône d'application", link: `${p}/icons` },
      { text: 'Build & distribution', link: `${p}/build` },
    ];
  }
  return [
    {
      text: 'Guide',
      items: [
        { text: 'Getting started', link: `${p}/guide/getting-started` },
        { text: 'CLI commands', link: `${p}/guide/commands` },
        { text: 'Project structure', link: `${p}/guide/project-structure` },
      ],
    },
    {
      text: 'config.json',
      items: [
        { text: 'Field reference', link: `${p}/config/` },
        { text: 'Mods per instance', link: `${p}/config/mods` },
      ],
    },
    { text: 'Session', link: `${p}/session` },
    { text: 'JavaScript API', link: `${p}/api` },
    { text: 'App icon', link: `${p}/icons` },
    { text: 'Build & distribution', link: `${p}/build` },
  ];
}
