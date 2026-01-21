This folder contains the **editable runtime configuration** for the MCP server:

- `tools.json` (tools list + schemas + op mapping)
- `prompts.json` (prompt definitions)
- `server.json` (server name/instructions/protocol default)

These files are the ones you should edit day-to-day.

Do **not** edit `config-defaults/*` for normal configuration changes; those files are embedded as **seed defaults** and are only used to auto-create missing runtime configs.
