use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::{
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    time::{Duration, Instant},
};
use tauri_plugin_shell::process::CommandEvent;

pub fn track_child(mut events: tauri::async_runtime::Receiver<CommandEvent>) -> Arc<AtomicBool> {
    let exited = Arc::new(AtomicBool::new(false));
    let flag = exited.clone();
    tauri::async_runtime::spawn(async move {
        while let Some(event) = events.recv().await {
            if matches!(event, CommandEvent::Terminated(_)) {
                flag.store(true, Ordering::Release);
                break;
            }
        }
    });
    exited
}

pub fn stop_child(
    stop: impl FnOnce() -> Result<(), String>,
    stopped: impl FnMut() -> bool,
) -> Result<(), String> {
    stop().map_err(|error| {
        format!("Could not stop the owned server: {error}. No replacement was started.")
    })?;
    if !wait_until(Duration::from_secs(10), stopped) {
        return Err("The old server has not exited or its ports are still occupied. No replacement was started.".into());
    }
    Ok(())
}

pub fn ports_available() -> bool {
    let Ok(_ui) = TcpListener::bind(("127.0.0.1", 3008)) else {
        return false;
    };
    TcpListener::bind(("127.0.0.1", 8787)).is_ok()
}

pub fn wait_until(timeout: Duration, mut ready: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + timeout;
    loop {
        if ready() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(100));
    }
}

pub fn backend_version() -> Option<String> {
    health_version(SocketAddr::from(([127, 0, 0, 1], 8787)))
}

fn health_version(address: SocketAddr) -> Option<String> {
    let mut stream = TcpStream::connect_timeout(&address, Duration::from_millis(500)).ok()?;
    // Older servers probe Odoo instances serially in /health, so allow them time to answer.
    stream
        .set_read_timeout(Some(Duration::from_secs(15)))
        .ok()?;
    stream
        .set_write_timeout(Some(Duration::from_secs(1)))
        .ok()?;
    // HTTP/1.0 avoids chunked encoding. A degraded Odoo connection is still a
    // ready MCP server; only its local health response and version are required.
    write!(
        stream,
        "GET /health HTTP/1.0\r\nHost: {address}\r\nConnection: close\r\n\r\n"
    )
    .ok()?;
    let mut response = String::new();
    stream.take(256 * 1024).read_to_string(&mut response).ok()?;
    let (headers, body) = response.split_once("\r\n\r\n")?;
    let status = headers.lines().next()?.split_whitespace().nth(1)?;
    if status != "200" && status != "503" {
        return None;
    }
    let body: serde_json::Value = serde_json::from_str(body).ok()?;
    // "unhealthy" only means every Odoo instance is unreachable; the MCP server itself is up.
    if !matches!(
        body.get("status")?.as_str()?,
        "ok" | "healthy" | "degraded" | "unhealthy"
    ) {
        return None;
    }
    Some(body.get("version")?.as_str()?.to_owned())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn serve(response: &'static str) -> SocketAddr {
        let listener = TcpListener::bind(("127.0.0.1", 0)).unwrap();
        let address = listener.local_addr().unwrap();
        std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut request = Vec::new();
            while !request.ends_with(b"\r\n\r\n") {
                let mut byte = [0];
                stream.read_exact(&mut byte).unwrap();
                request.push(byte[0]);
            }
            stream.write_all(response.as_bytes()).unwrap();
        });
        address
    }

    #[test]
    fn health_requires_odoo_response_and_reports_running_version() {
        let address =
            serve("HTTP/1.0 200 OK\r\n\r\n{\"status\":\"degraded\",\"version\":\"0.6.6\"}");
        assert_eq!(health_version(address).as_deref(), Some("0.6.6"));
        let address =
            serve("HTTP/1.0 200 OK\r\n\r\n{\"status\":\"unhealthy\",\"version\":\"0.6.6\"}");
        assert_eq!(health_version(address).as_deref(), Some("0.6.6"));
        assert!(
            health_version(serve("HTTP/1.0 200 OK\r\n\r\n<html>Other service</html>")).is_none()
        );
        assert!(health_version(serve("HTTP/1.0 401 Unauthorized\r\n\r\n{}")).is_none());
    }

    #[test]
    fn shutdown_wait_is_bounded_and_waits_for_completion() {
        assert!(!wait_until(Duration::ZERO, || false));
        let mut attempts = 0;
        assert!(wait_until(Duration::from_secs(1), || {
            attempts += 1;
            attempts == 2
        }));
        assert_eq!(attempts, 2);
    }

    #[cfg(unix)]
    #[test]
    fn owned_child_exits_before_replacement_starts() {
        use std::{cell::RefCell, process::Command};
        let child = RefCell::new(Command::new("sleep").arg("30").spawn().unwrap());
        let first_pid = child.borrow().id();
        stop_child(
            || child.borrow_mut().kill().map_err(|e| e.to_string()),
            || child.borrow_mut().try_wait().unwrap().is_some(),
        )
        .unwrap();
        let replacement = RefCell::new(Command::new("sleep").arg("30").spawn().unwrap());
        assert_ne!(first_pid, replacement.borrow().id());
        stop_child(
            || replacement.borrow_mut().kill().map_err(|e| e.to_string()),
            || replacement.borrow_mut().try_wait().unwrap().is_some(),
        )
        .unwrap();
        assert!(stop_child(
            || Err("denied".into()),
            || panic!("must not wait after failed stop")
        )
        .unwrap_err()
        .contains("denied"));
    }
}
