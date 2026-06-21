# Proposal

## Why

The Mantine rewrite delivered the necessary technical reset, but the interface still feels too
noisy for daily operational use:

- the shell is visually heavy and dark-first
- the header carries too many competing status elements
- the sidebar uses oversized blocks and secondary copy that dilute navigation
- large modal editors feel detached from the list context
- multiple screens still repeat labels, badges, and helper text more than needed

The user explicitly asked for a cleaner, lighter, shadcn-inspired configuration experience that
stays lightweight while still feeling powerful.

## What changes

- move the Config UI to a light-first minimalist visual system
- add a persistent collapsible desktop sidebar that collapses to an icon rail
- simplify shell text, status placement, spacing, and iconography
- move long editing flows into right-side drawers with sticky save/cancel actions
- refine overview, instances, prompts, tools, server, security, and login to use the new system
- preserve the current Rust API, routes, hot reload behavior, and functional capabilities
- introduce the Rust Hexagon identity across the UI, browser, documentation, and Windows shortcut
- package generated mdBook documentation so the sidebar link works after installation

## Non-goals

- changing the Rust config-manager API or runtime config schema
- removing dark mode support entirely
- adding new backend features unrelated to the UI refinement
