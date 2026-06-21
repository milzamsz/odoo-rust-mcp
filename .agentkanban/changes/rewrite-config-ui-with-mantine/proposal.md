# Proposal

## Why

The existing Config UI works, but it feels fragmented:

- the shell and tabs are hand-rolled and inconsistent
- several key screens are oversized single files
- interaction feedback still relies on browser-native dialogs in places
- the product has grown beyond the current Tailwind + custom-widget approach

The user explicitly asked for a full UI rewrite using Mantine that stays lightweight while feeling
more powerful.

## What changes

- upgrade the Config UI to React 19 and Mantine 9
- replace the custom shell with a route-based Mantine application shell
- add an Operations Overview landing screen
- redesign instances, tools, prompts, server, and security around clearer data workflows
- remove Tailwind from the runtime UI stack
- refresh tests and embedded static assets

## Non-goals

- changing the Rust config-manager API contract without need
- expanding the backend feature set beyond what the rewritten UI needs
- introducing pagination or a brand-new domain model for config data
