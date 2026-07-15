import { createEffect, createSignal } from 'solid-js';

export type Theme = 'dark' | 'light' | 'system';

function detect(): Theme {
  const stored = localStorage.getItem('anvil-server-theme');
  return stored === 'dark' || stored === 'light' || stored === 'system'
    ? stored
    : 'system';
}

export const [theme, setThemeSignal] = createSignal<Theme>(detect());

export function setTheme(next: Theme) {
  localStorage.setItem('anvil-server-theme', next);
  setThemeSignal(next);
}

const media = window.matchMedia('(prefers-color-scheme: dark)');

function apply() {
  document.documentElement.dataset.theme =
    theme() === 'system' ? (media.matches ? 'dark' : 'light') : theme();
}

media.addEventListener('change', () => {
  if (theme() === 'system') apply();
});

createEffect(apply);
