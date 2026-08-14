use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use chrono::{Local, Utc};
use futures_util::{StreamExt, TryStreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

// ── URLs ──────────────────────────────────────────────────────────────────────

const MANIFEST_URL:  &str = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const RESOURCES_URL: &str = "https://resources.download.minecraft.net/";
const MICROSOFT_DEVICE_CODE_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/devicecode";
const MICROSOFT_TOKEN_URL:       &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";
const MICROSOFT_LOGIN_WINDOW:    &str = "anvil-microsoft-login";
const MICROSOFT_AUTHORIZE_URL:   &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
// URI de redirection standard des applications de bureau. La page n'est jamais
// chargée : la navigation est interceptée pour en extraire le code.
const MICROSOFT_REDIRECT_URI:    &str = "https://login.microsoftonline.com/common/oauth2/nativeclient";
const XBOX_USER_AUTH_URL:        &str = "https://user.auth.xboxlive.com/user/authenticate";
const XSTS_AUTH_URL:             &str = "https://xsts.auth.xboxlive.com/xsts/authorize";
// Endpoint public des launchers tiers. /launcher/login est réservé au
// launcher officiel et répond 403 pour tout autre client_id.
const MINECRAFT_LOGIN_URL:       &str = "https://api.minecraftservices.com/authentication/login_with_xbox";
const MINECRAFT_PROFILE_URL:     &str = "https://api.minecraftservices.com/minecraft/profile";
const MICROSOFT_SCOPE:           &str = "XboxLive.SignIn XboxLive.offline_access";

// ── Config (config.json) ──────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ModConfig {
    pub url: String,
    #[serde(default)] pub name:      String,
    #[serde(default)] pub file_name: String,
}

/// Fichier arbitraire (config de mod, options.txt…) déployé dans le dossier
/// de l'instance pendant le setup. Servi par un anvil-server en général.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct FileConfig {
    pub path: String,
    pub url:  String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct InstanceConfig {
    pub id:             String,
    // name / mc_version sont optionnels dans config.json : une instance
    // `{ "id": "..." }` est résolue au démarrage auprès du anvil-server.
    #[serde(default)] pub name:           String,
    #[serde(default)] pub mc_version:     String,
    #[serde(default)] pub loader:         String,
    #[serde(default)] pub loader_version: String,
    #[serde(default)] pub server_ip:      String,
    #[serde(default = "default_port")] pub server_port: u16,
    #[serde(default)] pub mods:           Vec<ModConfig>,
    #[serde(default)] pub files:          Vec<FileConfig>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WindowConfig {
    #[serde(default = "default_true")]          pub decorations: bool,
    #[serde(default = "default_true")]          pub resizable: bool,
    #[serde(default = "default_window_width")]  pub width: u32,
    #[serde(default = "default_window_height")] pub height: u32,
    #[serde(default = "default_true")]          pub shadow: bool,
    #[serde(default)]                            pub transparent: bool,
    #[serde(default = "default_true")]          pub devtools: bool,
}

impl Default for WindowConfig {
    fn default() -> Self {
        Self { decorations: true, resizable: true, width: default_window_width(),
               height: default_window_height(), shadow: true, transparent: false, devtools: true }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct LauncherConfig {
    #[serde(default)]                          pub identifier:         String,
    #[serde(default = "default_data_folder")] pub data_folder:        String,
    #[serde(default = "default_java")]         pub java_version:       u8,
    #[serde(default)]                          pub update_url:         String,
    #[serde(default = "default_app_name")]     pub app_name:           String,
    #[serde(default)]                           pub window:             WindowConfig,
    #[serde(default)]                          pub logo:               String,
    #[serde(default = "default_session")]      pub session:            String,
    #[serde(rename = "microsoft-client-id", default)]
                                                pub microsoft_client_id: String,
    #[serde(rename = "anvil-server", default)] pub anvil_server:       String,
    #[serde(rename = "anvil-key", default)]    pub anvil_key:          String,
    #[serde(default)]                          pub instances:          Vec<InstanceConfig>,
}

fn default_data_folder() -> String { "HomeLauncher".into() }
fn default_app_name()    -> String { "HomeLauncher".into() }
fn default_java()        -> u8     { 21 }
fn default_port()        -> u16    { 25565 }
fn default_true()        -> bool   { true }
fn default_session()     -> String { "none".into() }
fn default_window_width()  -> u32  { 1000 }
fn default_window_height() -> u32  { 660 }

impl Default for LauncherConfig {
    fn default() -> Self {
        Self {
            identifier:         String::new(),
            data_folder:        default_data_folder(),
            java_version:       default_java(),
            update_url:         String::new(),
            app_name:           default_app_name(),
            window:             WindowConfig::default(),
            logo:               String::new(),
            session:            default_session(),
            microsoft_client_id: String::new(),
            anvil_server:       String::new(),
            anvil_key:          String::new(),
            instances:          Vec::new(),
        }
    }
}

// ── Settings utilisateur ──────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Settings {
    #[serde(default)] pub username:     String,
    #[serde(default)] pub launcher_dir: Option<String>,
    #[serde(default = "default_min_memory")] pub min_memory: u32,
    #[serde(default = "default_memory")]     pub max_memory: u32,
}

fn default_min_memory() -> u32 { 1024 }
fn default_memory()     -> u32 { 2048 }

impl Default for Settings {
    fn default() -> Self {
        Self {
            username:     String::new(),
            launcher_dir: None,
            min_memory:   default_min_memory(),
            max_memory:   default_memory(),
        }
    }
}

// ── Session custom ────────────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct CustomSession {
    pub username:     String,
    pub uuid:         String,
    pub access_token: String,
    #[serde(default)] pub xuid:      String,
    #[serde(default)] pub client_id: String,
}

#[derive(Serialize, Clone, Debug)]
pub struct MicrosoftDeviceCode {
    pub user_code:        String,
    pub verification_uri: String,
    pub expires_in:       u64,
}

#[derive(Serialize, Clone, Debug)]
pub struct MicrosoftLoginResult {
    pub username: String,
    pub uuid:     String,
}

#[derive(Clone, Debug)]
struct MicrosoftPendingLogin {
    client_id:   String,
    device_code: String,
    interval:    u64,
    expires_at:  i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct MicrosoftAuthCache {
    client_id:              String,
    refresh_token:          String,
    minecraft_access_token: String,
    minecraft_expires_at:   i64,
    username:               String,
    uuid:                   String,
    #[serde(default)] xuid: String,
}

// ── État global ───────────────────────────────────────────────────────────────

pub struct AppState {
    pub config:         LauncherConfig,
    pub settings:       Mutex<Settings>,
    pub data_dir:       PathBuf,
    pub custom_session: Mutex<Option<CustomSession>>,
    microsoft_login:    Mutex<Option<MicrosoftPendingLogin>>,
    pub running:        Mutex<HashMap<String, std::sync::Arc<Mutex<std::process::Child>>>>,
}

// ── Types Mojang (internes) ───────────────────────────────────────────────────

#[derive(Deserialize)]
struct ManifestJson { versions: Vec<ManifestEntry> }

#[derive(Deserialize)]
struct ManifestEntry { id: String, url: String }

#[derive(Deserialize, Default)]
struct VersionJson {
    #[serde(rename = "mainClass", default)] main_class:  String,
    #[serde(default)] assets:    String,
    #[serde(rename = "assetIndex")] asset_index: Option<AssetIndexRef>,
    #[serde(default)] downloads: HashMap<String, FileDownload>,
    #[serde(default)] libraries: Vec<LibEntry>,
    arguments:        Option<GameArgs>,
    #[serde(rename = "minecraftArguments")] legacy_args: Option<String>,
    #[serde(rename = "inheritsFrom")] inherits_from: Option<String>,
}

#[derive(Deserialize, Clone)]
struct AssetIndexRef { id: String, url: String }

#[derive(Deserialize, Clone)]
struct FileDownload {
    #[serde(default)] url: String,
    path: Option<String>,
}

#[derive(Deserialize, Clone)]
struct LibEntry {
    name:      String,
    downloads: Option<LibDownloads>,
    rules:     Option<Vec<OsRule>>,
    url:       Option<String>,
}

#[derive(Deserialize, Clone)]
struct LibDownloads {
    artifact:    Option<FileDownload>,
    classifiers: Option<HashMap<String, FileDownload>>,
}

#[derive(Deserialize, Clone)]
struct OsRule { action: String, os: Option<OsSpec> }

#[derive(Deserialize, Clone)]
struct OsSpec { name: Option<String> }

#[derive(Deserialize, Clone, Default)]
struct GameArgs {
    #[serde(default)] game: Vec<serde_json::Value>,
    #[serde(default)] jvm:  Vec<serde_json::Value>,
}

#[derive(Deserialize)]
struct AssetIndex { objects: HashMap<String, AssetObj> }

#[derive(Deserialize)]
struct AssetObj { hash: String }

// ── Types Adoptium ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct AdoptiumEntry { binary: AdoptiumBinary }
#[derive(Deserialize)]
struct AdoptiumBinary { package: AdoptiumPackage }
#[derive(Deserialize)]
struct AdoptiumPackage { link: String }

// ── Types updater ─────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct UpdateManifest {
    version: String,
    #[serde(default)] windows: String,
    #[serde(default)] linux:   String,
    #[serde(default)] macos:   String,
    #[serde(default)] notes:   String,
}

// ── Events Tauri ──────────────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
struct SetupProgress { step: String, current: usize, total: usize, label: String, #[serde(default)] error: bool }

#[derive(Serialize, Clone)]
struct GameOutput { instance_id: String, text: String, stderr: bool }

#[derive(Serialize, Clone)]
pub struct InstanceStatus {
    pub id:        String,
    pub name:      String,
    pub installed: bool,
    pub running:   bool,
}

#[derive(Serialize, Clone)]
pub struct ModInfo {
    pub file_name: String,
    pub name:      String,
    pub enabled:   bool,
    pub size:      u64,
    pub managed:   bool,
}

#[derive(Serialize, Clone)]
pub struct InitStatus {
    pub launcher_dir: String,
    pub java_ok:      bool,
    pub instances:    Vec<InstanceStatus>,
}

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub version: String,
    pub url:     String,
    pub notes:   String,
}

// ── Utilitaires OS ────────────────────────────────────────────────────────────

fn os_name() -> &'static str {
    if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "osx" } else { "linux" }
}

fn native_classifier() -> &'static str {
    if cfg!(windows) { "natives-windows" } else if cfg!(target_os = "macos") { "natives-osx" } else { "natives-linux" }
}

// ── Chemins ───────────────────────────────────────────────────────────────────

fn default_launcher_dir(cfg: &LauncherConfig) -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| dirs::home_dir().unwrap_or_default())
        .join(&cfg.data_folder)
}

fn get_launcher_dir(s: &Settings, cfg: &LauncherConfig) -> PathBuf {
    s.launcher_dir.as_deref().map(PathBuf::from).unwrap_or_else(|| default_launcher_dir(cfg))
}

/// Dossier partagé : versions, libraries, assets
fn shared_game_dir(launcher_dir: &Path) -> PathBuf { launcher_dir.join("game") }

/// Dossier propre à l'instance : saves, options.txt, etc.
fn instance_data_dir(launcher_dir: &Path, instance: &InstanceConfig) -> PathBuf {
    launcher_dir.join("instances").join(&instance.id)
}

fn log_dir(launcher_dir: &Path) -> PathBuf { launcher_dir.join("logs") }

/// Dossier mods/ de l'instance (lu par Fabric/Forge/Quilt depuis le game dir)
fn mods_dir(launcher_dir: &Path, inst: &InstanceConfig) -> PathBuf {
    instance_data_dir(launcher_dir, inst).join("mods")
}

fn mod_file_name(m: &ModConfig) -> String {
    if !m.file_name.is_empty() { return m.file_name.clone(); }
    let base = m.url.split(['?', '#']).next().unwrap_or(&m.url);
    let name = base.rsplit('/').next().filter(|n| !n.is_empty()).unwrap_or("mod.jar");
    if name.ends_with(".jar") { name.to_string() } else { format!("{name}.jar") }
}

fn check_file_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("Nom de fichier invalide : '{name}'"));
    }
    Ok(())
}

fn open_in_file_manager(path: &Path) -> Result<(), String> {
    std::fs::create_dir_all(path).map_err(|e| e.to_string())?;
    let cmd = if cfg!(windows) { "explorer" }
              else if cfg!(target_os = "macos") { "open" }
              else { "xdg-open" };
    std::process::Command::new(cmd).arg(path).spawn()
        .map(|_| ())
        .map_err(|e| format!("Impossible d'ouvrir le dossier : {e}"))
}

fn find_bundled_java(launcher_dir: &Path) -> Option<PathBuf> {
    let java_dir = launcher_dir.join("java");
    let bin = if cfg!(windows) { "javaw.exe" } else { "java" };
    let direct = java_dir.join("bin").join(bin);
    if direct.exists() { return Some(direct); }
    if let Ok(entries) = std::fs::read_dir(&java_dir) {
        for e in entries.flatten() {
            if e.path().is_dir() {
                let c = e.path().join("bin").join(bin);
                if c.exists() { return Some(c); }
            }
        }
    }
    None
}

fn version_folder(inst: &InstanceConfig) -> String {
    if !inst.loader.is_empty() {
        format!("{}-loader-{}-{}", inst.loader, inst.loader_version, inst.mc_version)
    } else {
        inst.mc_version.clone()
    }
}

fn is_instance_installed(launcher_dir: &Path, inst: &InstanceConfig) -> bool {
    // Un fichier de version seul ne suffit pas : une configuration interrompue
    // peut laisser le JSON sur disque alors que le client ou des bibliothèques
    // manquent encore. Dans ce cas, on repasse par l'installation (les fichiers
    // déjà présents restent servis depuis le cache).
    verify_instance(launcher_dir, inst).is_ok()
}

// ── Logs ──────────────────────────────────────────────────────────────────────

fn launcher_log(log_dir: &Path, msg: &str) {
    let _ = std::fs::create_dir_all(log_dir);
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true).append(true).open(log_dir.join("launcher.log"))
    {
        let ts = Local::now().format("%Y-%m-%d %H:%M:%S");
        let _ = writeln!(f, "[{ts}] {msg}");
    }
}

// ── Chargement config.json ────────────────────────────────────────────────────

fn find_config_json(app: &AppHandle) -> LauncherConfig {
    // In development, the project file is the source of truth. Tauri also
    // copies bundle resources into target/debug, but that copy may lag behind
    // config.json when the dev command is restarted or the file is edited.
    #[cfg(debug_assertions)]
    {
        let p = Path::new(env!("CARGO_MANIFEST_DIR")).join("..").join("config.json");
        if let Ok(s) = std::fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str::<LauncherConfig>(&s) { return cfg; }
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("config.json");
        if let Ok(s) = std::fs::read_to_string(&p) {
            if let Ok(cfg) = serde_json::from_str::<LauncherConfig>(&s) { return cfg; }
        }
    }
    if let Ok(exe) = std::env::current_exe() {
        let mut dir = exe.parent().map(PathBuf::from);
        for _ in 0..8 {
            if let Some(d) = dir.take() {
                let p = d.join("config.json");
                if let Ok(s) = std::fs::read_to_string(&p) {
                    if let Ok(cfg) = serde_json::from_str::<LauncherConfig>(&s) { return cfg; }
                }
                dir = d.parent().map(PathBuf::from);
            }
        }
    }
    LauncherConfig::default()
}

// ── anvil-server ──────────────────────────────────────────────────────────────

fn anvil_server_url(cfg: &LauncherConfig) -> Result<String, String> {
    let url = cfg.anvil_server.trim().trim_end_matches('/');
    if url.is_empty() {
        return Err("Aucun serveur anvil configuré (champ 'anvil-server' de config.json).".into());
    }
    Ok(url.to_string())
}

fn anvil_cache_file(data_dir: &Path) -> PathBuf {
    data_dir.join("anvil-server-cache").join("instances.json")
}

/// Clé d'API à joindre si l'URL cible le anvil-server configuré.
/// Les URLs externes (CDN de mods…) ne reçoivent jamais la clé.
fn anvil_key_for<'a>(cfg: &'a LauncherConfig, url: &str) -> Option<&'a str> {
    if cfg.anvil_key.is_empty() { return None; }
    match anvil_server_url(cfg) {
        Ok(server) if url.starts_with(&server) => Some(cfg.anvil_key.as_str()),
        _ => None,
    }
}

async fn fetch_remote_instances(
    client: &reqwest::Client,
    cfg:    &LauncherConfig,
    server: &str,
) -> Result<Vec<InstanceConfig>, String> {
    let mut req = client.get(format!("{server}/api/launcher/instances"));
    if !cfg.anvil_key.is_empty() { req = req.header("x-anvil-key", &cfg.anvil_key); }
    let resp = req.send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}", resp.status()));
    }
    resp.json::<Vec<InstanceConfig>>().await.map_err(|e| e.to_string())
}

/// Récupère la liste des instances actives auprès du anvil-server (le
/// config.json ne déclare plus les instances, seulement le serveur et la
/// clé d'API). La liste est mise en cache sur disque afin que le launcher
/// reste utilisable hors-ligne.
fn resolve_remote_instances(config: &mut LauncherConfig, data_dir: &Path, logs: &Path) {
    let Ok(server) = anvil_server_url(config) else { return };
    let cache_file = anvil_cache_file(data_dir);

    tauri::async_runtime::block_on(async {
        let Ok(client) = reqwest::Client::builder()
            .user_agent("HomeLauncher/1.0")
            .timeout(std::time::Duration::from_secs(8))
            .build() else { return };

        match fetch_remote_instances(&client, config, &server).await {
            Ok(mut remote) => {
                // Un identifiant est la clé d'une instance : ne jamais afficher
                // deux fois la même entrée si le serveur renvoie un doublon.
                let mut seen = std::collections::HashSet::new();
                remote.retain(|inst| seen.insert(inst.id.clone()));
                launcher_log(logs, &format!(
                    "anvil-server: {} instance(s) résolue(s)", remote.len()
                ));
                let _ = save_json(&cache_file, &remote);
                config.instances = remote;
            }
            Err(e) => {
                launcher_log(logs, &format!(
                    "anvil-server: échec ({e}) — utilisation du cache"
                ));
                if let Ok(text) = std::fs::read_to_string(&cache_file) {
                    if let Ok(cached) = serde_json::from_str::<Vec<InstanceConfig>>(&text) {
                        config.instances = cached;
                    }
                }
            }
        }
    });
}

// ── Utilitaires JSON ──────────────────────────────────────────────────────────

fn load_json<T: serde::de::DeserializeOwned + Default>(path: &Path) -> T {
    std::fs::read_to_string(path).ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn save_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    if let Some(p) = path.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
    std::fs::write(path, serde_json::to_string_pretty(value).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())
}

#[cfg(all(windows, debug_assertions))]
fn disable_native_devtools(window: &tauri::WebviewWindow) {
    let _ = window.with_webview(|webview| unsafe {
        if let Ok(core) = webview.controller().CoreWebView2() {
            if let Ok(settings) = core.Settings() {
                let _ = settings.SetAreDevToolsEnabled(false);
            }
        }
    });
}

fn save_private_json<T: Serialize>(path: &Path, value: &T) -> Result<(), String> {
    save_json(path, value)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ── Utilitaires Minecraft ─────────────────────────────────────────────────────

fn lib_applies(lib: &LibEntry) -> bool {
    let Some(rules) = &lib.rules else { return true };
    let mut allow = false;
    for rule in rules {
        let os_match = rule.os.as_ref().and_then(|o| o.name.as_deref())
            .map_or(true, |n| n == os_name());
        if os_match { allow = rule.action == "allow"; }
    }
    allow
}

fn maven_path(name: &str) -> String {
    let p: Vec<&str> = name.splitn(3, ':').collect();
    if p.len() < 3 { return name.replace(':', "/"); }
    format!("{}/{}/{}/{}-{}.jar", p[0].replace('.', "/"), p[1], p[2], p[1], p[2])
}

/// Maven coordinate without its version: "group:artifact[:classifier]".
/// Used to dedupe libraries so a single ASM/Guava/etc. survives on the
/// classpath — Fabric aborts if two versions of the same jar are present.
fn lib_key(name: &str) -> String {
    let p: Vec<&str> = name.split(':').collect();
    if p.len() < 3 { return name.to_string(); }
    // Keep group:artifact plus any classifier (index 3+), drop the version.
    let mut key = format!("{}:{}", p[0], p[1]);
    for extra in &p[3..] { key.push(':'); key.push_str(extra); }
    key
}

/// Collapse a merged (vanilla + loader) library list so each coordinate
/// appears once. The later entry wins — loader libraries follow the parent's
/// in the merge, so Fabric's versions override vanilla's.
fn dedup_libraries(libs: Vec<LibEntry>) -> Vec<LibEntry> {
    let mut seen: HashMap<String, usize> = HashMap::new();
    let mut out: Vec<LibEntry> = Vec::new();
    for lib in libs {
        let key = lib_key(&lib.name);
        match seen.get(&key) {
            Some(&i) => out[i] = lib,
            None => {
                seen.insert(key, out.len());
                out.push(lib);
            }
        }
    }
    out
}

async fn http_bytes(client: &reqwest::Client, url: &str) -> Result<Vec<u8>, String> {
    client.get(url).send().await.map_err(|e| format!("GET {url}: {e}"))?
        .error_for_status().map_err(|e| format!("GET {url}: {e}"))?
        .bytes().await.map_err(|e| e.to_string()).map(|b| b.to_vec())
}

async fn save_if_missing(client: &reqwest::Client, url: &str, dest: &Path) -> Result<(), String> {
    if dest.exists() { return Ok(()); }
    if let Some(p) = dest.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
    let bytes = http_bytes(client, url).await?;
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())
}

/// Variante de http_bytes qui joint la clé d'API si l'URL cible le
/// anvil-server configuré (mods hébergés, fichiers de config).
async fn http_bytes_keyed(
    client: &reqwest::Client,
    cfg:    &LauncherConfig,
    url:    &str,
) -> Result<Vec<u8>, String> {
    let mut req = client.get(url);
    if let Some(key) = anvil_key_for(cfg, url) { req = req.header("x-anvil-key", key); }
    req.send().await.map_err(|e| format!("GET {url}: {e}"))?
        .error_for_status().map_err(|e| format!("GET {url}: {e}"))?
        .bytes().await.map_err(|e| e.to_string()).map(|b| b.to_vec())
}

async fn save_if_missing_keyed(
    client: &reqwest::Client,
    cfg:    &LauncherConfig,
    url:    &str,
    dest:   &Path,
) -> Result<(), String> {
    if dest.exists() { return Ok(()); }
    if let Some(p) = dest.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
    let bytes = http_bytes_keyed(client, cfg, url).await?;
    std::fs::write(dest, &bytes).map_err(|e| e.to_string())
}

fn unzip_natives(zip_bytes: &[u8], dest: &Path) -> Result<(), String> {
    use std::io::Read;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(zip_bytes))
        .map_err(|e| e.to_string())?;
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        if file.is_dir() || file.name().starts_with("META-INF") { continue; }
        let out = dest.join(file.name());
        if let Some(p) = out.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
        let mut buf = Vec::new();
        file.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        std::fs::write(&out, &buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn extract_zip_file(archive: &Path, dest: &Path) -> Result<(), String> {
    use std::io::Read;
    let file = std::fs::File::open(archive).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    for i in 0..zip.len() {
        let mut entry = zip.by_index(i).map_err(|e| e.to_string())?;
        if entry.is_dir() { continue; }
        let out = dest.join(entry.name());
        if let Some(p) = out.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        std::fs::write(&out, &buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn extract_tgz(archive: &Path, dest: &Path) -> Result<(), String> {
    let file = std::fs::File::open(archive).map_err(|e| e.to_string())?;
    let gz   = flate2::read::GzDecoder::new(file);
    let mut tar = tar::Archive::new(gz);
    tar.unpack(dest).map_err(|e| e.to_string())
}

fn fnv64(s: &str) -> u64 {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in s.bytes() { h ^= b as u64; h = h.wrapping_mul(0x100000001b3); }
    h
}

// ── Commandes Tauri ───────────────────────────────────────────────────────────

#[tauri::command]
fn get_server_config(state: State<AppState>) -> LauncherConfig { state.config.clone() }

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings { state.settings.lock().unwrap().clone() }

#[tauri::command]
fn save_settings(state: State<AppState>, settings: Settings) -> Result<(), String> {
    save_json(&state.data_dir.join("settings.json"), &settings)?;
    *state.settings.lock().unwrap() = settings;
    Ok(())
}

/// RAM physique totale de la machine, en Mo — sert à borner les réglages
/// mémoire côté interface.
#[tauri::command]
fn get_system_memory() -> u32 {
    let mut sys = sysinfo::System::new();
    sys.refresh_memory();
    (sys.total_memory() / 1024 / 1024) as u32
}

#[tauri::command]
fn get_default_launcher_dir(state: State<AppState>) -> String {
    default_launcher_dir(&state.config).to_string_lossy().into()
}

#[tauri::command]
fn get_init_status(state: State<AppState>) -> InitStatus {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let running      = state.running.lock().unwrap();
    let instances    = state.config.instances.iter().map(|inst| InstanceStatus {
        id:        inst.id.clone(),
        name:      inst.name.clone(),
        installed: is_instance_installed(&launcher_dir, inst),
        running:   running.contains_key(&inst.id),
    }).collect();
    InitStatus {
        launcher_dir: launcher_dir.to_string_lossy().into(),
        java_ok: find_bundled_java(&launcher_dir).is_some(),
        instances,
    }
}

// ── Streaming download ────────────────────────────────────────────────────────

async fn download_to_file(
    app:    &AppHandle,
    client: &reqwest::Client,
    url:    &str,
    dest:   &Path,
    step:   &str,
    label:  &str,
) -> Result<(), String> {
    if let Some(p) = dest.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
    let resp  = client.get(url).send().await.map_err(|e| e.to_string())?;
    let total = resp.content_length().unwrap_or(0) as usize;
    let mut file       = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream     = resp.bytes_stream();
    let mut downloaded = 0usize;
    let mut last_emit  = 0usize;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len();
        if downloaded - last_emit > 256 * 1024 || (total > 0 && downloaded >= total) {
            last_emit = downloaded;
            let pct      = if total > 0 { downloaded * 100 / total } else { 0 };
            let mb       = downloaded / (1024 * 1024);
            let total_mb = total     / (1024 * 1024);
            let _ = app.emit("setup:progress", SetupProgress {
                step:    step.to_string(),
                current: pct,
                total:   100,
                label:   format!("{label} ({mb}/{total_mb} MB)"),
                error:   false,
            });
        }
    }
    Ok(())
}

// ── Installation Java ─────────────────────────────────────────────────────────

async fn install_java_bundled(app: &AppHandle, launcher_dir: &Path, java_major: u8) -> Result<(), String> {
    let client = reqwest::Client::builder().user_agent("HomeLauncher/1.0").build()
        .map_err(|e| e.to_string())?;
    let os   = if cfg!(windows) { "windows" } else if cfg!(target_os = "macos") { "mac" } else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "aarch64" } else { "x64" };
    let api  = format!(
        "https://api.adoptium.net/v3/assets/latest/{java_major}/hotspot?os={os}&arch={arch}&image_type=jre"
    );

    let _ = app.emit("setup:progress", SetupProgress {
        step: "java".into(), current: 0, total: 100,
        label: "Récupération des infos Java...".into(), error: false,
    });

    let entries: Vec<AdoptiumEntry> = client.get(&api).send().await
        .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let url = &entries.first().ok_or("Aucune version Java sur Adoptium")?.binary.package.link;
    let ext = if cfg!(windows) { "java_jre.zip" } else { "java_jre.tar.gz" };
    let archive = launcher_dir.join(ext);

    download_to_file(app, &client, url, &archive, "java", "Java JRE").await?;

    let _ = app.emit("setup:progress", SetupProgress {
        step: "java".into(), current: 95, total: 100, label: "Extraction...".into(), error: false,
    });
    let java_dir = launcher_dir.join("java");
    std::fs::create_dir_all(&java_dir).map_err(|e| e.to_string())?;
    if cfg!(windows) { extract_zip_file(&archive, &java_dir)?; } else { extract_tgz(&archive, &java_dir)?; }
    std::fs::remove_file(&archive).ok();

    let _ = app.emit("setup:progress", SetupProgress {
        step: "java".into(), current: 100, total: 100, label: "Java installé.".into(), error: false,
    });
    Ok(())
}

// ── Installation Minecraft ────────────────────────────────────────────────────

async fn install_vanilla(
    app:      &AppHandle,
    client:   &reqwest::Client,
    game_dir: &Path,
    inst:     &InstanceConfig,
) -> Result<(), String> {
    macro_rules! prog {
        ($c:expr, $l:expr) => {
            let _ = app.emit("setup:progress", SetupProgress {
                step: inst.id.clone(), current: $c, total: 100, label: $l.to_string(), error: false,
            });
        };
    }

    prog!(0, "Manifeste Minecraft...");
    let manifest: ManifestJson = client.get(MANIFEST_URL).send().await
        .map_err(|e| e.to_string())?.json().await.map_err(|e| e.to_string())?;
    let entry = manifest.versions.iter().find(|v| v.id == inst.mc_version)
        .ok_or_else(|| format!("Version {} introuvable", inst.mc_version))?;

    prog!(3, "Métadonnées...");
    let ver_dir  = game_dir.join("versions").join(&inst.mc_version);
    std::fs::create_dir_all(&ver_dir).map_err(|e| e.to_string())?;
    let json_path = ver_dir.join(format!("{}.json", inst.mc_version));
    if !json_path.exists() {
        let raw = http_bytes(client, &entry.url).await?;
        std::fs::write(&json_path, &raw).map_err(|e| e.to_string())?;
    }
    let ver: VersionJson = serde_json::from_str(
        &std::fs::read_to_string(&json_path).map_err(|e| e.to_string())?
    ).map_err(|e| e.to_string())?;

    prog!(6, "Client Minecraft...");
    if let Some(dl) = ver.downloads.get("client") {
        save_if_missing(client, &dl.url, &ver_dir.join(format!("{}.jar", inst.mc_version))).await?;
    }

    let libs_dir    = game_dir.join("libraries");
    let natives_dir = ver_dir.join("natives");
    std::fs::create_dir_all(&natives_dir).map_err(|e| e.to_string())?;
    let libs: Vec<&LibEntry> = ver.libraries.iter().filter(|l| lib_applies(l)).collect();
    let mut library_jobs = Vec::new();
    for lib in &libs {
        if let Some(dls) = &lib.downloads {
            if let Some(art) = &dls.artifact {
                if !art.url.is_empty() {
                    let rel = art.path.as_deref().filter(|p| !p.is_empty())
                        .map(|p| p.to_string()).unwrap_or_else(|| maven_path(&lib.name));
                    library_jobs.push((art.url.clone(), libs_dir.join(rel)));
                }
            }
            if let Some(cls) = &dls.classifiers {
                if let Some(dl) = cls.get(native_classifier()) {
                    if !dl.url.is_empty() {
                        unzip_natives(&http_bytes(client, &dl.url).await?, &natives_dir)?;
                    }
                }
            }
        }
    }
    prog!(25, format!("Bibliothèques ({} fichiers)...", library_jobs.len()));
    save_many_if_missing(client, library_jobs).await?;

    prog!(50, "Index des assets...");
    let assets_dir = game_dir.join("assets");
    std::fs::create_dir_all(assets_dir.join("indexes")).map_err(|e| e.to_string())?;
    if let Some(ai) = &ver.asset_index {
        let idx_path = assets_dir.join("indexes").join(format!("{}.json", ai.id));
        save_if_missing(client, &ai.url, &idx_path).await?;
        let index: AssetIndex = serde_json::from_str(
            &std::fs::read_to_string(&idx_path).map_err(|e| e.to_string())?
        ).map_err(|e| e.to_string())?;
        let objs: Vec<_> = index.objects.values().collect();
        let asset_jobs: Vec<_> = objs.iter().map(|obj| {
            let prefix = &obj.hash[..2];
            (format!("{RESOURCES_URL}{prefix}/{}", obj.hash),
             assets_dir.join("objects").join(prefix).join(&obj.hash))
        }).collect();
        prog!(50, format!("Assets ({} fichiers)...", asset_jobs.len()));
        save_many_if_missing(client, asset_jobs).await?;
    }
    Ok(())
}

async fn install_fabric(
    app:      &AppHandle,
    client:   &reqwest::Client,
    game_dir: &Path,
    inst:     &InstanceConfig,
) -> Result<(), String> {
    install_vanilla(app, client, game_dir, inst).await?;

    let _ = app.emit("setup:progress", SetupProgress {
        step: inst.id.clone(), current: 80, total: 100, label: "Profil Fabric...".into(), error: false,
    });

    let url = format!(
        "https://meta.fabricmc.net/v2/versions/loader/{}/{}/profile/json",
        inst.mc_version, inst.loader_version
    );
    let raw = http_bytes(client, &url).await?;
    let profile: VersionJson = serde_json::from_slice(&raw).map_err(|e| e.to_string())?;
    let fabric_id  = format!("fabric-loader-{}-{}", inst.loader_version, inst.mc_version);
    let fabric_dir = game_dir.join("versions").join(&fabric_id);
    std::fs::create_dir_all(&fabric_dir).map_err(|e| e.to_string())?;
    std::fs::write(fabric_dir.join(format!("{fabric_id}.json")), &raw)
        .map_err(|e| e.to_string())?;

    let libs_dir = game_dir.join("libraries");
    for (i, lib) in profile.libraries.iter().enumerate() {
        let _ = app.emit("setup:progress", SetupProgress {
            step: inst.id.clone(),
            current: 80 + i * 19 / profile.libraries.len().max(1),
            total: 100,
            label: format!("Fabric libs ({}/{})", i + 1, profile.libraries.len()),
            error: false,
        });
        let base_raw = lib.url.as_deref().unwrap_or("https://maven.fabricmc.net/");
        let base = if base_raw.ends_with('/') { base_raw.to_string() } else { format!("{base_raw}/") };
        let rel  = maven_path(&lib.name);
        save_if_missing(client, &format!("{base}{rel}"), &libs_dir.join(&rel)).await?;
    }
    Ok(())
}

// ── Mods ──────────────────────────────────────────────────────────────────────

/// Télécharge les mods déclarés dans config.json qui manquent dans mods/.
/// Un mod désactivé (.jar.disabled) n'est pas re-téléchargé.
async fn sync_mods(
    app:          &AppHandle,
    client:       &reqwest::Client,
    cfg:          &LauncherConfig,
    launcher_dir: &Path,
    inst:         &InstanceConfig,
) -> Result<(), String> {
    if inst.mods.is_empty() { return Ok(()); }
    let dir = mods_dir(launcher_dir, inst);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let total = inst.mods.len();
    for (i, m) in inst.mods.iter().enumerate() {
        let file = mod_file_name(m);
        check_file_name(&file)?;
        if dir.join(&file).exists() || dir.join(format!("{file}.disabled")).exists() { continue; }
        let label = if m.name.is_empty() { file.clone() } else { m.name.clone() };
        let _ = app.emit("setup:progress", SetupProgress {
            step:    inst.id.clone(),
            current: 100 * i / total.max(1),
            total:   100,
            label:   format!("Mod {label} ({}/{total})", i + 1),
            error:   false,
        });
        save_if_missing_keyed(client, cfg, &m.url, &dir.join(&file)).await
            .map_err(|e| format!("Mod '{label}': {e}"))?;
    }
    Ok(())
}

fn check_rel_path(path: &str) -> Result<(), String> {
    if path.is_empty() || path.contains("..") || path.starts_with('/')
        || path.contains('\\') || path.contains(':')
    {
        return Err(format!("Chemin de fichier invalide : '{path}'"));
    }
    Ok(())
}

/// Télécharge les fichiers déclarés (configs de mods…) dans le dossier de
/// l'instance. Toujours écrasés : le anvil-server est la source de vérité.
async fn sync_files(
    app:          &AppHandle,
    client:       &reqwest::Client,
    cfg:          &LauncherConfig,
    launcher_dir: &Path,
    inst:         &InstanceConfig,
) -> Result<(), String> {
    if inst.files.is_empty() { return Ok(()); }
    let base  = instance_data_dir(launcher_dir, inst);
    let total = inst.files.len();
    for (i, f) in inst.files.iter().enumerate() {
        check_rel_path(&f.path)?;
        let _ = app.emit("setup:progress", SetupProgress {
            step:    inst.id.clone(),
            current: 100 * i / total.max(1),
            total:   100,
            label:   format!("Fichier {} ({}/{total})", f.path, i + 1),
            error:   false,
        });
        let dest = base.join(&f.path);
        if let Some(p) = dest.parent() { std::fs::create_dir_all(p).map_err(|e| e.to_string())?; }
        let bytes = http_bytes_keyed(client, cfg, &f.url).await
            .map_err(|e| format!("Fichier '{}': {e}", f.path))?;
        std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn find_instance<'a>(cfg: &'a LauncherConfig, instance_id: &str) -> Result<&'a InstanceConfig, String> {
    cfg.instances.iter().find(|i| i.id == instance_id)
        .ok_or_else(|| format!("Instance '{instance_id}' introuvable dans config.json"))
}

#[tauri::command]
fn get_mods(state: State<AppState>, instance_id: String) -> Result<Vec<ModInfo>, String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;
    let dir          = mods_dir(&launcher_dir, inst);

    let managed: HashMap<String, &ModConfig> = inst.mods.iter()
        .map(|m| (mod_file_name(m), m)).collect();

    let mut mods = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&dir) {
        for e in entries.flatten() {
            let raw = e.file_name().to_string_lossy().to_string();
            let (file, enabled) = match raw.strip_suffix(".disabled") {
                Some(base) => (base.to_string(), false),
                None       => (raw.clone(), true),
            };
            if !file.ends_with(".jar") { continue; }
            let decl = managed.get(&file);
            mods.push(ModInfo {
                name:      decl.map(|m| m.name.clone()).filter(|n| !n.is_empty())
                               .unwrap_or_else(|| file.trim_end_matches(".jar").to_string()),
                file_name: file,
                enabled,
                size:      e.metadata().map(|m| m.len()).unwrap_or(0),
                managed:   decl.is_some(),
            });
        }
    }
    mods.sort_by(|a, b| a.file_name.cmp(&b.file_name));
    Ok(mods)
}

#[tauri::command]
async fn add_mod(
    state:       State<'_, AppState>,
    instance_id: String,
    url:         String,
    file_name:   Option<String>,
) -> Result<ModInfo, String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;

    let m    = ModConfig { url, name: String::new(), file_name: file_name.unwrap_or_default() };
    let file = mod_file_name(&m);
    check_file_name(&file)?;

    let dir = mods_dir(&launcher_dir, inst);
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let dest = dir.join(&file);
    if dest.exists() { return Err(format!("Le mod '{file}' existe déjà.")); }

    let client = reqwest::Client::builder().user_agent("HomeLauncher/1.0").build()
        .map_err(|e| e.to_string())?;
    let bytes = http_bytes_keyed(&client, &state.config, &m.url).await?;
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;

    Ok(ModInfo {
        name:      file.trim_end_matches(".jar").to_string(),
        file_name: file,
        enabled:   true,
        size:      bytes.len() as u64,
        managed:   false,
    })
}

#[tauri::command]
fn remove_mod(state: State<AppState>, instance_id: String, file_name: String) -> Result<(), String> {
    check_file_name(&file_name)?;
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;
    let dir          = mods_dir(&launcher_dir, inst);
    for candidate in [dir.join(&file_name), dir.join(format!("{file_name}.disabled"))] {
        if candidate.exists() {
            return std::fs::remove_file(&candidate).map_err(|e| e.to_string());
        }
    }
    Err(format!("Mod '{file_name}' introuvable."))
}

#[tauri::command]
fn set_mod_enabled(
    state:       State<AppState>,
    instance_id: String,
    file_name:   String,
    enabled:     bool,
) -> Result<(), String> {
    check_file_name(&file_name)?;
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;
    let dir          = mods_dir(&launcher_dir, inst);
    let active       = dir.join(&file_name);
    let disabled     = dir.join(format!("{file_name}.disabled"));
    match (enabled, active.exists(), disabled.exists()) {
        (true,  true,  _)     => Ok(()),
        (true,  false, true)  => std::fs::rename(&disabled, &active).map_err(|e| e.to_string()),
        (false, true,  _)     => std::fs::rename(&active, &disabled).map_err(|e| e.to_string()),
        (false, false, true)  => Ok(()),
        _ => Err(format!("Mod '{file_name}' introuvable.")),
    }
}

#[tauri::command]
fn open_mods_folder(state: State<AppState>, instance_id: String) -> Result<(), String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;
    open_in_file_manager(&mods_dir(&launcher_dir, inst))
}

#[tauri::command]
fn open_instance_folder(state: State<AppState>, instance_id: String) -> Result<(), String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst         = find_instance(&state.config, &instance_id)?;
    open_in_file_manager(&instance_data_dir(&launcher_dir, inst))
}

/// Ouvre le sélecteur de dossier natif. Résout sur le chemin choisi, ou sur
/// `None` si l'utilisateur annule.
/// Vide le dossier du launcher sans le supprimer : jeu, Java, instances et
/// leurs sauvegardes. Opération irréversible, réservée à la réinstallation.
#[tauri::command]
fn reset_launcher_dir(app: AppHandle, state: State<AppState>) -> Result<(), String> {
    if !state.running.lock().unwrap().is_empty() {
        return Err("Fermez le jeu avant de réinitialiser l'installation.".into());
    }
    let settings = state.settings.lock().unwrap().clone();
    let dir      = get_launcher_dir(&settings, &state.config);

    // Garde-fous : ne jamais vider une racine, un dossier utilisateur ou un
    // chemin trop court — une valeur erronée dans settings.json effacerait
    // sinon bien plus que le launcher.
    if dir.parent().is_none() || dir.components().count() < 3 {
        return Err(format!("Chemin d'installation refusé : {}", dir.display()));
    }
    for protected in [dirs::home_dir(), dirs::data_dir(), dirs::data_local_dir(),
                      dirs::document_dir(), dirs::desktop_dir()].into_iter().flatten() {
    if dir == protected {
            return Err(format!("Chemin d'installation refusé : {}", dir.display()));
        }
    }
    let _ = app.emit("reset", ());
    if !dir.exists() {
        let _ = app.emit("install", ());
        return Ok(());
    }
    let entries = std::fs::read_dir(&dir)
        .map_err(|e| format!("Lecture de {} : {e}", dir.display()))?;
    for entry in entries {
        let entry = entry.map_err(|e| format!("Lecture de {} : {e}", dir.display()))?;
        let path  = entry.path();
        let result = if path.is_dir() {
            std::fs::remove_dir_all(&path)
        } else {
            std::fs::remove_file(&path)
        };
        result.map_err(|e| format!("Suppression de {} : {e}", path.display()))?;
    }
    launcher_log(&log_dir(&dir), "Dossier du launcher réinitialisé");
    let _ = app.emit("install", ());
    Ok(())
}

#[tauri::command]
fn open_logs_folder(state: State<AppState>) -> Result<(), String> {
    let settings = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    open_in_file_manager(&log_dir(&launcher_dir))
}

/// Télécharge plusieurs fichiers indépendants avec une limite de concurrence.
async fn save_many_if_missing(
    client: &reqwest::Client,
    jobs: Vec<(String, PathBuf)>,
) -> Result<(), String> {
    futures_util::stream::iter(jobs.into_iter().map(|(url, dest)| async move {
        save_if_missing(client, &url, &dest).await
    }))
    .buffer_unordered(8)
    .try_collect::<Vec<()>>()
    .await
    .map(|_| ())
}

#[tauri::command]
async fn pick_folder(app: AppHandle, start: Option<String>) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let mut dialog = app.dialog().file();
    if let Some(dir) = start.filter(|d| !d.trim().is_empty()) {
        dialog = dialog.set_directory(dir);
    }
    // Le rappel est appelé depuis le thread UI : on attend le résultat hors
    // du thread courant pour ne pas bloquer la boucle d'événements.
    let (tx, rx) = std::sync::mpsc::channel();
    dialog.pick_folder(move |path| { let _ = tx.send(path); });
    let picked = tauri::async_runtime::spawn_blocking(move || rx.recv())
        .await
        .map_err(|e| format!("Sélection du dossier : {e}"))?
        .map_err(|_| "Sélection du dossier : boîte de dialogue interrompue.".to_string())?;
    Ok(picked.map(|p| p.to_string()))
}

#[tauri::command]
async fn run_setup(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    let _ = app.emit("installing", ());
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let cfg          = state.config.clone();
    std::fs::create_dir_all(&launcher_dir).map_err(|e| e.to_string())?;

    let logs = log_dir(&launcher_dir);
    launcher_log(&logs, "Démarrage de la configuration initiale");

    // Java
    if find_bundled_java(&launcher_dir).is_none() {
        launcher_log(&logs, &format!("Téléchargement Java {}", cfg.java_version));
        install_java_bundled(&app, &launcher_dir, cfg.java_version).await?;
        launcher_log(&logs, "Java installé");
    } else {
        let _ = app.emit("setup:progress", SetupProgress {
            step: "java".into(), current: 100, total: 100, label: "Java déjà installé.".into(), error: false,
        });
    }

    // Instances
    let game_dir = shared_game_dir(&launcher_dir);
    let client   = reqwest::Client::builder()
        .user_agent("HomeLauncher/1.0")
        .connect_timeout(std::time::Duration::from_secs(15))
        .timeout(std::time::Duration::from_secs(90))
        .build()
        .map_err(|e| e.to_string())?;

    for inst in &cfg.instances {
        let result = if inst.mc_version.is_empty() {
            // Instance déclarée par {id} mais jamais résolue : serveur anvil
            // injoignable et aucun cache disponible.
            Err(format!(
                "Instance '{}' non résolue — anvil-server injoignable ?", inst.id
            ))
        } else if is_instance_installed(&launcher_dir, inst) {
            launcher_log(&logs, &format!("Instance '{}' déjà installée", inst.id));
            // On synchronise quand même mods et fichiers : un ajout côté
            // config/serveur doit être téléchargé sans réinstaller l'instance.
            match sync_mods(&app, &client, &cfg, &launcher_dir, inst).await {
                Ok(_) => sync_files(&app, &client, &cfg, &launcher_dir, inst).await,
                Err(e) => Err(e),
            }
        } else {
            launcher_log(&logs, &format!("Installation instance '{}' ({})", inst.id, inst.mc_version));
            let r = if inst.loader == "fabric" {
                install_fabric(&app, &client, &game_dir, inst).await
            } else {
                install_vanilla(&app, &client, &game_dir, inst).await
            };
            match r {
                Ok(_) => match sync_mods(&app, &client, &cfg, &launcher_dir, inst).await {
                    Ok(_) => sync_files(&app, &client, &cfg, &launcher_dir, inst).await,
                    Err(e) => Err(e),
                },
                Err(e) => Err(e),
            }
        };
        let result = result.and_then(|_| verify_instance(&launcher_dir, inst));
        match result {
            Ok(_) => {
                let _ = app.emit("setup:progress", SetupProgress {
                    step: inst.id.clone(), current: 100, total: 100,
                    label: format!("{} installé.", inst.name), error: false,
                });
                launcher_log(&logs, &format!("Instance '{}' prête", inst.id));
            }
            Err(e) => {
                launcher_log(&logs, &format!("Erreur instance '{}': {e}", inst.id));
                let _ = app.emit("setup:progress", SetupProgress {
                    step: inst.id.clone(), current: 0, total: 100,
                    label: format!("Erreur : {e}"), error: true,
                });
            }
        }
    }

    let _ = app.emit("setup:done", ());
    launcher_log(&logs, "Configuration initiale terminée");
    Ok(())
}

// ── Vérification ──────────────────────────────────────────────────────────────

fn read_version_chain(game_dir: &Path, version_id: &str) -> Result<VersionJson, String> {
    let text = std::fs::read_to_string(
        game_dir.join("versions").join(version_id).join(format!("{version_id}.json"))
    ).map_err(|_| format!("Version '{version_id}' non installée"))?;
    let mut ver: VersionJson = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    if let Some(parent_id) = ver.inherits_from.take() {
        let parent = read_version_chain(game_dir, &parent_id)?;
        if ver.main_class.is_empty() { ver.main_class = parent.main_class; }
        if ver.assets.is_empty()     { ver.assets     = parent.assets; }
        if ver.asset_index.is_none() { ver.asset_index = parent.asset_index; }
        if ver.downloads.is_empty()  { ver.downloads   = parent.downloads; }
        if ver.legacy_args.is_none() { ver.legacy_args = parent.legacy_args; }
        match (ver.arguments.as_mut(), parent.arguments) {
            (Some(ca), Some(pa)) => {
                let mut jvm = pa.jvm; jvm.extend(ca.jvm.drain(..)); ca.jvm = jvm;
                ca.game.extend(pa.game);
            }
            (None, Some(pa)) => ver.arguments = Some(pa),
            _ => {}
        }
        ver.libraries = {
            let mut m = parent.libraries;
            m.extend(std::mem::take(&mut ver.libraries));
            dedup_libraries(m)
        };
    }
    Ok(ver)
}

fn verify_instance(launcher_dir: &Path, inst: &InstanceConfig) -> Result<(), String> {
    if find_bundled_java(launcher_dir).is_none() {
        return Err("Java non installé — relancez la configuration initiale.".into());
    }
    let game_dir = shared_game_dir(launcher_dir);
    let ver_id   = version_folder(inst);
    let ver_json = game_dir.join("versions").join(&ver_id).join(format!("{ver_id}.json"));
    if !ver_json.exists() {
        return Err(format!("Fichier de version introuvable : {ver_id}.json\nRelancez la configuration initiale."));
    }
    let ver      = read_version_chain(&game_dir, &ver_id)?;
    let libs_dir = game_dir.join("libraries");
    let mut missing = Vec::new();

    let client_jar = game_dir.join("versions").join(&inst.mc_version)
        .join(format!("{}.jar", inst.mc_version));
    if !client_jar.exists() { missing.push(format!("JAR client : {}.jar", inst.mc_version)); }

    for lib in ver.libraries.iter().filter(|l| lib_applies(l)) {
        let path = if let Some(dls) = &lib.downloads {
            if let Some(art) = &dls.artifact {
                let rel = art.path.as_deref().filter(|p| !p.is_empty())
                    .map(|p| p.to_string()).unwrap_or_else(|| maven_path(&lib.name));
                libs_dir.join(rel)
            } else { continue; }
        } else {
            libs_dir.join(maven_path(&lib.name))
        };
        if !path.exists() { missing.push(format!("lib : {}", lib.name)); }
    }

    let m_dir = mods_dir(launcher_dir, inst);
    for m in &inst.mods {
        let file = mod_file_name(m);
        if !m_dir.join(&file).exists() && !m_dir.join(format!("{file}.disabled")).exists() {
            missing.push(format!("mod : {file}"));
        }
    }

    if missing.is_empty() { Ok(()) } else {
        Err(format!(
            "{} fichier(s) manquant(s) dans '{}' :\n{}\n\nRelancez la configuration initiale.",
            missing.len(), inst.name, missing.join("\n")
        ))
    }
}

#[tauri::command]
fn verify_game(state: State<AppState>, instance_id: String) -> Result<(), String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst = state.config.instances.iter().find(|i| i.id == instance_id)
        .ok_or_else(|| format!("Instance '{instance_id}' introuvable dans config.json"))?;
    verify_instance(&launcher_dir, inst)
}

// ── Lancement ─────────────────────────────────────────────────────────────────

fn mc_version_gte(version: &str, major: u32, minor: u32) -> bool {
    let p: Vec<u32> = version.split('.').filter_map(|s| s.parse().ok()).collect();
    (p.first().copied().unwrap_or(0), p.get(1).copied().unwrap_or(0)) >= (major, minor)
}

fn extract_args(args: &[serde_json::Value], vars: &HashMap<&str, String>) -> Vec<String> {
    let mut out = Vec::new();
    for arg in args {
        match arg {
            serde_json::Value::String(s) => out.push(subst(s, vars)),
            serde_json::Value::Object(obj) => {
                let mut allow = true;
                if let Some(rules) = obj.get("rules").and_then(|r| r.as_array()) {
                    allow = false;
                    for rule in rules {
                        // Les règles "features" (demo, quick-play, custom resolution…) sont ignorées
                        // car nous n'activons aucune de ces fonctionnalités optionnelles.
                        if rule.get("features").is_some() { continue; }
                        let action = rule.get("action").and_then(|a| a.as_str()).unwrap_or("allow");
                        let os_ok  = rule.get("os").and_then(|o| o.get("name"))
                            .and_then(|n| n.as_str()).map_or(true, |n| n == os_name());
                        if os_ok { allow = action == "allow"; }
                    }
                }
                if allow {
                    match obj.get("value") {
                        Some(serde_json::Value::Array(vs)) => {
                            for v in vs { if let serde_json::Value::String(s) = v { out.push(subst(s, vars)); } }
                        }
                        Some(serde_json::Value::String(s)) => out.push(subst(s, vars)),
                        _ => {}
                    }
                }
            }
            _ => {}
        }
    }
    out
}

fn subst(t: &str, vars: &HashMap<&str, String>) -> String {
    let mut s = t.to_string();
    for (k, v) in vars { s = s.replace(&format!("${{{k}}}"), v); }
    s
}

#[tauri::command]
async fn launch_game(
    app:         AppHandle,
    state:       State<'_, AppState>,
    instance_id: String,
) -> Result<(), String> {
    let settings     = state.settings.lock().unwrap().clone();
    let launcher_dir = get_launcher_dir(&settings, &state.config);
    let inst = state.config.instances.iter().find(|i| i.id == instance_id)
        .ok_or_else(|| format!("Instance '{instance_id}' introuvable"))?
        .clone();

    if state.running.lock().unwrap().contains_key(&instance_id) {
        return Err(format!("L'instance '{}' est déjà en cours d'exécution.", inst.name));
    }

    verify_instance(&launcher_dir, &inst)?;

    let java     = find_bundled_java(&launcher_dir).unwrap();
    let game_dir = shared_game_dir(&launcher_dir);
    let ver_id   = version_folder(&inst);
    let ver      = read_version_chain(&game_dir, &ver_id)?;

    let offline_auth = |name: &str| -> (String, String, String, &'static str, String, String) {
        let h = fnv64(name);
        let uid = format!("{:08x}-{:04x}-4{:03x}-{:04x}-{:012x}",
            (h >> 32) as u32, (h >> 16) as u16, h as u16 & 0x0fff,
            0x8000u16 | ((h >> 48) as u16 & 0x3fff), h & 0x0000_ffff_ffff);
        (name.to_string(), uid, "0".into(), "offline", String::new(), String::new())
    };

    let fallback_name = if settings.username.is_empty() { "Player".to_string() } else { settings.username.clone() };
    let (username, uuid, access_token, user_type, auth_xuid, client_id) = match state.config.session.as_str() {
        "custom" | "microsoft" => {
            let guard = state.custom_session.lock().unwrap();
            match &*guard {
                Some(s) => (
                    s.username.clone(), s.uuid.clone(), s.access_token.clone(), "msa",
                    s.xuid.clone(), s.client_id.clone(),
                ),
                None if state.config.session == "custom" => offline_auth(&fallback_name),
                None => return Err("Aucune session Microsoft active — connectez-vous d'abord.".into()),
            }
        },
        // La session est gérée par le anvil-server : pas de fallback offline,
        // le joueur doit être connecté.
        "anvil-session" => {
            let guard = state.custom_session.lock().unwrap();
            match &*guard {
                Some(s) => (
                    s.username.clone(), s.uuid.clone(), s.access_token.clone(), "msa",
                    s.xuid.clone(), s.client_id.clone(),
                ),
                None    => return Err("Aucune session active — connectez-vous d'abord.".into()),
            }
        },
        "mojang" => return Err(
            "Le mode 'mojang' a été remplacé par 'microsoft' dans config.json.".into(),
        ),
        _ => offline_auth(&fallback_name),
    };

    let mc_ver_dir   = game_dir.join("versions").join(&inst.mc_version);
    let natives_dir  = mc_ver_dir.join("natives");
    let assets_dir   = game_dir.join("assets");
    let libs_dir     = game_dir.join("libraries");
    let inst_dir     = instance_data_dir(&launcher_dir, &inst);
    std::fs::create_dir_all(&inst_dir).map_err(|e| e.to_string())?;
    let cp_sep       = if cfg!(windows) { ";" } else { ":" };

    let mut cp: Vec<String> = Vec::new();
    for lib in ver.libraries.iter().filter(|l| lib_applies(l)) {
        if let Some(dls) = &lib.downloads {
            if let Some(art) = &dls.artifact {
                let rel  = art.path.as_deref().filter(|p| !p.is_empty())
                    .map(|p| p.to_string()).unwrap_or_else(|| maven_path(&lib.name));
                let full = libs_dir.join(&rel);
                if full.exists() { cp.push(full.to_string_lossy().into()); }
            }
        } else {
            let full = libs_dir.join(maven_path(&lib.name));
            if full.exists() { cp.push(full.to_string_lossy().into()); }
        }
    }
    let client_jar = mc_ver_dir.join(format!("{}.jar", inst.mc_version));
    if client_jar.exists() { cp.push(client_jar.to_string_lossy().into()); }
    let classpath = cp.join(cp_sep);

    let vars: HashMap<&str, String> = HashMap::from([
        ("natives_directory", natives_dir.to_string_lossy().into()),
        ("launcher_name",     "HomeLauncher".into()),
        ("launcher_version",  "1.0".into()),
        ("classpath",         classpath.clone()),
        ("auth_player_name",  username.clone()),
        ("version_name",      ver_id.clone()),
        ("game_directory",    inst_dir.to_string_lossy().into()),
        ("assets_root",       assets_dir.to_string_lossy().into()),
        ("assets_index_name", ver.assets.clone()),
        ("auth_uuid",         uuid.clone()),
        ("auth_access_token", access_token.clone()),
        ("auth_xuid",         auth_xuid),
        ("clientid",          client_id),
        ("user_type",         user_type.into()),
        ("version_type",      "release".into()),
        ("resolution_width",  "854".into()),
        ("resolution_height", "480".into()),
    ]);

    // Seuls args non fournis par le JSON de version
    let mut cmd: Vec<String> = vec![
        format!("-Xms{}M", settings.min_memory.min(settings.max_memory)),
        format!("-Xmx{}M", settings.max_memory),
    ];

    if let Some(args) = &ver.arguments {
        cmd.extend(extract_args(&args.jvm, &vars));
        if !cmd.contains(&"-cp".to_string()) {
            cmd.push("-cp".into()); cmd.push(classpath);
        }
        cmd.push(ver.main_class.clone());
        cmd.extend(extract_args(&args.game, &vars));
    } else {
        cmd.extend([
            format!("-Djava.library.path={}", natives_dir.display()),
            "-cp".into(), classpath,
        ]);
        cmd.push(ver.main_class.clone());
        if let Some(legacy) = &ver.legacy_args {
            cmd.extend(legacy.split_whitespace().map(|p| subst(p, &vars)));
        }
    }

    if !inst.server_ip.is_empty() {
        if mc_version_gte(&inst.mc_version, 1, 20) {
            // MC 1.20+ : --server/--port ont été remplacés par --quickPlayMultiplayer host:port
            cmd.push("--quickPlayMultiplayer".into());
            cmd.push(format!("{}:{}", inst.server_ip, inst.server_port));
        } else {
            cmd.push("--server".into());
            cmd.push(inst.server_ip.clone());
            cmd.push("--port".into());
            cmd.push(inst.server_port.to_string());
        }
    }

    // Log launcher
    let logs = log_dir(&launcher_dir);
    launcher_log(&logs, &format!(
        "Lancement instance '{}' ({} {}) — Java: {}",
        inst.id, inst.mc_version, inst.loader, java.display()
    ));

    let _ = app.emit("game:starting", &instance_id);

    // Log de session (stdout + stderr)
    let ts       = Local::now().format("%Y%m%d_%H%M%S");
    let log_path = logs.join(format!("{}-{ts}.log", inst.id));
    std::fs::create_dir_all(&logs).ok();

    // Log la commande dans la console UI
    let _ = app.emit("game:output", GameOutput {
        instance_id: instance_id.clone(),
        text: format!("[HomeLauncher] Lancement : {} {}", java.display(), cmd.first().unwrap_or(&String::new())),
        stderr: false,
    });

    let mut child = std::process::Command::new(&java)
        .args(&cmd)
        .current_dir(&inst_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("Impossible de lancer Java: {e}"))?;

    let app2     = app.clone();
    let iid2     = instance_id.clone();
    let log_path2 = log_path.clone();
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            let mut log = std::fs::OpenOptions::new()
                .create(true).append(true).open(&log_path2).ok();
            for line in BufReader::new(stdout).lines().flatten() {
                if let Some(ref mut f) = log { let _ = writeln!(f, "[OUT] {line}"); }
                let _ = app2.emit("game:output", GameOutput {
                    instance_id: iid2.clone(), text: line, stderr: false,
                });
            }
        });
    }
    let app3  = app.clone();
    let iid3  = instance_id.clone();
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            let mut log = std::fs::OpenOptions::new()
                .create(true).append(true).open(&log_path).ok();
            for line in BufReader::new(stderr).lines().flatten() {
                if let Some(ref mut f) = log { let _ = writeln!(f, "[ERR] {line}"); }
                let _ = app3.emit("game:output", GameOutput {
                    instance_id: iid3.clone(), text: line, stderr: true,
                });
            }
        });
    }
    // Enregistre le process pour stop_game / get_running_instances.
    // Le thread de fin utilise try_wait en boucle pour ne pas garder le lock.
    let child = std::sync::Arc::new(Mutex::new(child));
    state.running.lock().unwrap().insert(instance_id.clone(), child.clone());

    let iid_exit = instance_id.clone();
    let logs2    = logs.clone();
    let app_exit = app.clone();
    std::thread::spawn(move || {
        let code = loop {
            match child.lock().unwrap().try_wait() {
                Ok(Some(status)) => break status.code().unwrap_or(-1),
                Ok(None)         => {}
                Err(_)           => break -1,
            }
            std::thread::sleep(std::time::Duration::from_millis(400));
        };
        let state = app_exit.state::<AppState>();
        state.running.lock().unwrap().remove(&iid_exit);
        launcher_log(&logs2, &format!("Instance '{}' terminée (code {code})", iid_exit));
        let _ = app_exit.emit("game:exit", serde_json::json!({ "instance_id": iid_exit, "code": code }));
    });

    Ok(())
}

#[tauri::command]
fn stop_game(state: State<AppState>, instance_id: String) -> Result<(), String> {
    let child = state.running.lock().unwrap().get(&instance_id).cloned()
        .ok_or_else(|| format!("Instance '{instance_id}' non lancée."))?;
    let result = child.lock().unwrap().kill().map_err(|e| format!("Impossible d'arrêter le jeu : {e}"));
    result
}

#[tauri::command]
fn get_running_instances(state: State<AppState>) -> Vec<String> {
    state.running.lock().unwrap().keys().cloned().collect()
}

#[tauri::command]
fn get_launcher_version() -> String {
    env!("CARGO_PKG_VERSION").into()
}

// ── Mise à jour ───────────────────────────────────────────────────────────────

#[tauri::command]
async fn check_update(state: State<'_, AppState>) -> Result<Option<UpdateInfo>, String> {
    let url = state.config.update_url.trim().to_string();
    if url.is_empty() { return Ok(None); }
    let client = reqwest::Client::builder().user_agent("HomeLauncher/1.0").build()
        .map_err(|e| e.to_string())?;
    let manifest: UpdateManifest = client.get(&url).send().await
        .map_err(|e| format!("Erreur réseau updater: {e}"))?
        .json().await.map_err(|e| format!("Réponse updater invalide: {e}"))?;
    let current = env!("CARGO_PKG_VERSION");
    if manifest.version.trim() <= current { return Ok(None); }
    let dl_url = if cfg!(windows) { &manifest.windows }
                 else if cfg!(target_os = "macos") { &manifest.macos }
                 else { &manifest.linux };
    if dl_url.is_empty() { return Ok(None); }
    Ok(Some(UpdateInfo { version: manifest.version, url: dl_url.clone(), notes: manifest.notes }))
}

#[tauri::command]
async fn do_update(app: AppHandle, url: String) -> Result<(), String> {
    let client = reqwest::Client::builder().user_agent("HomeLauncher/1.0").build()
        .map_err(|e| e.to_string())?;
    let ext  = if cfg!(windows) { ".exe" } else if cfg!(target_os = "macos") { ".dmg" } else { ".AppImage" };
    let dest = std::env::temp_dir().join(format!("HomeLauncher-update{ext}"));
    let bytes = client.get(&url).send().await.map_err(|e| e.to_string())?
        .bytes().await.map_err(|e| e.to_string())?;
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    #[cfg(unix)] {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dest, std::fs::Permissions::from_mode(0o755)).ok();
    }
    std::process::Command::new(&dest).spawn()
        .map_err(|e| format!("Impossible de lancer la mise à jour: {e}"))?;
    app.exit(0);
    Ok(())
}

// ── Session Microsoft ─────────────────────────────────────────────────────────

fn microsoft_session_path(data_dir: &Path) -> PathBuf { data_dir.join("microsoft_session.json") }

fn microsoft_client_id(cfg: &LauncherConfig) -> Result<&str, String> {
    let client_id = cfg.microsoft_client_id.trim();
    if client_id.is_empty() {
        return Err("Configurez 'microsoft-client-id' dans config.json avant d'utiliser la session Microsoft.".into());
    }
    Ok(client_id)
}

fn microsoft_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("AnvilLauncher/1.0")
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())
}

async fn microsoft_json(
    response: reqwest::Response,
    context:  &str,
) -> Result<serde_json::Value, String> {
    let status = response.status();
    let text = response.text().await.map_err(|e| format!("{context} : réponse illisible ({e})"))?;
    let body: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| format!("{context} : réponse invalide ({e})"))?;
    if status.is_success() { return Ok(body) }

    let detail = body["error_description"].as_str()
        .or_else(|| body["Message"].as_str())
        .or_else(|| body["message"].as_str())
        .or_else(|| body["errorMessage"].as_str())
        .or_else(|| body["error"].as_str())
        .unwrap_or("erreur inconnue");
    Err(format!("{context} ({status}) : {detail}"))
}

fn open_external_url(url: &str) {
    if !url.starts_with("https://") { return }
    let cmd = if cfg!(target_os = "windows") { "explorer" }
              else if cfg!(target_os = "macos") { "open" }
              else { "xdg-open" };
    let _ = std::process::Command::new(cmd).arg(url).spawn();
}

async fn microsoft_sleep(seconds: u64) {
    let _ = tauri::async_runtime::spawn_blocking(move || {
        std::thread::sleep(std::time::Duration::from_secs(seconds));
    }).await;
}

/// Échange le jeton Microsoft contre les jetons Xbox/XSTS puis contre un
/// jeton Minecraft, et récupère le profil Java associé.
async fn minecraft_session_from_microsoft(
    client:           &reqwest::Client,
    microsoft_token:  &str,
    client_id:        &str,
) -> Result<(CustomSession, i64), String> {
    let xbox = microsoft_json(
        client.post(XBOX_USER_AUTH_URL)
            .header("x-xbl-contract-version", "1")
            .json(&serde_json::json!({
                "Properties": {
                    "AuthMethod": "RPS",
                    "SiteName": "user.auth.xboxlive.com",
                    "RpsTicket": format!("d={microsoft_token}"),
                },
                "RelyingParty": "http://auth.xboxlive.com",
                "TokenType": "JWT",
            }))
            .send().await.map_err(|e| format!("Connexion Xbox : {e}"))?,
        "Connexion Xbox",
    ).await?;
    let xbox_token = xbox["Token"].as_str()
        .ok_or_else(|| "Connexion Xbox : jeton absent de la réponse.".to_string())?;

    let xsts_response = client.post(XSTS_AUTH_URL)
        .header("x-xbl-contract-version", "1")
        .json(&serde_json::json!({
            "Properties": { "SandboxId": "RETAIL", "UserTokens": [xbox_token] },
            "RelyingParty": "rp://api.minecraftservices.com/",
            "TokenType": "JWT",
        }))
        .send().await.map_err(|e| format!("Autorisation Xbox : {e}"))?;
    let xsts_status = xsts_response.status();
    let xsts_text = xsts_response.text().await
        .map_err(|e| format!("Autorisation Xbox : réponse illisible ({e})"))?;
    let xsts: serde_json::Value = serde_json::from_str(&xsts_text)
        .map_err(|e| format!("Autorisation Xbox : réponse invalide ({e})"))?;
    if !xsts_status.is_success() {
        let message = match xsts["XErr"].as_i64() {
            Some(2148916233) => "Ce compte Microsoft ne possède pas de profil Xbox Live.",
            Some(2148916235) => "Xbox Live n'est pas disponible dans votre pays.",
            Some(2148916236) => "Ce compte Microsoft doit fournir une preuve d'âge.",
            Some(2148916238) => "Ce compte mineur doit être rattaché à une famille Microsoft.",
            _ => "L'autorisation Xbox a été refusée.",
        };
        return Err(message.into());
    }
    let xsts_token = xsts["Token"].as_str()
        .ok_or_else(|| "Autorisation Xbox : jeton absent de la réponse.".to_string())?;
    let user_hash = xsts["DisplayClaims"]["xui"][0]["uhs"].as_str()
        .ok_or_else(|| "Autorisation Xbox : identifiant utilisateur absent.".to_string())?;
    let xuid = xsts["DisplayClaims"]["xui"][0]["xid"].as_str()
        .unwrap_or_default()
        .to_string();

    let minecraft = microsoft_json(
        client.post(MINECRAFT_LOGIN_URL)
            .json(&serde_json::json!({
                "identityToken": format!("XBL3.0 x={user_hash};{xsts_token}"),
            }))
            .send().await.map_err(|e| format!("Connexion Minecraft : {e}"))?,
        "Connexion Minecraft",
    ).await?;
    let access_token = minecraft["access_token"].as_str()
        .ok_or_else(|| "Connexion Minecraft : jeton absent de la réponse.".to_string())?
        .to_string();
    let expires_in = minecraft["expires_in"].as_i64().unwrap_or(3600);

    let profile = microsoft_json(
        client.get(MINECRAFT_PROFILE_URL)
            .bearer_auth(&access_token)
            .send().await.map_err(|e| format!("Profil Minecraft : {e}"))?,
        "Profil Minecraft Java",
    ).await?;
    let username = profile["name"].as_str()
        .ok_or_else(|| "Ce compte ne possède pas de profil Minecraft Java.".to_string())?
        .to_string();
    let uuid = profile["id"].as_str()
        .ok_or_else(|| "Profil Minecraft : UUID absent de la réponse.".to_string())?
        .to_string();

    Ok((CustomSession {
        username,
        uuid,
        access_token,
        xuid,
        client_id: client_id.to_string(),
    }, Utc::now().timestamp() + expires_in))
}

fn activate_microsoft_session(
    state:         &AppState,
    client_id:     &str,
    refresh_token: String,
    session:       CustomSession,
    expires_at:    i64,
) -> Result<MicrosoftLoginResult, String> {
    let cache = MicrosoftAuthCache {
        client_id: client_id.to_string(),
        refresh_token,
        minecraft_access_token: session.access_token.clone(),
        minecraft_expires_at: expires_at,
        username: session.username.clone(),
        uuid: session.uuid.clone(),
        xuid: session.xuid.clone(),
    };
    save_private_json(&microsoft_session_path(&state.data_dir), &cache)?;
    let result = MicrosoftLoginResult { username: session.username.clone(), uuid: session.uuid.clone() };
    *state.custom_session.lock().unwrap() = Some(session);
    Ok(result)
}

// ── Connexion Microsoft en fenêtre interne (authorization code + PKCE) ────────

fn base64_url(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

fn random_oauth_token() -> Result<String, String> {
    let mut raw = [0u8; 32];
    getrandom::getrandom(&mut raw).map_err(|e| format!("Génération OAuth : {e}"))?;
    Ok(base64_url(&raw))
}

/// Génère le couple (code_verifier, code_challenge) du flux PKCE.
fn pkce_pair() -> Result<(String, String), String> {
    use sha2::{Digest, Sha256};
    let verifier = random_oauth_token()?;
    let challenge = base64_url(&Sha256::digest(verifier.as_bytes()));
    Ok((verifier, challenge))
}

/// Ouvre la page de connexion Microsoft dans une fenêtre dédiée et attend le
/// code d'autorisation. La page de redirection n'est jamais chargée : la
/// navigation est interceptée, le code lu dans l'URL, et la fenêtre fermée.
async fn microsoft_authorization_code(
    app:       &AppHandle,
    client_id: &str,
    challenge: &str,
    state:     &str,
) -> Result<String, String> {
    // Évite de conserver une fenêtre OAuth orpheline après un double appel.
    if let Some(existing) = app.get_webview_window(MICROSOFT_LOGIN_WINDOW) {
        let _ = existing.close();
    }
    let mut url = tauri::Url::parse(MICROSOFT_AUTHORIZE_URL)
        .map_err(|e| format!("Connexion Microsoft : URL invalide ({e})"))?;
    url.query_pairs_mut()
        .append_pair("client_id", client_id)
        .append_pair("response_type", "code")
        .append_pair("redirect_uri", MICROSOFT_REDIRECT_URI)
        .append_pair("response_mode", "query")
        .append_pair("scope", MICROSOFT_SCOPE)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .append_pair("state", state)
        .append_pair("prompt", "select_account");

    // Un seul envoi possible : l'interception et la fermeture de la fenêtre
    // sont deux chemins concurrents vers le même résultat.
    let (tx, rx) = std::sync::mpsc::channel::<Result<String, String>>();
    let tx = std::sync::Arc::new(std::sync::Mutex::new(Some(tx)));
    let tx_nav   = tx.clone();
    let tx_close = tx.clone();
    let expected_state = state.to_string();

    let window = tauri::WebviewWindowBuilder::new(
            app, MICROSOFT_LOGIN_WINDOW, tauri::WebviewUrl::External(url),
        )
        .title("Connectez-vous à votre compte Microsoft")
        .inner_size(520.0, 700.0)
        .min_inner_size(420.0, 560.0)
        .center()
        .focused(true)
        .on_navigation(move |url| {
            if !url.as_str().starts_with(MICROSOFT_REDIRECT_URI) {
                return true;
            }
            let mut code  = None;
            let mut error = None;
            let mut returned_state = None;
            for (key, value) in url.query_pairs() {
                match key.as_ref() {
                    "code"              => code  = Some(value.into_owned()),
                    "error_description" => error = Some(value.into_owned()),
                    "error" if error.is_none() => error = Some(value.into_owned()),
                    "state"             => returned_state = Some(value.into_owned()),
                    _ => {}
                }
            }
            let outcome = if returned_state.as_deref() != Some(expected_state.as_str()) {
                Err("Connexion Microsoft : état OAuth invalide.".to_string())
            } else { match (code, error) {
                (Some(code), _) => Ok(code),
                (None, Some(e)) => Err(format!("Connexion Microsoft : {e}")),
                _ => Err("Connexion Microsoft : réponse inattendue.".to_string()),
            }};
            if let Some(tx) = tx_nav.lock().unwrap().take() { let _ = tx.send(outcome); }
            false   // la page de redirection n'a pas besoin d'être chargée
        })
        .build()
        .map_err(|e| format!("Connexion Microsoft : fenêtre impossible à ouvrir ({e})"))?;

    // Fermeture manuelle : sans ça, l'attente ne se terminerait jamais.
    window.on_window_event(move |event| {
        if matches!(event, tauri::WindowEvent::Destroyed) {
            if let Some(tx) = tx_close.lock().unwrap().take() {
                let _ = tx.send(Err("Connexion annulée.".to_string()));
            }
        }
    });

    let outcome = tauri::async_runtime::spawn_blocking(move || rx.recv())
        .await
        .map_err(|e| format!("Connexion Microsoft : {e}"))?
        .map_err(|_| "Connexion Microsoft : fenêtre fermée.".to_string())?;

    if let Some(win) = app.get_webview_window(MICROSOFT_LOGIN_WINDOW) {
        let _ = win.close();
    }
    outcome
}

/// Connexion complète dans une fenêtre interne : aucun navigateur externe,
/// aucun code à recopier.
#[tauri::command]
async fn microsoft_session_login(
    app:   AppHandle,
    state: State<'_, AppState>,
) -> Result<MicrosoftLoginResult, String> {
    if state.config.session != "microsoft" {
        return Err("Le mode de session actif n'est pas 'microsoft'.".into());
    }
    let client_id = microsoft_client_id(&state.config)?.to_string();
    let client = microsoft_http_client()?;
    let (verifier, challenge) = pkce_pair()?;
    let oauth_state = random_oauth_token()?;
    let code = microsoft_authorization_code(&app, &client_id, &challenge, &oauth_state).await?;
    let body = microsoft_json(
        client.post(MICROSOFT_TOKEN_URL)
            .form(&[
                ("client_id",     client_id.as_str()),
                ("grant_type",    "authorization_code"),
                ("code",          code.as_str()),
                ("redirect_uri",  MICROSOFT_REDIRECT_URI),
                ("code_verifier", verifier.as_str()),
                ("scope",         MICROSOFT_SCOPE),
            ])
            .send().await.map_err(|e| format!("Connexion Microsoft : {e}"))?,
        "Connexion Microsoft",
    ).await?;

    let access_token = body["access_token"].as_str()
        .ok_or_else(|| "Connexion Microsoft : jeton d'accès absent.".to_string())?;
    let refresh_token = body["refresh_token"].as_str()
        .ok_or_else(|| "Connexion Microsoft : jeton de rafraîchissement absent.".to_string())?
        .to_string();

    let (session, expires_at) =
        minecraft_session_from_microsoft(&client, access_token, &client_id).await?;
    activate_microsoft_session(&state, &client_id, refresh_token, session, expires_at)
}

#[tauri::command]
async fn microsoft_session_start(state: State<'_, AppState>) -> Result<MicrosoftDeviceCode, String> {
    if state.config.session != "microsoft" {
        return Err("Le mode de session actif n'est pas 'microsoft'.".into());
    }
    let client_id = microsoft_client_id(&state.config)?.to_string();
    let client = microsoft_http_client()?;
    let body = microsoft_json(
        client.post(MICROSOFT_DEVICE_CODE_URL)
            .form(&[("client_id", client_id.as_str()), ("scope", MICROSOFT_SCOPE)])
            .send().await.map_err(|e| format!("Connexion Microsoft : {e}"))?,
        "Connexion Microsoft",
    ).await?;

    let device_code = body["device_code"].as_str()
        .ok_or_else(|| "Connexion Microsoft : code d'appareil absent.".to_string())?;
    let user_code = body["user_code"].as_str()
        .ok_or_else(|| "Connexion Microsoft : code utilisateur absent.".to_string())?;
    let verification_uri = body["verification_uri"].as_str()
        .ok_or_else(|| "Connexion Microsoft : URL de validation absente.".to_string())?;
    let expires_in = body["expires_in"].as_u64().unwrap_or(900);
    let interval = body["interval"].as_u64().unwrap_or(5).max(1);

    *state.microsoft_login.lock().unwrap() = Some(MicrosoftPendingLogin {
        client_id,
        device_code: device_code.to_string(),
        interval,
        expires_at: Utc::now().timestamp() + expires_in as i64,
    });
    open_external_url(verification_uri);
    Ok(MicrosoftDeviceCode {
        user_code: user_code.to_string(),
        verification_uri: verification_uri.to_string(),
        expires_in,
    })
}

#[tauri::command]
async fn microsoft_session_finish(state: State<'_, AppState>) -> Result<MicrosoftLoginResult, String> {
    let pending = state.microsoft_login.lock().unwrap().take()
        .ok_or_else(|| "Aucune connexion Microsoft n'est en attente.".to_string())?;
    let client = microsoft_http_client()?;
    let mut interval = pending.interval;

    let (microsoft_token, refresh_token) = loop {
        if Utc::now().timestamp() >= pending.expires_at {
            return Err("Le code de connexion Microsoft a expiré. Recommencez la connexion.".into());
        }
        microsoft_sleep(interval).await;
        let response = client.post(MICROSOFT_TOKEN_URL)
            .form(&[
                ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
                ("client_id", pending.client_id.as_str()),
                ("device_code", pending.device_code.as_str()),
            ])
            .send().await.map_err(|e| format!("Connexion Microsoft : {e}"))?;
        let status = response.status();
        let body: serde_json::Value = response.json().await
            .map_err(|e| format!("Connexion Microsoft : réponse invalide ({e})"))?;
        if status.is_success() {
            let access = body["access_token"].as_str()
                .ok_or_else(|| "Connexion Microsoft : jeton absent.".to_string())?;
            let refresh = body["refresh_token"].as_str()
                .ok_or_else(|| "Connexion Microsoft : refresh token absent.".to_string())?;
            break (access.to_string(), refresh.to_string());
        }
        match body["error"].as_str() {
            Some("authorization_pending") => continue,
            Some("slow_down") => { interval += 5; continue },
            Some("authorization_declined") => return Err("Connexion Microsoft refusée par l'utilisateur.".into()),
            Some("expired_token") => return Err("Le code de connexion Microsoft a expiré.".into()),
            _ => {
                let detail = body["error_description"].as_str().unwrap_or("erreur inconnue");
                return Err(format!("Connexion Microsoft : {detail}"));
            }
        }
    };

    let (session, expires_at) = minecraft_session_from_microsoft(
        &client, &microsoft_token, &pending.client_id,
    ).await?;
    activate_microsoft_session(&state, &pending.client_id, refresh_token, session, expires_at)
}

#[tauri::command]
async fn microsoft_session_restore(state: State<'_, AppState>) -> Result<Option<MicrosoftLoginResult>, String> {
    if state.config.session != "microsoft" {
        return Err("Le mode de session actif n'est pas 'microsoft'.".into());
    }
    let path = microsoft_session_path(&state.data_dir);
    let Some(cache) = std::fs::read_to_string(&path).ok()
        .and_then(|s| serde_json::from_str::<MicrosoftAuthCache>(&s).ok())
    else { return Ok(None) };
    let client_id = microsoft_client_id(&state.config)?.to_string();
    if cache.client_id != client_id {
        std::fs::remove_file(&path).ok();
        return Ok(None);
    }

    if cache.minecraft_expires_at > Utc::now().timestamp() + 60 {
        let session = CustomSession {
            username: cache.username,
            uuid: cache.uuid,
            access_token: cache.minecraft_access_token,
            xuid: cache.xuid,
            client_id: client_id.clone(),
        };
        let result = MicrosoftLoginResult { username: session.username.clone(), uuid: session.uuid.clone() };
        *state.custom_session.lock().unwrap() = Some(session);
        return Ok(Some(result));
    }

    let client = microsoft_http_client()?;
    let response = client.post(MICROSOFT_TOKEN_URL)
        .form(&[
            ("grant_type", "refresh_token"),
            ("client_id", client_id.as_str()),
            ("refresh_token", cache.refresh_token.as_str()),
            ("scope", MICROSOFT_SCOPE),
        ])
        .send().await.map_err(|e| format!("Renouvellement Microsoft : {e}"))?;
    let status = response.status();
    let body: serde_json::Value = response.json().await
        .map_err(|e| format!("Renouvellement Microsoft : réponse invalide ({e})"))?;
    if !status.is_success() {
        if body["error"].as_str() == Some("invalid_grant") {
            std::fs::remove_file(&path).ok();
            *state.custom_session.lock().unwrap() = None;
            return Ok(None);
        }
        let detail = body["error_description"].as_str().unwrap_or("erreur inconnue");
        return Err(format!("Renouvellement Microsoft : {detail}"));
    }
    let microsoft_token = body["access_token"].as_str()
        .ok_or_else(|| "Renouvellement Microsoft : jeton absent.".to_string())?;
    let refresh_token = body["refresh_token"].as_str()
        .unwrap_or(&cache.refresh_token)
        .to_string();
    let (session, expires_at) = minecraft_session_from_microsoft(
        &client, microsoft_token, &client_id,
    ).await?;
    Ok(Some(activate_microsoft_session(&state, &client_id, refresh_token, session, expires_at)?))
}

#[tauri::command]
fn microsoft_session_logout(state: State<'_, AppState>) -> Result<(), String> {
    *state.microsoft_login.lock().unwrap() = None;
    *state.custom_session.lock().unwrap() = None;
    std::fs::remove_file(microsoft_session_path(&state.data_dir)).ok();
    Ok(())
}

// ── Session anvil-server ──────────────────────────────────────────────────────

#[derive(Serialize, Clone)]
pub struct AnvilLoginResult {
    pub status:   String, // "ok" | "totp_required"
    pub username: String,
    pub uuid:     String,
}

fn anvil_session_path(data_dir: &Path) -> PathBuf { data_dir.join("anvil_session.json") }

fn anvil_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent("HomeLauncher/1.0")
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(|e| e.to_string())
}

/// POST vers le anvil-server avec la clé d'API du config.json.
fn anvil_post(
    client: &reqwest::Client,
    cfg:    &LauncherConfig,
    url:    String,
) -> reqwest::RequestBuilder {
    let mut req = client.post(url);
    if !cfg.anvil_key.is_empty() { req = req.header("x-anvil-key", &cfg.anvil_key); }
    req
}

/// Connexion au anvil-server (mode session "anvil-session").
/// Retourne status "totp_required" si le compte exige un code 2FA.
#[tauri::command]
async fn anvil_session_login(
    state:    State<'_, AppState>,
    username: String,
    password: String,
    code:     Option<String>,
) -> Result<AnvilLoginResult, String> {
    let server = anvil_server_url(&state.config)?;
    let client = anvil_http_client()?;
    let resp = anvil_post(&client, &state.config, format!("{server}/api/launcher/session"))
        .json(&serde_json::json!({ "username": username, "password": password, "code": code }))
        .send().await.map_err(|e| format!("Erreur réseau : {e}"))?;

    let status = resp.status();
    let body: serde_json::Value = resp.json().await.unwrap_or_default();

    if status.is_success() {
        let session = CustomSession {
            username:     body["username"].as_str().unwrap_or(&username).to_string(),
            uuid:         body["uuid"].as_str().unwrap_or_default().to_string(),
            access_token: body["access_token"].as_str().unwrap_or_default().to_string(),
            xuid:         String::new(),
            client_id:    String::new(),
        };
        let _ = save_json(&anvil_session_path(&state.data_dir), &session);
        let result = AnvilLoginResult {
            status: "ok".into(), username: session.username.clone(), uuid: session.uuid.clone(),
        };
        *state.custom_session.lock().unwrap() = Some(session);
        Ok(result)
    } else {
        match body["error"].as_str() {
            Some("totp_required") => Ok(AnvilLoginResult {
                status: "totp_required".into(), username: String::new(), uuid: String::new(),
            }),
            Some("invalid_code") => Err("Code 2FA invalide.".into()),
            Some("missing_api_key") | Some("invalid_api_key") =>
                Err("Clé d'API invalide — vérifiez 'anvil-key' dans config.json.".into()),
            _ => Err("Identifiants invalides.".into()),
        }
    }
}

/// Restaure la session persistée si elle est encore valide côté serveur.
/// Hors-ligne, la session en cache est conservée pour permettre de jouer.
#[tauri::command]
async fn anvil_session_restore(state: State<'_, AppState>) -> Result<Option<AnvilLoginResult>, String> {
    let path = anvil_session_path(&state.data_dir);
    let saved: Option<CustomSession> = std::fs::read_to_string(&path).ok()
        .and_then(|s| serde_json::from_str(&s).ok());
    let Some(saved) = saved else { return Ok(None) };
    let Ok(server) = anvil_server_url(&state.config) else { return Ok(None) };
    let client = anvil_http_client()?;

    let session = match anvil_post(&client, &state.config, format!("{server}/api/launcher/session/validate"))
        .json(&serde_json::json!({ "token": saved.access_token }))
        .send().await
    {
        Ok(resp) if resp.status().is_success() => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            CustomSession {
                username:     body["username"].as_str().unwrap_or(&saved.username).to_string(),
                uuid:         body["uuid"].as_str().unwrap_or(&saved.uuid).to_string(),
                access_token: saved.access_token,
                xuid:         saved.xuid,
                client_id:    saved.client_id,
            }
        }
        Ok(resp) => {
            let body: serde_json::Value = resp.json().await.unwrap_or_default();
            if body["error"].as_str() == Some("invalid_token") {
                // Token révoqué ou expiré : on oublie la session.
                std::fs::remove_file(&path).ok();
                return Ok(None);
            }
            saved // autre erreur (clé d'API…) : on garde la session locale
        }
        Err(_) => saved, // serveur injoignable : session hors-ligne
    };

    let result = AnvilLoginResult {
        status: "ok".into(), username: session.username.clone(), uuid: session.uuid.clone(),
    };
    *state.custom_session.lock().unwrap() = Some(session);
    Ok(Some(result))
}

#[tauri::command]
async fn anvil_session_logout(state: State<'_, AppState>) -> Result<(), String> {
    let saved = state.custom_session.lock().unwrap().take();
    std::fs::remove_file(anvil_session_path(&state.data_dir)).ok();
    if let (Ok(server), Some(session)) = (anvil_server_url(&state.config), saved) {
        if let Ok(client) = anvil_http_client() {
            let _ = anvil_post(&client, &state.config, format!("{server}/api/launcher/session/logout"))
                .json(&serde_json::json!({ "token": session.access_token }))
                .send().await;
        }
    }
    Ok(())
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[tauri::command]
fn set_custom_session(state: State<'_, AppState>, session: Option<CustomSession>) -> Result<(), String> {
    *state.custom_session.lock().unwrap() = session;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir()
                .unwrap_or_else(|_| dirs::data_local_dir().unwrap_or_default().join("HomeLauncher"));
            std::fs::create_dir_all(&data_dir)?;
            let mut config: LauncherConfig = find_config_json(app.handle());
            let settings:   Settings       = load_json(&data_dir.join("settings.json"));

            // Log du démarrage dans le launcher_dir final
            let launcher_dir = get_launcher_dir(&settings, &config);
            launcher_log(&log_dir(&launcher_dir),
                &format!("HomeLauncher démarré — {} instance(s)", config.instances.len()));

            // Résolution des instances déclarées par id auprès du anvil-server
            resolve_remote_instances(&mut config, &data_dir, &log_dir(&launcher_dir));

            // Appliquer les options de fenêtre depuis config.json
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_title(&config.app_name);
                let _ = win.set_decorations(config.window.decorations);
                let _ = win.set_resizable(config.window.resizable);
                let _ = win.set_shadow(config.window.shadow);
                let _ = win.set_size(tauri::LogicalSize::new(
                    config.window.width.max(800) as f64,
                    config.window.height.max(520) as f64,
                ));
                let _ = win.center();
                #[cfg(debug_assertions)]
                if !config.window.devtools {
                    win.close_devtools();
                    #[cfg(windows)]
                    disable_native_devtools(&win);
                    let _ = win.eval(
                        "window.addEventListener('keydown',e=>{if(e.key==='F12'||(e.ctrlKey&&e.shiftKey&&['I','J','C'].includes(e.key.toUpperCase()))){e.preventDefault();e.stopImmediatePropagation()}},true);window.addEventListener('contextmenu',e=>e.preventDefault(),true);"
                    );
                }
            }

            app.manage(AppState {
                config,
                settings:       Mutex::new(settings),
                data_dir,
                custom_session: Mutex::new(None),
                microsoft_login: Mutex::new(None),
                running:        Mutex::new(HashMap::new()),
            });
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build()
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_server_config,
            get_settings, save_settings, get_system_memory,
            get_default_launcher_dir, get_init_status,
            run_setup, verify_game, launch_game,
            stop_game, get_running_instances,
            get_mods, add_mod, remove_mod, set_mod_enabled,
            open_mods_folder, open_instance_folder, open_logs_folder, pick_folder,
            reset_launcher_dir,
            check_update, do_update,
            set_custom_session,
            microsoft_session_login,
            microsoft_session_start, microsoft_session_finish,
            microsoft_session_restore, microsoft_session_logout,
            anvil_session_login, anvil_session_restore, anvil_session_logout,
            get_launcher_version,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
