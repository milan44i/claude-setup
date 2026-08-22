---
name: grill-with-docs
description: Grilling session that challenges your plan against the existing domain model, sharpens terminology, and updates documentation (CONTEXT.md, ADRs) inline as decisions crystallise. Use when user wants to stress-test a plan against their project's language and documented decisions.
disable-model-invocation: true
---

Run a `/grilling` session, using the `/domain-modeling` skill - the copies installed in this repo (or in `~/.claude/skills/`), **not** the `mattpocock-skills:` plugin ones, whose bodies carry none of these overrides and would create a root `CONTEXT.md`.

Where a repo keeps its context docs is repo-specific, and they often do **not** sit next to the code. Read the repo's own agent docs (`AGENTS.md`, `CLAUDE.md`, or a `docs/agents/domain.md`-style pointer) for the layout - typically one context doc per sub-project plus an ADR directory - before creating or updating any `CONTEXT.md`.
