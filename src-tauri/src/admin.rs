// Panel de configuración (ventana "admin"): claves de API, arrancar con Windows e instalación del archivo GSI.
// Pensado para compartir la app: nada de variables de entorno ni copiar archivos a mano.
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;

const GSI_FILE: &str = "gamestate_integration_dotapluslocal.cfg";
const GSI_CFG: &str = include_str!("../../gsi/gamestate_integration_dotapluslocal.cfg");

// --- Config en disco: %APPDATA%\app.dotapluslocal\config.json ---
// shortcut: claves en texto plano en la carpeta del usuario; si se comparte la PC, pasar al llavero de Windows.
fn config_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app.path().app_config_dir().map_err(|e| e.to_string())?.join("config.json"))
}

fn load(app: &AppHandle) -> serde_json::Value {
    config_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}))
}

fn save(app: &AppHandle, cfg: &serde_json::Value) -> Result<(), String> {
    let path = config_path(app)?;
    std::fs::create_dir_all(path.parent().unwrap()).map_err(|e| e.to_string())?;
    std::fs::write(path, serde_json::to_string_pretty(cfg).unwrap()).map_err(|e| e.to_string())
}

/// Token de STRATZ: el guardado en Configuración; si no hay, la variable STRATZ_TOKEN (compatibilidad).
pub fn stratz_token(app: &AppHandle) -> Result<String, String> {
    load(app)["stratz_token"]
        .as_str()
        .filter(|t| !t.is_empty())
        .map(String::from)
        .or_else(|| std::env::var("STRATZ_TOKEN").ok())
        .ok_or_else(|| "falta la clave de STRATZ (ícono de la bandeja → Configuración)".into())
}

#[tauri::command]
pub fn get_config(app: AppHandle) -> serde_json::Value {
    let cfg = load(&app);
    serde_json::json!({
        // El token de STRATZ nunca sale de Rust: solo si está puesto.
        "stratz_set": stratz_token(&app).is_ok(),
        "opendota_key": cfg["opendota_key"].as_str().unwrap_or(""),
        "autostart": app.autolaunch().is_enabled().unwrap_or(false),
        "dev": cfg!(debug_assertions),
    })
}

/// Guarda las claves; `None` deja la actual, "" la borra.
#[tauri::command]
pub fn set_keys(app: AppHandle, stratz_token: Option<String>, opendota_key: Option<String>) -> Result<(), String> {
    let mut cfg = load(&app);
    if let Some(t) = stratz_token {
        cfg["stratz_token"] = t.trim().into();
    }
    if let Some(k) = opendota_key {
        cfg["opendota_key"] = k.trim().into();
    }
    save(&app, &cfg)
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<(), String> {
    if cfg!(debug_assertions) {
        return Err("solo en la versión compilada (.exe); en desarrollo registraría la copia de prueba".into());
    }
    let al = app.autolaunch();
    if enabled { al.enable() } else { al.disable() }.map_err(|e| e.to_string())
}

// --- Instalar el archivo de Game State Integration en la carpeta de Dota ---

/// Carpeta de Steam desde el registro (HKCU\Software\Valve\Steam → SteamPath).
#[cfg(windows)]
fn steam_path() -> Option<PathBuf> {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x0800_0000; // sin parpadeo de consola
    let out = std::process::Command::new("reg")
        .args(["query", r"HKCU\Software\Valve\Steam", "/v", "SteamPath"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let line = text.lines().find(|l| l.contains("SteamPath"))?;
    Some(PathBuf::from(line.split("REG_SZ").nth(1)?.trim()))
}
#[cfg(not(windows))]
fn steam_path() -> Option<PathBuf> {
    None
}

/// Carpetas de biblioteca de Steam (Dota puede estar en otro disco) según libraryfolders.vdf.
fn libraries(steam: &PathBuf) -> Vec<PathBuf> {
    let mut libs = vec![steam.clone()];
    if let Ok(vdf) = std::fs::read_to_string(steam.join("steamapps").join("libraryfolders.vdf")) {
        for line in vdf.lines().filter(|l| l.trim_start().starts_with("\"path\"")) {
            if let Some(p) = line.split('"').nth(3) {
                libs.push(PathBuf::from(p.replace("\\\\", "\\")));
            }
        }
    }
    libs
}

fn dota_cfg_dir() -> Result<PathBuf, String> {
    let steam = steam_path().ok_or("no encontré Steam en este equipo")?;
    libraries(&steam)
        .into_iter()
        .map(|l| l.join("steamapps").join("common").join("dota 2 beta").join("game").join("dota").join("cfg"))
        .find(|p| p.is_dir())
        .ok_or_else(|| "no encontré Dota 2 en tus bibliotecas de Steam".into())
}

#[tauri::command]
pub fn gsi_status() -> Result<serde_json::Value, String> {
    let file = dota_cfg_dir()?.join("gamestate_integration").join(GSI_FILE);
    let installed = std::fs::read_to_string(&file).map(|s| s == GSI_CFG).unwrap_or(false);
    Ok(serde_json::json!({ "path": file, "installed": installed }))
}

#[tauri::command]
pub fn gsi_install() -> Result<String, String> {
    let dir = dota_cfg_dir()?.join("gamestate_integration");
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let file = dir.join(GSI_FILE);
    std::fs::write(&file, GSI_CFG).map_err(|e| format!("no pude escribir {}: {e}", file.display()))?;
    Ok(file.display().to_string())
}

/// Abre (o trae al frente) la ventana de configuración. Llamar desde el hilo principal.
pub fn open_admin(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("admin") {
        let _ = w.unminimize();
        let _ = w.set_focus();
        return;
    }
    if let Some(cfg) = app.config().app.windows.iter().find(|w| w.label == "admin") {
        let _ = tauri::WebviewWindowBuilder::from_config(app, cfg).and_then(|b| b.build());
    }
}

/// Primera vez (o sin clave de STRATZ): abrir la configuración sola.
pub fn needs_setup(app: &AppHandle) -> bool {
    stratz_token(app).is_err()
}
