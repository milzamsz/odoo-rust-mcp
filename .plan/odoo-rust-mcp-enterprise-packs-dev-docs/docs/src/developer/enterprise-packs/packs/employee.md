# Employee Pack

## 1. Purpose

Provide privacy-preserving employee directory, organizational structure,
onboarding/offboarding metadata, skills, equipment references, and controlled
employee administration.

Odoo Employees centralizes employee records, departments, contracts, learning,
skills, equipment, and onboarding/offboarding features depending on installed
apps and edition.

## 2. Pack boundaries

### Included

- public work directory;
- departments and jobs;
- employment status;
- manager hierarchy;
- work contact data;
- skills and certifications where permitted;
- onboarding and offboarding workflow metadata;
- controlled employee record creation and archive;
- equipment assignment references when supported.

### Optional subpacks

- `employee.contract`
- `employee.skills`
- `employee.learning`
- `employee.equipment`
- `employee.attendance`
- `employee.time_off`

### Excluded from base pack

- payroll;
- compensation;
- bank accounts;
- national identification data;
- medical or protected data;
- biometric data;
- private home information;
- automatic internal-user creation.

## 3. Typical modules

Required:

- `hr`

Optional:

- contracts;
- skills;
- recruitment;
- attendance;
- time off;
- payroll;
- maintenance/equipment;
- learning.

Payroll must be a separate pack because its financial and regulatory risk is
materially higher.

## 4. Primary models

Typical models:

- `hr.employee`
- `hr.department`
- `hr.job`
- `hr.contract`
- `hr.employee.category`
- version-specific skills, resume, learning, and equipment models
- `res.users` only for explicit user-link workflows

## 5. Data profiles

### Public work profile

Default fields:

- employee ID;
- display name;
- work email;
- work phone;
- department;
- job position;
- manager;
- company;
- work location;
- active status.

### HR confidential profile

May include approved employment details. Field allowlist is explicit.

### Sensitive profile

Bank, identification, private address, emergency, compensation, or protected
fields are denied in the base pack.

## 6. Tool catalog

### Directory and organization

- `employee_directory_search`
- `employee_profile_get_public`
- `employee_department_search`
- `employee_department_get`
- `employee_org_chart_get`
- `employee_job_search`
- `employee_manager_chain_get`
- `employee_team_summary`

### Skills and learning

Optional:

- `employee_skill_summary`
- `employee_certification_summary`
- `employee_learning_status`

### Controlled administration

- `employee_create_preview`
- `employee_create`
- `employee_update_work_profile`
- `employee_change_department`
- `employee_change_manager`
- `employee_archive_preview`
- `employee_archive`

### User linking

Separate critical workflow:

- `employee_user_link_preview`
- `employee_user_link`

Default behavior is portal/no internal user. Creating or linking an internal
user requires explicit critical confirmation and licensing warning.

### Workflows

- `employee_onboarding_plan`
- `employee_offboarding_plan`
- `employee_directory_audit`
- `employee_access_review`

## 7. Employee creation

Employee record creation must not automatically:

- create an internal Odoo user;
- grant application access;
- assign payroll structure;
- expose private data;
- trigger broad invitations.

Preview includes:

- company;
- department;
- job;
- manager;
- work contact;
- whether a user will be created;
- expected access/licensing impact;
- onboarding plan.

## 8. Offboarding

Offboarding is not record deletion.

Workflow may include:

- archive employee;
- future end date;
- manager reassignment;
- open task or approval review;
- equipment return checklist;
- user access review;
- active POS or operational access review;
- document ownership review.

Actual user deactivation is a separate controlled step.

## 9. Privacy policies

- public fields only by default;
- purpose-limited access;
- field-level allowlist;
- bulk export limits;
- audit every confidential access;
- no private field in logs;
- no employee data in generic model tools for normal profiles;
- source Odoo record rules remain authoritative.

## 10. Policies

- directory read: R0-R1;
- confidential profile read: R2-R3;
- create/update: R2-R3;
- archive/offboard: R3;
- internal-user creation/link: R4;
- payroll: unavailable in base pack;
- sensitive fields: deny unless separate approved extension.

## 11. Idempotency

- employee create uses external employee key where available;
- update uses state fingerprint;
- department or manager change reconciles current state;
- archive reconciles active status;
- user linking verifies no existing conflicting link.

## 12. Acceptance tests

- public profile never returns private fields;
- employee create does not create user by default;
- user-link preview shows licensing/access impact;
- changed manager invalidates stale confirmation;
- bulk directory limit enforced;
- archive does not delete employee history;
- offboarding plan identifies active system access;
- payroll fields remain unavailable.
