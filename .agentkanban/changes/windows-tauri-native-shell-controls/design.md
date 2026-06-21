# Design

## Native controls

- tray items:
  - `Open`
  - `Open documentation`
  - `Restart server`
  - `Open config folder`
  - `Quit`

## Window behavior

- one primary app window for the Config UI
- loading state during startup
- error state on failed readiness with retry and log-path affordances

## Path behavior

- docs target remains `/docs/`
- config folder resolves to the same runtime config directory used by `rust-mcp`
