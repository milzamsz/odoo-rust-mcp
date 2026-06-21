# Design

## Stack decisions

- Tauri `2.11.3`
- keep `config-ui/` as the frontend source of truth
- create a dedicated `desktop/` app instead of folding Tauri into `config-ui/`
- use the existing Rust Hexagon `.ico` for Windows assets

## Repo shape

- add `desktop/package.json`
- add `desktop/src-tauri/`
- add root scripts that make Tauri dev/build reproducible from this repo
- keep release and docs paths separate from implementation follow-up tasks

## Boundary

- foundation work owns scaffolding, metadata, and version pinning
- sidecar lifecycle, tray behavior, and release packaging land in later tasks
