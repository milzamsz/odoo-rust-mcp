# Project Pack

## Purpose

Projects, tasks, milestones, assignments, and operational reporting.

## Typical modules

- `project`

## Primary models

- `project.project`
- `project.task`
- `project.milestone`
- `project.tags`
- optional timesheet models

## Recommended tools

### Query

- `project_search`
- `project_get`
- `project_task_search`
- `project_task_get`
- `project_progress_summary`
- `project_capacity_summary`

### Commands

- `project_task_create`
- `project_task_update`
- `project_task_assign`
- `project_task_change_stage`
- `project_task_archive`

### Workflows

- `project_weekly_review`
- `project_delivery_readiness`

## Policies

- assignment must respect company and access;
- stage changes are audited;
- billable timesheets belong to a separate optional subpack;
- bulk reassignment has limits and preview.
