#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Envoltorio de escritorio del aula.
//!
//! Arranca el servidor Next (empaquetado en `resources/server`) con el runtime
//! de Node que viaja en `resources/node.exe`, espera a que escuche y abre una
//! ventana apuntando a él. Al cerrar la app se mata el proceso hijo.

use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct ServerProcess(Mutex<Option<Child>>);

#[derive(Serialize, Deserialize)]
struct Config {
    media_dir: String,
}

fn free_port() -> Result<u16, Box<dyn std::error::Error>> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    Ok(listener.local_addr()?.port())
}

fn wait_until_ready(port: u16) -> bool {
    let deadline = Instant::now() + Duration::from_secs(45);

    while Instant::now() < deadline {
        if TcpStream::connect(("127.0.0.1", port)).is_ok() {
            return true;
        }

        std::thread::sleep(Duration::from_millis(200));
    }

    false
}

/// Lee la carpeta de vídeos de la configuración. Si no existe (o apunta a una
/// ruta que ya no está), pide al usuario que la elija una vez.
fn resolve_media_dir(app: &tauri::AppHandle) -> Option<String> {
    let data_dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&data_dir).ok()?;
    let config_path = data_dir.join("config.json");

    if let Ok(raw) = std::fs::read_to_string(&config_path) {
        if let Ok(config) = serde_json::from_str::<Config>(&raw) {
            if Path::new(&config.media_dir).is_dir() {
                return Some(config.media_dir);
            }
        }
    }

    let picked = rfd::FileDialog::new()
        .set_title("Selecciona la carpeta «media» del curso")
        .pick_folder()?;

    let media_dir = picked.to_string_lossy().to_string();
    let payload = serde_json::to_string_pretty(&Config {
        media_dir: media_dir.clone(),
    })
    .ok()?;

    std::fs::write(config_path, payload).ok()?;

    Some(media_dir)
}

fn spawn_server(
    app: &tauri::AppHandle,
    port: u16,
    media_dir: &str,
) -> Result<Child, Box<dyn std::error::Error>> {
    let resources = app.path().resource_dir()?;
    let server_dir = resources.join("server");
    let node = resources.join("node.exe");
    let data_dir = app.path().app_data_dir()?;

    std::fs::create_dir_all(&data_dir)?;

    let child = Command::new(node)
        .arg("server.js")
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("MEDIA_DIR", media_dir)
        .env("DATABASE_FILE", data_dir.join("aula.db"))
        .env("CONTENT_FILE", server_dir.join("content").join("course.json"))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()?;

    Ok(child)
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            let media_dir = resolve_media_dir(&handle)
                .ok_or("No se seleccionó la carpeta de vídeos del curso.")?;

            let port = free_port()?;
            let child = spawn_server(&handle, port, &media_dir)?;

            app.manage(ServerProcess(Mutex::new(Some(child))));

            if !wait_until_ready(port) {
                return Err("El servidor del aula no respondió a tiempo.".into());
            }

            let url = format!("http://127.0.0.1:{port}")
                .parse()
                .map_err(|_| "URL del servidor inválida.")?;

            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
                .title("Aula Lans")
                .inner_size(1360.0, 900.0)
                .min_inner_size(960.0, 640.0)
                .center()
                .build()?;

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("no se pudo iniciar la aplicación");

    app.run(|app_handle, event| {
        if let RunEvent::Exit = event {
            if let Some(state) = app_handle.try_state::<ServerProcess>() {
                if let Ok(mut guard) = state.0.lock() {
                    if let Some(mut child) = guard.take() {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                }
            }
        }
    });
}
