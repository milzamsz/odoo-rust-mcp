# Tasks

- [x] Re-read `.agentkanban/INSTRUCTION.md` and `.agentkanban/memory.md` before implementation starts
- [x] Review `config-ui/src/components/tabs/InstancesTab.tsx`, `config-ui/src/types.ts`, and `config-ui/src/__tests__/instances-tab.test.tsx`
- [x] Add table-row checkbox selection and visible-row select-all behavior without breaking sorting and filtering
- [x] Add a shared destructive confirmation modal for selected-row bulk delete and `Remove error instances`
- [x] Add the `Remove error instances` action driven only by current `Error` connection states
- [x] Preserve existing single-row actions and card-view behavior
- [x] Expand UI tests for selection, destructive confirmation, and error-only cleanup targeting
- [x] Run `cd config-ui && npm run lint`
- [x] Run `cd config-ui && npm run typecheck`
- [x] Run `cd config-ui && npm test`
- [x] Run `cd config-ui && npm run build`

### Additional improvements (not in original spec)
- [x] Make Overview metric cards clickable to navigate to their respective pages (Instances, Tools, Prompts)
