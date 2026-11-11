#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

//! Envoltorio de escritorio del aula.
//!
//! Arranca el servidor Next (empaquetado en `resources/server`) con el runtime
//! de Node que viaja en `resources/node.exe`, espera a que escuche y abre una
//! ventana apuntando a él. Al cerrar la app se mata el proceso hijo.
//!
//! El puerto es estable entre arranques: cookies de sesión y preferencias del
//! webview se guardan por origen, así que un puerto aleatorio cerraría la
//! sesión y perdería el tema en cada inicio.

use std::net::{TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const DEFAULT_PORT: u16 = 41820;

struct ServerProcess(Mutex<Option<Child>>);

#[derive(Serialize, Deserialize)]
struct Config {
    media_dir: String,
    #[serde(default = "default_port")]
    port: u16,
}

fn default_port() -> u16 {
    DEFAULT_PORT
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

/// Busca el primer puerto libre a partir del preferido, para conservar el
/// mismo origen entre ejecuciones.
fn pick_port(preferred: u16) -> u16 {
    for offset in 0..20u16 {
        let candidate = preferred.saturating_add(offset);

        if TcpListener::bind(("127.0.0.1", candidate)).is_ok() {
            return candidate;
        }
    }

    free_port().unwrap_or(preferred)
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

fn config_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    let directory = app.path().app_data_dir().ok()?;
    std::fs::create_dir_all(&directory).ok()?;
    Some(directory.join("config.json"))
}

fn load_config(app: &tauri::AppHandle) -> Option<Config> {
    let path = config_path(app)?;
    let raw = std::fs::read_to_string(path).ok()?;

    serde_json::from_str(raw.trim_start_matches('\u{feff}')).ok()
}

fn save_config(app: &tauri::AppHandle, config: &Config) -> Option<()> {
    let path = config_path(app)?;
    let payload = serde_json::to_string_pretty(config).ok()?;
    std::fs::write(path, payload).ok()
}

/// `canonicalize` devuelve en Windows la forma `\\?\C:\...`, que Node no
/// interpreta igual al resolver rutas. Se quita el prefijo.
fn without_extended_prefix(path: PathBuf) -> PathBuf {
    #[cfg(windows)]
    {
        let text = path.to_string_lossy();

        if let Some(rest) = text.strip_prefix(r"\\?\") {
            return PathBuf::from(rest);
        }
    }

    path
}

/// Carpeta `media` junto al ejecutable: distribución portable sin instalador.
fn portable_media_dir() -> Option<PathBuf> {
    let base = match std::env::var("APPIMAGE") {
        // En un AppImage, `current_exe` apunta al montaje temporal.
        Ok(appimage) => PathBuf::from(appimage).parent()?.to_path_buf(),
        Err(_) => std::env::current_exe().ok()?.parent()?.to_path_buf(),
    };

    let candidates = [
        base.join("media"),
        base.join("..").join("media"),
        base.join("..").join("..").join("media"),
    ];

    for candidate in candidates {
        if let Ok(normalized) = candidate.canonicalize() {
            if normalized.is_dir() && has_videos(&normalized) {
                return Some(without_extended_prefix(normalized));
            }
        }
    }

    None
}

/// Configuración vigente. La primera vez pide la carpeta de vídeos.
fn resolve_config(app: &tauri::AppHandle) -> Option<Config> {
    if let Some(config) = load_config(app) {
        let media_dir = PathBuf::from(&config.media_dir);

        if media_dir.is_dir() && has_videos(&media_dir) {
            return Some(config);
        }
    }

    // Distribución portable: la carpeta media viaja junto a la app.
    if let Some(media_dir) = portable_media_dir() {
        let config = Config {
            media_dir: media_dir.to_string_lossy().to_string(),
            port: DEFAULT_PORT,
        };

        save_config(app, &config);
        return Some(config);
    }

    for _ in 0..3 {
        let picked = rfd::FileDialog::new()
            .set_title("Selecciona la carpeta «media» del curso")
            .pick_folder()?;

        if has_videos(&picked) {
            let config = Config {
                media_dir: picked.to_string_lossy().to_string(),
                port: DEFAULT_PORT,
            };

            save_config(app, &config)?;
            return Some(config);
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
    let node_name = if cfg!(windows) { "node.exe" } else { "node" };
    let node = resources.join(node_name);
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
    let _ = std::fs::write(data_dir.join("startup.log"), format!("{message}\n"));
}

fn start(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let mut config =
        resolve_config(app).ok_or("No se seleccionó la carpeta de vídeos del curso.")?;

    let port = pick_port(config.port);

    if port != config.port {
        config.port = port;
        let _ = save_config(app, &config);
    }

    let child = spawn_server(app, port, &config.media_dir)?;

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
