use tauri::{Emitter, Manager};

// Debe coincidir con gsi/gamestate_integration_dotapluslocal.cfg
const GSI_PORT: u16 = 52700;
const GSI_TOKEN: &str = "dota-plus-local";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // El overlay no roba clics: todo pasa al juego.
            app.get_webview_window("main")
                .expect("ventana main")
                .set_ignore_cursor_events(true)?;
            let handle = app.handle().clone();
            std::thread::spawn(move || gsi_server(handle));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error al iniciar la app");
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
