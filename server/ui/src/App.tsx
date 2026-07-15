import { HashRouter, Route, A, useNavigate } from '@solidjs/router';
import {
  createContext,
  createResource,
  createSignal,
  onCleanup,
  Show,
  useContext,
  type JSX,
  type Resource,
} from 'solid-js';
import { Dynamic } from 'solid-js/web';

import {
  FiChevronDown,
  FiGlobe,
  FiLogOut,
  FiMonitor,
  FiMoon,
  FiSun,
} from 'solid-icons/fi';

import { api, post, type Me } from './api';
import { locale, setLocale, t, type Locale } from './i18n';
import Account from './pages/Account';
import ApiKeys from './pages/ApiKeys';
import InstanceDetail from './pages/InstanceDetail';
import Instances from './pages/Instances';
import Login from './pages/Login';
import Players from './pages/Players';
import Users from './pages/Users';
import { setTheme, theme, type Theme } from './theme';

interface Session {
  me: Resource<Me | null>;
  refetch: () => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<Session>();

export function useSession(): Session {
  return useContext(SessionContext)!;
}

function Sidebar(props: { me: Me }) {
  const link =
    'block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-panel hover:text-accent';

  return (
    <aside class="flex w-56 shrink-0 flex-col border-r border-edge bg-panel/50 p-4">
      <div class="mb-6 flex items-center gap-2 px-2">
        <img src="/logo.svg" alt="Anvil" class="h-6 w-6" />
        <span class="text-lg font-semibold text-slate-100">
          Anvil <span class="text-accent">Server</span>
        </span>
      </div>
      <nav class="flex flex-col gap-1">
        <A href="/" end class={link} activeClass="bg-panel text-accent">
          {t('nav.instances')}
        </A>
        <A href="/players" class={link} activeClass="bg-panel text-accent">
          {t('nav.players')}
        </A>
        <Show when={props.me.role === 'admin'}>
          <A href="/users" class={link} activeClass="bg-panel text-accent">
            {t('nav.users')}
          </A>
          <A href="/keys" class={link} activeClass="bg-panel text-accent">
            {t('nav.apiKeys')}
          </A>
        </Show>
        <A href="/account" class={link} activeClass="bg-panel text-accent">
          {t('nav.account')}
        </A>
      </nav>
    </aside>
  );
}

const THEME_ICON: Record<Theme, (props: { class?: string }) => JSX.Element> = {
  dark: FiMoon,
  light: FiSun,
  system: FiMonitor,
};

function usePopover() {
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

const iconBtn =
  'flex items-center gap-1.5 rounded-md p-2 text-sm text-slate-300 transition hover:bg-panel';

function ThemeMenu() {
  const { open, setOpen, setRef } = usePopover();

  return (
    <div class="relative" ref={setRef}>
      <button
        class={iconBtn}
        title={t('menu.theme')}
        onClick={() => setOpen(!open())}>
        <Dynamic component={THEME_ICON[theme()]} />
      </button>
      <Show when={open()}>
        <div class="absolute right-0 z-10 mt-2 w-40 rounded-lg border border-edge bg-panel p-1 shadow-lg">
          {(['dark', 'light', 'system'] as Theme[]).map((opt) => (
            <button
              class={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition ${
                theme() === opt
                  ? 'text-accent'
                  : 'text-slate-300 hover:bg-surface hover:text-accent'
              }`}
              onClick={() => {
                setTheme(opt);
                setOpen(false);
              }}>
              <Dynamic component={THEME_ICON[opt]} /> {t(`theme.${opt}`)}
            </button>
          ))}
        </div>
      </Show>
    </div>
  );
}

function LanguageMenu() {
  const { open, setOpen, setRef } = usePopover();
  const langs: Array<{ code: Locale; label: string }> = [
    { code: 'en', label: 'English' },
    { code: 'fr', label: 'Français' },
  ];

  return (
    <div class="relative" ref={setRef}>
      <button
        class={iconBtn}
        title={t('menu.language')}
        onClick={() => setOpen(!open())}>
        <FiGlobe />
        <span class="text-xs font-semibold uppercase">{locale()}</span>
      </button>
      <Show when={open()}>
        <div class="absolute right-0 z-10 mt-2 w-36 rounded-lg border border-edge bg-panel p-1 shadow-lg">
          {langs.map((l) => (
            <button
              class={`block w-full rounded-md px-3 py-1.5 text-left text-sm transition ${
                locale() === l.code
                  ? 'text-accent'
                  : 'text-slate-300 hover:bg-surface hover:text-accent'
              }`}
              onClick={() => {
                setLocale(l.code);
                setOpen(false);
              }}>
              {l.label}
            </button>
          ))}
        </div>
      </Show>
    </div>
  );
}

function UserMenu(props: { me: Me }) {
  const session = useSession();
  const navigate = useNavigate();
  const { open, setOpen, setRef } = usePopover();

  const item =
    'block w-full rounded-md px-3 py-1.5 text-left text-sm text-slate-300 transition hover:bg-surface hover:text-accent';

  return (
    <div class="relative" ref={setRef}>
      <button
        class="flex items-center gap-2 rounded-md py-1.5 pr-1 pl-1.5 transition hover:bg-panel"
        onClick={() => setOpen(!open())}>
        <span class="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm font-semibold text-black uppercase">
          {props.me.username.slice(0, 1)}
        </span>
        <span class="hidden text-left md:block">
          <span class="block text-sm text-slate-200">{props.me.username}</span>
        </span>
        <FiChevronDown class="hidden text-slate-500 md:block" />
      </button>

      <Show when={open()}>
        <div class="absolute right-0 z-10 mt-2 w-52 rounded-lg border border-edge bg-panel p-2 shadow-lg">
          <div class="px-3 py-1">
            <p class="text-sm text-slate-200">{props.me.username}</p>
            <p class="text-xs text-slate-500">
              {props.me.role === 'admin' ? t('role.admin') : t('role.user')}
            </p>
          </div>
          <div class="my-1 border-t border-edge" />
          <A href="/account" class={item} onClick={() => setOpen(false)}>
            {t('nav.account')}
          </A>
          <div class="my-1 border-t border-edge" />
          <button
            class={`${item} flex items-center gap-2 text-red-400 hover:text-red-300`}
            onClick={async () => {
              await session.logout();
              navigate('/', { replace: true });
            }}>
            <FiLogOut /> {t('logout')}
          </button>
        </div>
      </Show>
    </div>
  );
}

function Header(props: { me: Me }) {
  return (
    <header class="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-edge bg-panel/70 px-6 py-3 backdrop-blur">
      <div />
      <div class="flex items-center gap-1">
        <ThemeMenu />
        <LanguageMenu />
        <UserMenu me={props.me} />
      </div>
    </header>
  );
}

function Shell(props: { children?: JSX.Element }) {
  const session = useSession();
  return (
    <Show
      when={!session.me.loading}
      fallback={<div class="p-8 text-slate-400">{t('loading')}</div>}>
      <Show when={session.me()} fallback={<Login />}>
        {(me) => (
          <div class="flex min-h-screen">
            <Sidebar me={me()} />
            <div class="flex min-w-0 flex-1 flex-col">
              <Header me={me()} />
              <main class="min-w-0 flex-1 p-8">{props.children}</main>
            </div>
          </div>
        )}
      </Show>
    </Show>
  );
}

export default function App() {
  const [version, setVersion] = createSignal(0);
  const [me, { refetch }] = createResource(version, async () => {
    try {
      return await api<Me>('/api/auth/me');
    } catch {
      return null;
    }
  });

  const session: Session = {
    me,
    refetch: () => {
      setVersion((v) => v + 1);
      void refetch();
    },
    logout: async () => {
      await post('/api/auth/logout').catch(() => {});
      session.refetch();
    },
  };

  return (
    <SessionContext.Provider value={session}>
      <HashRouter root={Shell}>
        <Route path="/" component={Instances} />
        <Route path="/instances/:id" component={InstanceDetail} />
        <Route path="/players" component={Players} />
        <Route path="/users" component={Users} />
        <Route path="/keys" component={ApiKeys} />
        <Route path="/account" component={Account} />
        <Route path="*" component={Instances} />
      </HashRouter>
    </SessionContext.Provider>
  );
}
