use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
    time::Duration,
};
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, Url,
};
use tauri_plugin_shell::process::CommandChild;

mod lifecycle;
use lifecycle::{backend_version, ports_available, stop_child, track_child};

pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
    operation: Mutex<()>,
    exited: Mutex<Arc<AtomicBool>>,
}

const CONFIG_UI_URL: &str = concat!(
    "http://127.0.0.1:3008/?desktopVersion=",
    env!("CARGO_PKG_VERSION")
);
const CONFIG_UI_HOST: &str = "127.0.0.1";
const CONFIG_UI_PORT: u16 = 3008;
const CONFIG_UI_STARTUP_ATTEMPTS: usize = 30;
const CONFIG_UI_RETRY_DELAY: Duration = Duration::from_secs(1);

/// Build a tray menu with actions.
fn build_tray_menu(app: &AppHandle) -> tauri::menu::Menu<tauri::Wry> {
    let open_item = MenuItemBuilder::with_id("open", "Open Window")
        .build(app)
        .unwrap();
    let copy_mcp_item = MenuItemBuilder::with_id("copy_mcp", "Copy MCP Endpoint")
        .build(app)
        .unwrap();
    let docs_item = MenuItemBuilder::with_id("docs", "Open Documentation")
        .build(app)
        .unwrap();
    let config_item = MenuItemBuilder::with_id("config", "Open Config Folder")
        .build(app)
        .unwrap();
    let restart_item = MenuItemBuilder::with_id("restart", "Restart Server")
        .build(app)
        .unwrap();
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app).unwrap();

    MenuBuilder::new(app)
        .items(&[
            &open_item,
            &copy_mcp_item,
            &docs_item,
            &config_item,
            &restart_item,
            &quit_item,
        ])
        .build()
        .unwrap()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SidecarState {
            child: Mutex::new(None),
            operation: Mutex::new(()),
            exited: Mutex::new(Arc::new(AtomicBool::new(true))),
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // Create tray icon programmatically
            let tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("Odoo Rust MCP")
                .build(app)
                .expect("failed to build tray icon");

            // Attach tray menu
            let menu = build_tray_menu(app.handle());
            tray.set_menu(Some(menu)).expect("failed to set tray menu");

            // Attach tray event handler
            let app_handle = app.handle().clone();
            tray.on_tray_icon_event(move |_tray_icon, event| {
                if let TrayIconEvent::Click {
                    button: MouseButton::Left,
                    button_state: MouseButtonState::Up,
                    ..
                } = event
                {
                    // Left-click opens the main window
                    let window = app_handle.get_webview_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            });

            // Start the sidecar server
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn_blocking(move || {
                start_sidecar(&app_handle, false);
            });

            Ok(())
        })
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "copy_mcp" => {
                use tauri_plugin_clipboard_manager::ClipboardExt;

                let (auth_enabled, token) = get_auth_info();
                let clipboard_text = if auth_enabled {
                    if let Some(t) = token {
                        format!("http://127.0.0.1:8787/mcp (Authorization: Bearer {})", t)
                    } else {
                        "http://127.0.0.1:8787/mcp (Authorization: Bearer <token>)".to_string()
                    }
                } else {
                    "http://127.0.0.1:8787/mcp".to_string()
                };

                let _ = app.clipboard().write_text(clipboard_text);
            }
            "docs" => {
                tauri_plugin_opener::open_url(
                    "https://milzamsz.github.io/odoo-rust-mcp/",
                    None::<&str>,
                )
                .unwrap_or_default();
            }
            "config" => {
                let config_path = std::env::var("APPDATA").unwrap_or_else(|_| "~/.config".into());
                tauri_plugin_opener::open_path(&config_path, None::<&str>).unwrap_or_default();
            }
            "restart" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn_blocking(move || {
                    start_sidecar(&app_handle, true);
                });
            }
            "quit" => {
                let state = app.state::<SidecarState>();
                if let Some(child) = state.child.lock().unwrap().take() {
                    let _ = child.kill();
                }
                app.exit(0);
            }
            _ => {}
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // Stop the sidecar on any exit path, not only the tray Quit, so it is never orphaned.
            if let tauri::RunEvent::Exit = event {
                if let Some(child) = app.state::<SidecarState>().child.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}

/// Locate and start the `odoo-rust-mcp.exe` sidecar.
fn start_sidecar(app: &AppHandle, restart: bool) {
    use tauri_plugin_shell::ShellExt;

    let state = app.state::<SidecarState>();
    let Ok(_operation) = state.operation.try_lock() else {
        return;
    };
    set_startup_status(app, "Starting the local Odoo Rust MCP server...");

    if restart {
        let child = state.child.lock().unwrap().take();
        if let Some(child) = child {
            let exited = state.exited.lock().unwrap().clone();
            if let Err(error) = stop_child(
                || child.kill().map_err(|e| e.to_string()),
                || exited.load(Ordering::Acquire) && ports_available(),
            ) {
                show_startup_error(app, &error);
                return;
            }
        } else if !ports_available() {
            let version = backend_version().unwrap_or_else(|| "unknown".into());
            show_startup_error(app, &format!("Server version {version} was started outside this desktop session. Restart it using its owning application or service. It has not been stopped."));
            return;
        }
    }

    if !ports_available() {
        if let Some(version) = backend_version()
            .filter(|_| is_config_ui_ready(SocketAddr::from(([127, 0, 0, 1], CONFIG_UI_PORT))))
        {
            navigate_to_config_ui(app);
            // Same version (e.g. left over from an earlier desktop run): just use it quietly.
            if version == env!("CARGO_PKG_VERSION") {
                return;
            }
            use tauri_plugin_dialog::DialogExt;
            app.dialog().message(format!("Using server version {version}, started outside this desktop session. Desktop version: {}. Restart Server cannot replace an externally managed server.", env!("CARGO_PKG_VERSION"))).title("Existing MCP server").show(|_| {});
        } else {
            show_startup_error(app, "Ports 3008 or 8787 are occupied, but both Odoo MCP endpoints are not ready. No server was started.");
        }
        return;
    }

    let shell = app.shell();
    let sidecar = shell
        .sidecar("odoo-rust-mcp-desktop-server")
        .expect("failed to create sidecar command")
        .args([
            "--transport",
            "http",
            "--listen",
            "127.0.0.1:8787",
            "--config-server-port",
            "3008",
        ]);

    match sidecar.spawn() {
        Ok((rx, child)) => {
            *state.exited.lock().unwrap() = track_child(rx);
            *state.child.lock().unwrap() = Some(child);

            if wait_for_config_ui(app) {
                navigate_to_config_ui(app);
            } else {
                show_startup_error(
                    app,
                    "The local configuration server did not become ready in time. The app is still installed, but the desktop window could not connect to http://127.0.0.1:3008.",
                );
            }
        }
        Err(e) => {
            eprintln!("failed to spawn sidecar: {}", e);
            show_startup_error(
                app,
                &format!(
                    "The desktop app could not start the bundled odoo-rust-mcp server: {}",
                    e
                ),
            );
        }
    }
}

fn wait_for_config_ui(app: &AppHandle) -> bool {
    let address = SocketAddr::from(([127, 0, 0, 1], CONFIG_UI_PORT));

    for attempt in 1..=CONFIG_UI_STARTUP_ATTEMPTS {
        set_startup_status(
            app,
            &format!(
                "Waiting for the local configuration server to become ready (attempt {} of {})...",
                attempt, CONFIG_UI_STARTUP_ATTEMPTS
            ),
        );

        if app
            .state::<SidecarState>()
            .exited
            .lock()
            .unwrap()
            .load(Ordering::Acquire)
        {
            return false;
        }
        if is_config_ui_ready(address) {
            if let Some(version) = backend_version() {
                if version != env!("CARGO_PKG_VERSION") {
                    show_startup_error(app, &format!("Backend version {version} does not match desktop {}. Reinstall the matching backend.", env!("CARGO_PKG_VERSION")));
                    return false;
                }
                set_startup_status(
                    app,
                    &format!("MCP and configuration server version {version} are ready."),
                );
                return true;
            }
        }

        std::thread::sleep(CONFIG_UI_RETRY_DELAY);
    }

    false
}

fn is_config_ui_ready(address: SocketAddr) -> bool {
    let mut stream = match TcpStream::connect_timeout(&address, Duration::from_millis(750)) {
        Ok(stream) => stream,
        Err(_) => return false,
    };

    let _ = stream.set_read_timeout(Some(Duration::from_millis(750)));
    let _ = stream.set_write_timeout(Some(Duration::from_millis(750)));

    let request = format!(
        "GET / HTTP/1.1\r\nHost: {}:{}\r\nConnection: close\r\n\r\n",
        CONFIG_UI_HOST, CONFIG_UI_PORT
    );

    if stream.write_all(request.as_bytes()).is_err() {
        return false;
    }

    let mut response = String::new();
    if stream.read_to_string(&mut response).is_err() {
        return false;
    }

    response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200")
}

fn set_startup_status(app: &AppHandle, status: &str) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    if let Err(error) = window.eval(format!("window.__odooMcpDesktopSetStatus?.({status:?});")) {
        eprintln!("failed to update desktop startup status: {}", error);
    }
}

fn navigate_to_config_ui(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Ok(url) = Url::parse(CONFIG_UI_URL) {
            if let Err(error) = window.navigate(url) {
                show_startup_error(
                    app,
                    &format!("Could not open the configuration UI: {error}"),
                );
            }
        }
    }
}

fn show_startup_error(app: &AppHandle, message: &str) {
    use tauri_plugin_dialog::DialogExt;
    app.dialog()
        .message(message)
        .title("MCP server not restarted")
        .show(|_| {});
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    let script = format!(
        "window.__odooMcpDesktopShowError?.({message:?}); window.__odooMcpDesktopSetStatus?.({message:?});"
    );
    if let Err(error) = window.eval(script) {
        eprintln!("failed to show desktop startup error: {}", error);
    }
}

fn get_config_dir() -> Option<std::path::PathBuf> {
    let home = std::env::var("USERPROFILE")
        .ok()
        .or_else(|| std::env::var("HOME").ok())?;
    Some(
        std::path::PathBuf::from(home)
            .join(".config")
            .join("odoo-rust-mcp"),
    )
}

fn get_auth_info() -> (bool, Option<String>) {
    let mut enabled = false;
    let mut token = None;
    if let Some(config_dir) = get_config_dir() {
        let env_path = config_dir.join("env");
        if let Ok(content) = std::fs::read_to_string(env_path) {
            for line in content.lines() {
                let line = line.trim();
                if line.starts_with('#') || line.is_empty() {
                    continue;
                }
                if let Some((key, val)) = line.split_once('=') {
                    let key = key.trim();
                    let val = val.trim().trim_matches('"').trim_matches('\'');
                    if key == "MCP_AUTH_ENABLED" {
                        enabled = val.to_lowercase() == "true" || val == "1";
                    } else if key == "MCP_AUTH_TOKEN" {
                        token = Some(val.to_string());
                    }
                }
            }
        }
    }
    (enabled, token)
}
