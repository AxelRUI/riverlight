mod admin;

use std::sync::Mutex;
use std::sync::atomic::{AtomicU16, AtomicU8, Ordering};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

// Debe coincidir con gsi/gamestate_integration_dotapluslocal.cfg
const GSI_PORT: u16 = 52700;
const GSI_TOKEN: &str = "dota-plus-local";

const MODE_NONE: u8 = 0;
const MODE_EDIT: u8 = 1;
const MODE_DRAFT: u8 = 2;
const MODE_POST: u8 = 3; // resumen + historial de partidas (clicable)
static MODE: AtomicU8 = AtomicU8::new(MODE_NONE);

// Atajos globales configurables desde el modo mover: [mover, draft, resumen].
const ACTIONS: [&str; 3] = ["edit", "draft", "post"];
static SHORTCUTS: Mutex<[Option<Shortcut>; 3]> = Mutex::new([None; 3]);
/// Tecla de tienda de Dota (código virtual de Windows); solo se LEE, no se registra. F4 por defecto.
static SHOP_VK: AtomicU16 = AtomicU16::new(0x73);
/// Botón del mouse (VK 0x04 rueda, 0x05 Mouse 4, 0x06 Mouse 5) asignado a [mover, draft, resumen]; 0 = ninguno.
/// Windows no deja registrar botones del mouse como atajo global, así que se leen igual que la tecla de tienda.
static MOUSE_BINDS: [AtomicU16; 3] = [AtomicU16::new(0), AtomicU16::new(0), AtomicU16::new(0)];

/// Ejecuta una acción de atajo (desde el teclado registrado o desde un botón del mouse leído).
fn run_action(app: &tauri::AppHandle, idx: usize) {
    let target = match ACTIONS[idx] {
        "edit" => MODE_EDIT,
        "draft" => MODE_DRAFT,
        _ => MODE_POST,
    };
    let next = if MODE.load(Ordering::SeqCst) == target { MODE_NONE } else { target };
    apply_mode(app, next);
}

/// Asigna un botón del mouse a una acción y quita su atajo de teclado.
#[tauri::command]
fn set_mouse_bind(app: tauri::AppHandle, action: String, vk: u16) -> Result<(), String> {
    let idx = ACTIONS.iter().position(|a| *a == action).ok_or("acción desconocida")?;
    if !matches!(vk, 0x04..=0x06) {
        return Err("solo rueda, Mouse 4 o Mouse 5".into());
    }
    let mut list = SHORTCUTS.lock().map_err(|e| e.to_string())?;
    if let Some(old) = list[idx].take() {
        let _ = app.global_shortcut().unregister(old);
    }
    MOUSE_BINDS[idx].store(vk, Ordering::SeqCst);
    Ok(())
}

/// Cambia un atajo global (p. ej. "Control+Shift+KeyM"). Exige modificador para no robarle teclas al juego.
#[tauri::command]
fn set_shortcut(app: tauri::AppHandle, action: String, accel: String) -> Result<(), String> {
    let idx = ACTIONS.iter().position(|a| *a == action).ok_or("acción desconocida")?;
    let new: Shortcut = accel.parse().map_err(|_| format!("atajo inválido: {accel}"))?;
    if new.mods.is_empty() {
        return Err("usa Ctrl, Alt o Shift + tecla para no bloquear teclas del juego".into());
    }
    let mut list = SHORTCUTS.lock().map_err(|e| e.to_string())?;
    if list.iter().enumerate().any(|(i, s)| i != idx && *s == Some(new)) {
        return Err("ese atajo ya lo usa otra acción".into());
    }
    let gs = app.global_shortcut();
    if let Some(old) = list[idx] {
        if old == new {
            return Ok(());
        }
        let _ = gs.unregister(old);
    }
    if let Err(e) = gs.register(new) {
        if let Some(old) = list[idx] {
            let _ = gs.register(old); // dejar el anterior funcionando
        }
        eprintln!("atajo {accel}: {e}");
        return Err("no se pudo registrar (¿lo usa otro programa?)".into()); // texto fijo: es la clave de traducción
    }
    list[idx] = Some(new);
    MOUSE_BINDS[idx].store(0, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
fn set_shop_key(vk: u16) {
    SHOP_VK.store(vk, Ordering::SeqCst);
}

/// Cambia de modo: fuera de "none" el overlay acepta mouse y teclado; en "none" todo pasa al juego.
fn apply_mode(app: &tauri::AppHandle, mode: u8) {
    MODE.store(mode, Ordering::SeqCst);
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.set_ignore_cursor_events(mode == MODE_NONE);
        if mode != MODE_NONE {
            let _ = w.set_focus(); // para poder escribir en el modo draft
        }
    }
    let name = match mode {
        MODE_EDIT => "edit",
        MODE_DRAFT => "draft",
        MODE_POST => "post",
        _ => "none",
    };
    let _ = app.emit("mode", name);
}

/// El frontend sale de un modo con Esc.
#[tauri::command]
fn exit_mode(app: tauri::AppHandle) {
    apply_mode(&app, MODE_NONE);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Primero: si ya hay una copia corriendo (p. ej. la del arranque con Windows), esta se cierra sola.
        // Abrir el .exe otra vez (doble clic) abre la configuración en vez de una segunda copia.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let h = app.clone();
            let _ = app.run_on_main_thread(move || admin::open_admin(&h));
        }))
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, None))
        .setup(|app| {
            // Ícono en la bandeja: la app vive en segundo plano, así se puede cerrar.
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().ok_or("falta el ícono de la app")?)
                .tooltip("Dota Plus Local")
                .menu(&tray_menu(app.handle())?)
                .on_menu_event(|app, e| match e.id().as_ref() {
                    "config" => admin::open_admin(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Arrancar con Windows se activa desde Configuración. Sin clave de STRATZ: abrirla de una vez.
            if admin::needs_setup(app.handle()) {
                admin::open_admin(app.handle());
            }

            // Atajos por defecto; el frontend aplica los guardados con set_shortcut al arrancar.
            // Cada atajo alterna su modo (mover, draft, resumen); repetirlo vuelve a click-through.
            let mods = Some(Modifiers::CONTROL | Modifiers::SHIFT);
            let defaults = [Code::KeyM, Code::KeyD, Code::KeyP].map(|k| Shortcut::new(mods, k));
            app.handle().plugin(
                tauri_plugin_global_shortcut::Builder::new()
                    .with_handler(move |app, sc, ev| {
                        if ev.state() != ShortcutState::Pressed {
                            return;
                        }
                        let Ok(list) = SHORTCUTS.lock() else { return };
                        let Some(idx) = list.iter().position(|s| *s == Some(*sc)) else { return };
                        drop(list);
                        run_action(app, idx);
                    })
                    .build(),
            )?;
            for (i, sc) in defaults.into_iter().enumerate() {
                app.global_shortcut().register(sc)?;
                SHORTCUTS.lock().map_err(|e| e.to_string())?[i] = Some(sc);
            }

            let handle = app.handle().clone();
            std::thread::spawn(move || gsi_server(handle));
            #[cfg(windows)]
            {
                let handle = app.handle().clone();
                std::thread::spawn(move || shop_watcher(handle));
            }

            // Desarrollo: overlay al instante para probar sin Dota. Compilado: solo mientras Dota está abierto.
            if cfg!(debug_assertions) {
                create_overlay(app.handle())?;
            } else {
                #[cfg(windows)]
                {
                    let handle = app.handle().clone();
                    std::thread::spawn(move || dota_watcher(handle));
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![stratz_items, stratz_query, exit_mode, set_shortcut, set_shop_key, set_mouse_bind,
            admin::get_config, admin::set_keys, admin::set_lang, admin::set_autostart, admin::gsi_status, admin::gsi_install])
        .build(tauri::generate_context!())
        .expect("error al iniciar la app")
        .run(|_app, event| {
            // Cerrar el overlay (al salir de Dota) no cierra la app; solo "Salir" en la bandeja (code = Some).
            if let tauri::RunEvent::ExitRequested { code: None, api, .. } = event {
                api.prevent_exit();
            }
        });
}

/// Menú de la bandeja en el idioma guardado en Configuración.
pub fn tray_menu(app: &tauri::AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let en = admin::lang(app) == "en";
    let config = MenuItem::with_id(app, "config", if en { "Settings" } else { "Configuración" }, true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", if en { "Exit Dota Plus Local" } else { "Salir de Dota Plus Local" }, true, None::<&str>)?;
    Menu::with_items(app, &[&config, &quit])
}

/// Crea la ventana del overlay (definida en tauri.conf.json con "create": false) cubriendo el monitor y
/// sin robar clics.
fn create_overlay(app: &tauri::AppHandle) -> tauri::Result<()> {
    if app.get_webview_window("main").is_some() {
        return Ok(());
    }
    let cfg = app.config().app.windows.iter().find(|w| w.label == "main").expect("ventana main en tauri.conf.json").clone();
    let win = tauri::WebviewWindowBuilder::from_config(app, &cfg)?.build()?;
    // Cubrir todo el monitor; "maximized" deja fuera la barra de tareas y no siempre aplica.
    if let Some(m) = win.primary_monitor()? {
        win.set_position(*m.position())?;
        win.set_size(*m.size())?;
    }
    win.set_ignore_cursor_events(true)?;
    Ok(())
}

/// Reposo: el overlay (y su WebView) existe solo mientras la ventana "Dota 2" está abierta.
#[cfg(windows)]
fn dota_watcher(app: tauri::AppHandle) {
    use windows_sys::Win32::UI::WindowsAndMessaging::FindWindowW;
    let title: Vec<u16> = "Dota 2".encode_utf16().chain([0]).collect(); // terminada en NUL para Win32
    loop {
        let running = !unsafe { FindWindowW(std::ptr::null(), title.as_ptr()) }.is_null();
        if running != app.get_webview_window("main").is_some() {
            let h = app.clone();
            // Crear/destruir ventanas en el hilo principal.
            let _ = app.run_on_main_thread(move || {
                if running {
                    let _ = create_overlay(&h);
                } else if let Some(w) = h.get_webview_window("main") {
                    MODE.store(MODE_NONE, Ordering::SeqCst);
                    let _ = w.destroy();
                }
            });
        }
        std::thread::sleep(std::time::Duration::from_secs(2));
    }
}

/// Compras de items del héroe según STRATZ. Va por Rust porque STRATZ exige
/// User-Agent "STRATZ_API" (el webview no puede ponerlo) y no acepta CORS.
/// El token sale de Configuración (o de la variable STRATZ_TOKEN) y nunca va al frontend.
#[tauri::command]
async fn stratz_items(app: tauri::AppHandle, hero_id: u32, position: Option<u8>) -> Result<serde_json::Value, String> {
    let token = admin::stratz_token(&app)?;
    tauri::async_runtime::spawn_blocking(move || {
        // Esquema verificado por introspección (nov 2026): itemFullPurchase devuelve la lista directa,
        // con time en minutos. Sin positionIds viene vacío para varios héroes: sin rol se piden las 5 posiciones.
        let positions = match position {
            Some(p @ 1..=5) => format!("POSITION_{p}"),
            _ => "POSITION_1, POSITION_2, POSITION_3, POSITION_4, POSITION_5".into(),
        };
        let query = format!(
            "{{ heroStats {{ \
               full: itemFullPurchase(heroId: {hero_id}, positionIds: [{positions}]) {{ itemId time matchCount }} \
               start: itemStartingPurchase(heroId: {hero_id}, positionIds: [{positions}]) {{ itemId matchCount }} \
             }} }}"
        );
        Ok(stratz_post(&token, &query)?["heroStats"].clone())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Consulta GraphQL libre a STRATZ (la arma el frontend; el token nunca sale de Rust). Devuelve `data`.
#[tauri::command]
async fn stratz_query(app: tauri::AppHandle, query: String) -> Result<serde_json::Value, String> {
    let token = admin::stratz_token(&app)?;
    tauri::async_runtime::spawn_blocking(move || stratz_post(&token, &query))
        .await
        .map_err(|e| e.to_string())?
}

fn stratz_post(token: &str, query: &str) -> Result<serde_json::Value, String> {
    let (status, res): (u16, serde_json::Value) = match ureq::post("https://api.stratz.com/graphql")
        .set("User-Agent", "STRATZ_API")
        .set("Authorization", &format!("Bearer {token}"))
        .send_json(serde_json::json!({ "query": query }))
    {
        Ok(r) => (200, r.into_json().map_err(|e| e.to_string())?),
        // GraphQL responde 400 con el motivo en el cuerpo: conservarlo para el panel.
        Err(ureq::Error::Status(code, r)) => (code, r.into_json().unwrap_or_default()),
        Err(e) => return Err(e.to_string()),
    };
    if let Some(msg) = res["errors"][0]["message"].as_str() {
        return Err(format!("STRATZ: {msg}"));
    }
    if status != 200 {
        return Err(format!("api.stratz.com respondió {status}"));
    }
    Ok(res["data"].clone())
}

/// GSI no dice si la tienda está abierta: se deduce de la tecla de tienda (F4 por defecto en Dota).
/// Solo LEE el estado de dos teclas (no las bloquea; Dota las recibe igual) y solo con Dota en primer plano.
/// shortcut: abrir/cerrar la tienda con el mouse no se detecta. La tecla se cambia en el modo mover (set_shop_key).
#[cfg(windows)]
fn shop_watcher(app: tauri::AppHandle) {
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetAsyncKeyState, VK_ESCAPE};
    use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowTextW};

    let down = |vk: u16| unsafe { GetAsyncKeyState(vk as i32) } as u16 & 0x8000 != 0;
    let dota_active = || {
        let mut buf = [0u16; 32];
        let n = unsafe { GetWindowTextW(GetForegroundWindow(), buf.as_mut_ptr(), buf.len() as i32) };
        String::from_utf16_lossy(&buf[..n.max(0) as usize]) == "Dota 2"
    };

    let (mut open, mut prev_shop, mut prev_esc) = (false, false, false);
    let mut prev_mouse = [false; 3];
    loop {
        std::thread::sleep(std::time::Duration::from_millis(30));
        let (shop, esc) = (down(SHOP_VK.load(Ordering::SeqCst)), down(VK_ESCAPE));
        let next = if !dota_active() {
            open
        } else if shop && !prev_shop {
            !open // la tecla de tienda abre y cierra
        } else if esc && !prev_esc {
            false
        } else {
            open
        };
        (prev_shop, prev_esc) = (shop, esc);
        // Botones del mouse de mover/draft/resumen: en cualquier ventana, igual que un atajo global.
        for (i, bind) in MOUSE_BINDS.iter().enumerate() {
            let vk = bind.load(Ordering::SeqCst);
            let now = vk != 0 && down(vk);
            if now && !prev_mouse[i] {
                run_action(&app, i);
            }
            prev_mouse[i] = now;
        }
        if next != open {
            open = next;
            let _ = app.emit("shop", open);
        }
    }
}

/// Recibe los POST de Dota (GSI) y los reenvía al frontend como evento "gsi".
fn gsi_server(app: tauri::AppHandle) {
    let server = match tiny_http::Server::http(("127.0.0.1", GSI_PORT)) {
        Ok(s) => s,
        Err(e) => {
            eprintln!("GSI: no se pudo abrir el puerto {GSI_PORT}: {e}");
            return;
        }
    };
    for mut req in server.incoming_requests() {
        let mut body = String::new();
        if req.as_reader().read_to_string(&mut body).is_ok() {
            if let Ok(state) = serde_json::from_str::<serde_json::Value>(&body) {
                if state["auth"]["token"] == GSI_TOKEN {
                    let _ = app.emit("gsi", state);
                }
            }
        }
        let _ = req.respond(tiny_http::Response::empty(200));
    }
}
