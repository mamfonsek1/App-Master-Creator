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

fn error_dialog(title: &str, description: &str) {
    rfd::MessageDialog::new()
        .set_title(title)
        .set_description(description)
        .set_level(rfd::MessageLevel::Error)
        .show();
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

/// Comprueba que la carpeta elegida parece la del curso: al menos un `.mp4`
/// en ella o en un subdirectorio inmediato.
fn has_videos(directory: &Path) -> bool {
    let Ok(entries) = std::fs::read_dir(directory) else {
        return false;
    };

    for entry in entries.flatten() {
        let path = entry.path();

        if path.is_file() && path.extension().is_some_and(|ext| ext.eq_ignore_ascii_case("mp4")) {
            return true;
        }

        if path.is_dir() {
            if let Ok(children) = std::fs::read_dir(&path) {
                let found = children.flatten().any(|child| {
                    let child_path = child.path();
                    child_path.is_file()
                        && child_path
                            .extension()
                            .is_some_and(|ext| ext.eq_ignore_ascii_case("mp4"))
                });

                if found {
                    return true;
                }
            }
        }
    }

    false
}

fn save_config(config_path: &Path, media_dir: &str) -> Option<()> {
    let payload = serde_json::to_string_pretty(&Config {
        media_dir: media_dir.to_string(),
    })
    .ok()?;

    std::fs::write(config_path, payload).ok()
}

/// Lee la carpeta de vídeos de la configuración. Si no existe (o apunta a una
/// ruta que ya no está), pide al usuario que la elija.
fn resolve_media_dir(app: &tauri::AppHandle) -> Option<String> {
    let data_dir = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&data_dir).ok()?;
    let config_path = data_dir.join("config.json");

    if let Ok(raw) = std::fs::read_to_string(&config_path) {
        let trimmed = raw.trim_start_matches('\u{feff}');

        if let Ok(config) = serde_json::from_str::<Config>(trimmed) {
            let configured = PathBuf::from(&config.media_dir);

            if configured.is_dir() && has_videos(&configured) {
                return Some(config.media_dir);
            }
        }
    }

    for _ in 0..3 {
        let picked = rfd::FileDialog::new()
            .set_title("Selecciona la carpeta «media» del curso")
            .pick_folder()?;

        if has_videos(&picked) {
            let media_dir = picked.to_string_lossy().to_string();
            save_config(&config_path, &media_dir)?;
            return Some(media_dir);
        }

        error_dialog(
            "Aula Lans",
            "Esa carpeta no contiene los vídeos del curso.\n\nElige la carpeta «media», que dentro tiene una carpeta por módulo con archivos .mp4.",
        );
    }

    None
}

fn spawn_server(
    app: &tauri::AppHandle,
    port: u16,
    media_dir: &str,
) -> Result<Child, Box<dyn std::error::Error>> {
    let resource_root = app.path().resource_dir()?;
    // El bundler copia `src-tauri/resources/**` a `{resource_dir}/resources/**`.
    let bundled = resource_root.join("resources");
    let resources = if bundled.is_dir() {
        bundled
    } else {
        resource_root
    };

    let server_dir = resources.join("server");
    let node = resources.join("node.exe");
    let data_dir = app.path().app_data_dir()?;

    std::fs::create_dir_all(&data_dir)?;

    if !node.is_file() {
        return Err(format!("No se encontró el runtime en {}", node.display()).into());
    }

    if !server_dir.is_dir() {
        return Err(format!("No se encontró el servidor en {}", server_dir.display()).into());
    }

    let mut command = Command::new(node);
    command
        .arg("server.js")
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("NEXT_TELEMETRY_DISABLED", "1")
        .env("PORT", port.to_string())
        .env("HOSTNAME", "127.0.0.1")
        .env("MEDIA_DIR", media_dir)
        .env("DATABASE_FILE", data_dir.join("aula.db"))
        .env("CONTENT_FILE", server_dir.join("content").join("course.json"))
        .stdout(Stdio::null())
        .stderr(Stdio::null());

    // Sin esto, Windows abre una consola negra para el servidor interno.
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let child = command.spawn()?;

    Ok(child)
}

/// Deja constancia de los fallos de arranque: la app no tiene consola.
fn log_startup_error(app: &tauri::AppHandle, message: &str) {
    let Ok(data_dir) = app.path().app_data_dir() else {
        return;
    };

    let _ = std::fs::create_dir_all(&data_dir);
    let _ = std::fs::write(
        data_dir.join("startup.log"),
        format!("{}\n{}\n", chrono_like_now(), message),
    );
}

fn chrono_like_now() -> String {
    match std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH) {
        Ok(elapsed) => format!("unix={}", elapsed.as_secs()),
        Err(_) => "unix=0".to_string(),
    }
}

fn start(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let media_dir = resolve_media_dir(app).ok_or("No se seleccionó la carpeta de vídeos del curso.")?;

    let port = free_port()?;
    let child = spawn_server(app, port, &media_dir)?;

    app.manage(ServerProcess(Mutex::new(Some(child))));

    if !wait_until_ready(port) {
        return Err("El servidor del aula no respondió a tiempo.".into());
    }

    let url = format!("http://127.0.0.1:{port}")
        .parse()
        .map_err(|_| "URL del servidor inválida.")?;

    // Ajusta la ventana al monitor: en pantallas pequeñas 1360×900 no cabe.
    let (width, height) = match app.primary_monitor() {
        Ok(Some(monitor)) => {
            let scale = monitor.scale_factor();
            let logical_width = monitor.size().width as f64 / scale;
            let logical_height = monitor.size().height as f64 / scale;

            (
                (logical_width * 0.92).clamp(960.0, 1440.0),
                (logical_height * 0.88).clamp(640.0, 900.0),
            )
        }
        _ => (1280.0, 820.0),
    };

    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Aula Lans")
        .inner_size(width, height)
        .min_inner_size(900.0, 600.0)
        .center()
        .build()?;

    Ok(())
}

fn main() {
    let app = tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle().clone();

            match start(&handle) {
                Ok(()) => Ok(()),
                Err(error) => {
                    let message = error.to_string();
                    log_startup_error(&handle, &message);
                    error_dialog(
                        "Aula Lans",
                        &format!(
                            "No se pudo iniciar el aula.\n\n{message}\n\nDetalle en:\n%APPDATA%\\com.lans.aula\\startup.log"
                        ),
                    );
                    Err(error)
                }
            }
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
