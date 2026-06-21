# Design

## Structure

Create a single backlog task that acts as the visible parent record for the Tauri desktop-app
initiative.

The umbrella task should:

- link to `.agentkanban/specs/windows-tauri-desktop-app/spec.md`
- transition to `done` after all child slices have landed
- clearly state that implementation remains split across tasks `008` through `012`, plus the
  dedicated GitHub distribution follow-up `015`
- avoid duplicating the detailed technical content already captured in the child tasks

## Relationship to child tasks

The child tasks remain the actionable implementation slices:

- foundation
- sidecar lifecycle
- native shell controls
- release packaging
- docs and validation
- GitHub distribution and updater publication

The parent task exists for discoverability and coordination only.
