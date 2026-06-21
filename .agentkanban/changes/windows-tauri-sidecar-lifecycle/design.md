# Design

## Runtime model

- Tauri launches `rust-mcp.exe` as a sidecar child process
- child arguments:
  `--transport http --listen 127.0.0.1:8787 --config-server-port 3008`
- readiness check targets `http://127.0.0.1:3008`

## Ownership rules

- track the process started by the app
- do not kill unrelated `rust-mcp.exe` processes started outside the desktop app
- reuse an already healthy Config UI only if the chosen lifecycle design explicitly supports it

## Failure handling

- startup timeout produces a desktop-app error state with log paths
- restart action is deferred to the tray-control task
