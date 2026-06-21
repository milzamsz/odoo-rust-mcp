# Design

## Stack decisions

- React 19
- Mantine 9 for components, theming, forms, modals, and notifications
- `react-router-dom` with `HashRouter`
- `@tanstack/react-table` for instances table state and filtering
- Keep `lucide-react` for icons to avoid adding another icon system during the rewrite

## Shell

- `AppShell` with responsive navbar/drawer behavior
- route model:
  - `/` overview
  - `/instances`
  - `/tools`
  - `/prompts`
  - `/server`
  - `/security`
- global theme toggle with dark mode default

## State and feedback

- Keep the current auth provider and config API hooks, but route all user-visible feedback through
  Mantine notifications and inline status surfaces
- Introduce a small shared dirty-state context for modal dismissal and navigation confirmation
- Use confirmation modals for destructive actions

## Feature surfaces

### Overview

- summary metrics for instances, tools, prompts, and auth posture
- quick links into the main configuration areas
- small operational notes for runtime source health

### Instances

- preserve existing behavior and API calls
- keep card and table views
- use TanStack table for sorting and per-column filtering
- modal-based instance editor, large on desktop and full-screen on smaller screens
- keep runtime sync status card in the page

### Tools, prompts, server, security

- move from card-heavy custom styling to Mantine forms/tables/lists
- preserve existing edit semantics
- remove native dialogs

## Cleanup targets

- remove Tailwind CSS usage from the active UI
- retire custom button/card/status shell wrappers once replaced
- split oversized tabs into smaller supporting modules where it reduces complexity
- keep compatibility with the embedded Rust static hosting path
