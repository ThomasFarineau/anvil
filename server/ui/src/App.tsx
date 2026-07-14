import { HashRouter, Route, A, useNavigate } from '@solidjs/router';
import {
  createContext,
  createResource,
  createSignal,
  Show,
  useContext,
  type JSX,
  type Resource,
} from 'solid-js';

import { api, post, type Me } from './api';
import Account from './pages/Account';
import ApiKeys from './pages/ApiKeys';
import InstanceDetail from './pages/InstanceDetail';
import Instances from './pages/Instances';
import Login from './pages/Login';
import Players from './pages/Players';
import Users from './pages/Users';

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
  const session = useSession();
  const navigate = useNavigate();
  const link =
    'block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-panel hover:text-accent';

  return (
    <aside class="flex w-56 shrink-0 flex-col border-r border-edge bg-panel/50 p-4">
      <div class="mb-6 flex items-center gap-2 px-2">
        <img src="/logo.svg" alt="anvil" class="h-6 w-6" />
        <span class="text-lg font-semibold text-slate-100">
          anvil <span class="text-accent">server</span>
        </span>
      </div>
      <nav class="flex flex-col gap-1">
        <A href="/" end class={link} activeClass="bg-panel text-accent">
          Instances
        </A>
        <A href="/players" class={link} activeClass="bg-panel text-accent">
          Joueurs
        </A>
        <Show when={props.me.role === 'admin'}>
          <A href="/users" class={link} activeClass="bg-panel text-accent">
            Utilisateurs
          </A>
          <A href="/keys" class={link} activeClass="bg-panel text-accent">
            Clés API
          </A>
        </Show>
        <A href="/account" class={link} activeClass="bg-panel text-accent">
          Mon compte
        </A>
      </nav>
      <div class="mt-auto border-t border-edge pt-4">
        <p class="px-2 text-sm text-slate-300">{props.me.username}</p>
        <p class="px-2 text-xs text-slate-500">
          {props.me.role === 'admin' ? 'Administrateur' : 'Utilisateur'}
        </p>
        <button
          class="btn-ghost mt-3 w-full justify-center"
          onClick={async () => {
            await session.logout();
            navigate('/', { replace: true });
          }}>
          Déconnexion
        </button>
      </div>
    </aside>
  );
}

function Shell(props: { children?: JSX.Element }) {
  const session = useSession();
  return (
    <Show
      when={!session.me.loading}
      fallback={<div class="p-8 text-slate-400">Chargement…</div>}>
      <Show when={session.me()} fallback={<Login />}>
        {(me) => (
          <div class="flex min-h-screen">
            <Sidebar me={me()} />
            <main class="min-w-0 flex-1 p-8">{props.children}</main>
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
