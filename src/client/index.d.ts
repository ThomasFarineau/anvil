export interface ModConfig {
  url: string;
  name?: string;
  file_name?: string;
}

export interface FileConfig {
  path: string;
  url: string;
}

export interface InstanceConfig {
  id: string;
  name: string;
  mc_version: string;
  loader: string;
  loader_version: string;
  server_ip: string;
  server_port: number;
  mods: ModConfig[];
  files: FileConfig[];
}

export interface LauncherConfig {
  identifier: string;
  app_name: string;
  target: string;
  data_folder: string;
  java_version: number;
  update_url: string;
  logo: string;
  session: 'none' | 'microsoft' | 'custom' | 'anvil-session';
  'microsoft-client-id': string;
  window: {
    decorations: boolean;
    resizable: boolean;
    width: number;
    height: number;
    shadow: boolean;
    transparent: boolean;
    devtools: boolean;
  };
  'anvil-server': string;
  'anvil-key': string;
  instances: InstanceConfig[];
}

export interface CustomSession {
  username: string;
  uuid: string;
  access_token: string;
  xuid?: string;
  client_id?: string;
}

export interface Settings {
  username: string;
  launcher_dir: string | null;
  /** JVM -Xms, in MB */
  min_memory: number;
  /** JVM -Xmx, in MB */
  max_memory: number;
}

export interface InstanceStatus {
  id: string;
  name: string;
  installed: boolean;
  running: boolean;
}

export interface InitStatus {
  launcher_dir: string;
  java_ok: boolean;
  instances: InstanceStatus[];
}

export interface ModInfo {
  file_name: string;
  name: string;
  enabled: boolean;
  size: number;
  managed: boolean;
}

export interface SetupProgress {
  step: string;
  current: number;
  total: number;
  label: string;
  error: boolean;
}

export interface GameOutput {
  instance_id: string;
  text: string;
  stderr: boolean;
}

export interface GameExit {
  instance_id: string;
  code: number;
}

export interface UpdateInfo {
  version: string;
  url: string;
  notes: string;
}

export interface AnvilLoginResult {
  status: 'ok' | 'totp_required';
  username: string;
  uuid: string;
}

export interface MicrosoftDeviceCode {
  user_code: string;
  verification_uri: string;
  expires_in: number;
}

export interface MicrosoftLoginResult {
  username: string;
  uuid: string;
}

export declare const MC: {
  getConfig(): Promise<LauncherConfig>;
  getSettings(): Promise<Settings>;
  saveSettings(s: Settings): Promise<void>;
  /** Total physical RAM of the machine, in MB */
  getSystemMemory(): Promise<number>;
  getDefaultDir(): Promise<string>;
  /** Native folder picker; resolves to null when cancelled */
  pickFolder(start?: string | null): Promise<string | null>;
  getVersion(): Promise<string>;
  getInitStatus(): Promise<InitStatus>;
  runSetup(): Promise<void>;
  /** Wipes the launcher folder — game, Java, instances and saves. Irreversible. */
  resetLauncherDir(): Promise<void>;
  verify(instanceId: string): Promise<void>;
  play(instanceId: string): Promise<void>;
  stop(instanceId: string): Promise<void>;
  getRunning(): Promise<string[]>;
  isRunning(instanceId: string): Promise<boolean>;
  mods: {
    list(instanceId: string): Promise<ModInfo[]>;
    add(
      instanceId: string,
      url: string,
      fileName?: string | null,
    ): Promise<ModInfo>;
    remove(instanceId: string, fileName: string): Promise<void>;
    enable(instanceId: string, fileName: string): Promise<void>;
    disable(instanceId: string, fileName: string): Promise<void>;
    openFolder(instanceId: string): Promise<void>;
  };
  openInstanceFolder(instanceId: string): Promise<void>;
  checkUpdate(): Promise<UpdateInfo | null>;
  doUpdate(url: string): Promise<void>;
  setSession(session: CustomSession): Promise<void>;
  clearSession(): Promise<void>;
  microsoftSession: {
    /** In-app login window; no external browser, no code to copy */
    signIn(): Promise<MicrosoftLoginResult>;
    start(): Promise<MicrosoftDeviceCode>;
    finish(): Promise<MicrosoftLoginResult>;
    login(
      onCode?: (code: MicrosoftDeviceCode) => void | Promise<void>,
    ): Promise<MicrosoftLoginResult>;
    restore(): Promise<MicrosoftLoginResult | null>;
    logout(): Promise<void>;
  };
  anvilSession: {
    login(
      username: string,
      password: string,
      code?: string | null,
    ): Promise<AnvilLoginResult>;
    restore(): Promise<AnvilLoginResult | null>;
    logout(): Promise<void>;
  };
  close(): Promise<void>;
  minimize(): Promise<void>;
  toggleMaximize(): Promise<void>;
  startDrag(): Promise<void>;
  /** Native drop shadow — Windows and macOS only, no-op on Linux */
  setShadow(enabled: boolean): Promise<void>;
  on: {
    install(cb: () => void): Promise<() => void>;
    installing(cb: () => void): Promise<() => void>;
    reset(cb: () => void): Promise<() => void>;
    setupProgress(cb: (p: SetupProgress) => void): Promise<() => void>;
    setupDone(cb: () => void): Promise<() => void>;
    gameStarting(cb: (instanceId: string) => void): Promise<() => void>;
    gameOutput(cb: (o: GameOutput) => void): Promise<() => void>;
    gameExit(cb: (e: GameExit) => void): Promise<() => void>;
  };
};
