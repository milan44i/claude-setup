---
name: implement-ticket
description: Implement a Jira ticket from its description on a branch named after the ticket. Use when asked to "implement <TICKET-ID>", build a ticket, or work a ticket. Pass --worktree to isolate the work in a git worktree. Stops before opening a PR.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue
argument-hint: <TICKET-ID> [--worktree]
---

# Implement Ticket

Implement a ticket from its description, on a branch named after the ticket. **Stop before opening a PR** — the user reviews, then runs `/create-pr`.

This skill does **not** grill or plan for you — the user does that beforehand (e.g. with `grill-with-docs`). Take the ticket description as the spec.

## Step 1 — Read the ticket

`$ARGUMENTS` contains the `<TICKET-ID>` (e.g. `DATAP-5585`). Fetch it via the Atlassian MCP (`getJiraIssue`, fields `summary,description`). Treat the description as the source of truth for what to build.

If the description is ambiguous or underspecified, **ask before coding** rather than guessing.

## Step 2 — Set up the workspace

**Default (no `--worktree`):**

```bash
git checkout master && git pull     # merge, not rebase (repo convention)
git checkout -b <ticketId>          # lowercased: datap-5585, mfe-7799
```

**With `--worktree`:** invoke the **using-git-worktrees** skill to create an isolated worktree on branch `<ticketId>`, then work there.

## Step 3 — Implement

Implement the change described by the ticket, following the conventions of the area you're touching. The repo's scoped rules under `.claude/rules/` and any matching skill apply — e.g. `develop-customer-care` for CCS work, `check-migration-consistency` for `__new__` → `unified` migration.

Make the minimal correct change. Ask when uncertain.

## Step 4 — Verify

Run lint and the **affected** tests (not the whole suite unless the change is broad):

- `portal/` → `npm run test:unit`, lint via `npm run lint`
- root (apps/libs) → `pnpm test`, lint via `pnpm run lint:fix`

Report results.

## Step 5 — Stop

Summarize what changed and which tests ran. **Do not commit, push, or open a PR.** Tell the user to review and run `/create-pr` when ready.
