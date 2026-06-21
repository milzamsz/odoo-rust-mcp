# Proposal

## Why

Once the desktop shell can launch the local server, it still needs the basic controls users expect
from a Windows desktop app: reopen the main window, open docs, restart the runtime, jump to config,
and quit cleanly.

## What changes

- add tray controls and native shell actions
- add a small desktop loading/error surface around the webview lifecycle
- connect docs and config-folder actions to the existing packaged paths

## Non-goals

- auto-update
- deep native settings UI
- replacing the existing web-based Config UI screens
