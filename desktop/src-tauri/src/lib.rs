use std::sync::Mutex;
use tauri::{
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};
use tauri_plugin_shell::process::CommandChild;

pub struct SidecarState {
    pub child: Mutex<Option<CommandChild>>,
}

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
            tauri::async_runtime::spawn(async move {
                start_sidecar(&app_handle).await;
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
                tauri_plugin_opener::open_url("https://milzamsz.github.io/odoo-rust-mcp/", None::<&str>)
                    .unwrap_or_default();
            }
            "config" => {
                let config_path = std::env::var("APPDATA").unwrap_or_else(|_| "~/.config".into());
                tauri_plugin_opener::open_path(&config_path, None::<&str>).unwrap_or_default();
            }
            "restart" => {
                let app_handle = app.clone();
                tauri::async_runtime::spawn(async move {
                    start_sidecar(&app_handle).await;
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
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Locate and start the `rust-mcp.exe` sidecar.
async fn start_sidecar(app: &AppHandle) {
    use tauri_plugin_shell::ShellExt;

    // Get sidecar state
    let state = app.state::<SidecarState>();

    // Kill prior child if it exists
    {
        let mut child_guard = state.child.lock().unwrap();
        if let Some(child) = child_guard.take() {
            let _ = child.kill();
        }
    }

    let shell = app.shell();
    let sidecar = shell
        .sidecar("rust-mcp")
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
        Ok((mut _rx, child)) => {
            let mut child_guard = state.child.lock().unwrap();
            *child_guard = Some(child);
        }
        Err(e) => {
            eprintln!("failed to spawn sidecar: {}", e);
        }
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
