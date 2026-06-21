# Config UI experience spec

## Intent

Refine the embedded Config UI so it feels cleaner, calmer, and more powerful while preserving the
existing backend/API contract and hot-reload behavior.

## Required behavior

1. The UI uses Mantine as the primary component system and no longer depends on Tailwind at runtime.
2. Navigation is route-based with hash URLs so deep links like `#/instances` work behind the Rust
   static file server without additional server-side SPA routing.
3. Authenticated users land on an Operations Overview screen that summarizes the state of
   instances, tools, prompts, and security/auth posture.
4. The desktop shell includes a persistent collapsible sidebar that expands to full navigation and
   collapses to an icon rail, with the preference persisted between sessions.
5. The Instances area supports both card and table views.
6. The table view supports per-column filtering for every data column and sortable non-action
   columns.
7. The card/table preference persists for desktop usage, while narrow screens remain usable.
8. Editing flows use modern in-app feedback: inline validation, notifications, and confirmation
   modals instead of native `alert()`/`confirm()`.
9. Instance and prompt editing use responsive right-side drawers with sticky actions on desktop and
   accessible full-screen/mobile behavior on smaller viewports.
10. Dirty forms warn before losing unsaved changes during navigation or dismiss.
11. The rewrite keeps the existing REST endpoints and data model unless a small additive backend
    change is strictly necessary.
12. The shell exposes `Light`, `Dark`, and `Auto` appearance modes, with `Auto` as the default for
    new sessions while preserving explicit saved user preferences.
13. The authenticated shell, browser metadata, Windows shortcut, and mdBook documentation use the
    shared Rust Hexagon application identity.
14. The Workspace navigation exposes built-in documentation at `/docs/` in a new tab, and packaged
    installations include the generated mdBook output required by that route.

## Visual direction

- Light-first neutral palette with a restrained blue accent
- Clean, shadcn-inspired hierarchy with less chrome and less repeated helper copy
- Geist Sans and Geist Mono as the bundled type system
- Phosphor icons as the primary icon set
- Desktop-first, with a practical mobile fallback
- Comfortable density, not ultra-dense and not oversized

## Acceptance criteria

- `config-ui/package.json` and `rust-mcp/Cargo.toml` both report version `0.4.0`
- `config-ui` builds and the embedded assets refresh under `rust-mcp/static/dist/`
- The authenticated shell uses Mantine `AppShell` with responsive sidebar behavior and desktop
  collapse persistence
- Hash-route navigation works for overview, instances, tools, prompts, server, and security
- The instances screen preserves import/export, refresh, test-all, add/edit/delete, card view, and
  table view with column filters
- The instances table exposes a filter control for each data column
- The shell, overview, login, and editing surfaces use the new light-first minimalist system
- The header exposes a three-mode appearance selector and `Auto` follows the operating-system
  preference
- Prompt deletion and instance deletion use confirmation UI, not browser-native dialogs
- The overview page renders meaningful operational summaries from existing endpoints/config data
- Tests cover the key rewritten user flows at minimum for auth shell, sidebar behavior, overview
  routing, drawer editing, and instances filtering/view switching
- The Vite placeholder branding is absent from the production HTML and the Rust Hexagon favicon is
  shipped with the built Config UI
- Windows release archives contain the application icon and `docs/book`, and generated shortcuts
  reference the packaged `.ico` file

## Verification

- `cd config-ui && npm run lint`
- `cd config-ui && npm run typecheck`
- `cd config-ui && npm test -- --run`
- `cd config-ui && npm run build`
- `cargo test --all-features --manifest-path rust-mcp/Cargo.toml`
