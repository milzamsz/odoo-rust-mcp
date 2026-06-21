# Design

## Stack decisions

- Keep React 19, Mantine 9, and the existing route structure
- Replace `lucide-react` with `@phosphor-icons/react` for a thicker, calmer icon language
- Bundle Geist Sans and Geist Mono locally via npm packages
- Keep TanStack Table for instances filtering and sorting

## Visual system

- Light mode becomes the default color scheme
- Theme tokens shift to warm neutrals with restrained blue accents and subtle borders
- Radius range tightens toward `8px` to `12px`
- Large gradients, glass effects, heavy badges, and decorative chrome are removed
- Uppercase micro-labels are used sparingly for structural metadata only

## Shell

- Desktop navbar supports two states:
  - expanded navigation around `240px`
  - collapsed icon rail around `64px`
- Desktop collapse state persists in `localStorage`
- Mobile keeps a drawer-style sidebar
- Header becomes quieter: route title, sidebar toggle, keyboard help, color-scheme toggle
- Hot reload and unsaved state move to a small status strip/footer area instead of competing with
  primary navigation
- The Rust Hexagon SVG replaces the generic database mark in the shell and login surface
- Documentation remains in the Workspace navigation, opens `/docs/` in a new tab, and uses an
  explicit accessible label

## Brand assets and delivery

- `config-ui/public/app-icon.svg` is the browser-facing vector source
- `AppMark` provides the same geometry inside React without adding a raster dependency
- `scripts/New-AppIcon.ps1` deterministically generates the multi-resolution Windows ICO
- Release builds generate mdBook once, package `docs/book`, and install it beside or in the platform
  share directory discovered by the Rust config server

## Editing flows

- Instance and prompt editing move from centered modals to right-side drawers
- Drawer actions stay sticky at the bottom
- Dirty-state confirmation stays in place for navigation, dismiss, and logout

## Surface refinements

### Overview

- Use restrained summary cards and a concise operational note layout
- Reduce decorative copy and make the page read like a practical control room

### Instances

- Keep card and table modes
- Make filters read as one workspace instead of stacked marketing panels
- Use lighter cards, quieter metadata blocks, and cleaner actions

### Tools, prompts, server, security, login

- Apply the same spacing, typography, icon, and border system
- Reduce card nesting where possible
- Keep interactions fast and explicit
