import Swal from 'sweetalert2';

import { t } from './i18n';

function isDark(): boolean {
  return document.documentElement.dataset.theme !== 'light';
}

/** Remplace window.confirm() par une modale SweetAlert2 cohérente avec le thème. */
export async function confirmDialog(
  text: string,
  options: { danger?: boolean } = {},
): Promise<boolean> {
  const result = await Swal.fire({
    text,
    icon: options.danger ? 'warning' : 'question',
    showCancelButton: true,
    confirmButtonText: t('dialog.confirm'),
    cancelButtonText: t('dialog.cancel'),
    confirmButtonColor: options.danger ? '#dc2626' : '#e8833a',
    background: isDark() ? '#161b22' : '#ffffff',
    color: isDark() ? '#e2e8f0' : '#0f172a',
  });
  return result.isConfirmed;
}

/** Remplace window.prompt() par une modale SweetAlert2 cohérente avec le thème. */
export async function promptDialog(
  text: string,
  options: {
    inputType?: 'text' | 'password';
    placeholder?: string;
    defaultValue?: string;
  } = {},
): Promise<string | null> {
  const result = await Swal.fire({
    text,
    input: options.inputType ?? 'text',
    inputPlaceholder: options.placeholder,
    inputValue: options.defaultValue ?? '',
    showCancelButton: true,
    confirmButtonText: t('dialog.confirm'),
    cancelButtonText: t('dialog.cancel'),
    background: isDark() ? '#161b22' : '#ffffff',
    color: isDark() ? '#e2e8f0' : '#0f172a',
    inputValidator: (value: string) => (value ? undefined : t('dialog.required')),
  });
  return result.isConfirmed ? (result.value as string) : null;
}
