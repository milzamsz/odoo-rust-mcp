# Agent Development Guide

## 1. Mandatory reading order

Before implementation:

1. existing repository `AGENTS.md`;
2. existing `TECHNICAL.md`;
3. this Enterprise Packs index;
4. Architecture;
5. Tool Pack Framework;
6. Policy and Security;
7. target pack specification;
8. relevant ADRs.

## 2. Source of truth

Inspect code and checked-in configuration before editing. These documents are a
target design, not evidence that code already implements it.

## 3. Change discipline

- do not perform broad refactors while adding a pack;
- move existing behavior before rewriting it;
- one architectural concern per pull request;
- one pack or subprofile per implementation task;
- preserve backward compatibility unless a migration is included;
- no speculative infrastructure.

## 4. Required implementation sequence

For a new pack:

1. define operation keys;
2. define capability requirements;
3. define risk and data classification;
4. define schemas;
5. implement compatibility adapter;
6. implement read tools;
7. implement policies;
8. implement command tools;
9. implement workflows;
10. add Config UI;
11. add fixtures and tests;
12. update docs.

## 5. Prohibited shortcuts

- direct database writes;
- arbitrary Odoo method exposure in production profile;
- direct field write to imitate standard lifecycle action;
- hard-coded credentials;
- unbounded search;
- outputting all fields by default;
- swallowing Odoo errors;
- retrying uncertain mutations blindly;
- assuming Enterprise internal models are stable;
- creating internal users as a side effect of employee creation.

## 6. Completion evidence

A task is complete only with:

- code;
- tests;
- documentation;
- compatibility note;
- security note;
- migration or explicit statement that none is needed;
- rollback note;
- command output showing validation.

## 7. Review checklist

Review separately:

- bugs;
- security;
- architecture;
- compatibility;
- Odoo functional correctness;
- tests;
- docs.

Do not hide feature work inside cleanup commits. Humanity has suffered enough
from “small refactor” pull requests containing half a product rewrite.
