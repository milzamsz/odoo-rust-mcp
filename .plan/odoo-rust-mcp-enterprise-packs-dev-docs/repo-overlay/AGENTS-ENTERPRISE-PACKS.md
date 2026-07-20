# Enterprise Packs Agent Instructions

This file supplements the repository's canonical `AGENTS.md`.

Before touching Enterprise Packs, read:

- `docs/src/developer/enterprise-packs/index.md`
- `architecture.md`
- `tool-pack-framework.md`
- `policy-security.md`
- the target pack specification.

Mandatory rules:

- inspect implementation before assuming the docs are already implemented;
- do not bypass Odoo ORM or standard lifecycle actions;
- no arbitrary method execution in production profiles;
- no broad refactors mixed with pack implementation;
- verify Odoo version compatibility;
- add capability requirements, policy, tests, docs, migration, and rollback;
- block unresolved accounting, stock, POS, publication, privacy, or user-access
  decisions.
