import { createSignal, onCleanup } from 'solid-js';

/** Popover simple : ouvert/fermé + fermeture au clic extérieur. */
export function usePopover() {
  const [open, setOpen] = createSignal(false);
  let ref: HTMLDivElement | undefined;

  const onDocClick = (e: MouseEvent) => {
    if (ref && !ref.contains(e.target as Node)) setOpen(false);
  };
  document.addEventListener('click', onDocClick);
  onCleanup(() => document.removeEventListener('click', onDocClick));

  return {
    open,
    setOpen,
    setRef: (el: HTMLDivElement) => (ref = el),
  };
}
