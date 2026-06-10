---
name: implement-ticket
description: Implement a ticket (Jira or GitHub issue) from its description on a branch named after the ticket. Use when asked to "implement <TICKET-ID>", build a ticket, or work a ticket. Pass --worktree to isolate the work in a git worktree. Stops before opening a PR.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue
argument-hint: <TICKET-ID> [--worktree]
---

# Implement Ticket

Implement a ticket from its description, on a branch named after the ticket. **Stop before opening a PR** — the user reviews, then runs `/create-pr`.

This skill does **not** grill or plan for you — the user does that beforehand (e.g. with `grill-with-docs`). Take the ticket description as the spec.

## Step 1 — Read the ticket

`$ARGUMENTS` contains the ticket reference. Fetch it from whichever tracker fits:

- **Jira-shaped ID** (e.g. `ABC-123`) and the Atlassian MCP is connected → `getJiraIssue` (fields `summary,description`).
- **GitHub issue** (e.g. `#123` or an issue URL) → `gh issue view <ref> --json title,body`.
- **Neither works** → ask the user to paste the ticket description.

Treat the description as the source of truth for what to build. If it is ambiguous or underspecified, **ask before coding** rather than guessing.

## Step 2 — Set up the workspace

Resolve the repo's default branch first:

```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$BASE" ] || BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
```

Name the branch after the ticket, **mirroring the repo's existing branch-naming convention** (`git for-each-ref refs/remotes/origin --sort=-committerdate --format='%(refname:short)' | head -15`). When no clear pattern emerges, default to the bare lowercased ticket id (`abc-123`).

**Default (no `--worktree`):**

```bash
git checkout "$BASE" && git pull
git checkout -b <branch>            # e.g. abc-123, or feature/abc-123-… if that's the repo's pattern
```

**With `--worktree`:** invoke the **using-git-worktrees** skill to create an isolated worktree on that branch, then work there.

## Step 3 — Implement

Implement the change described by the ticket, following the conventions of the area you're touching. If the repo has scoped rules (e.g. under `.claude/rules/`) or skills that match the area, apply them.

Make the minimal correct change. Ask when uncertain.

## Step 4 — Verify

Run lint and the **affected** tests (not the whole suite unless the change is broad). Use the repo's own scripts — check `package.json` scripts plus the lockfile (pnpm/npm/yarn/bun), a `Makefile`, or the equivalent for the repo's language; in a monorepo, run them from the package you touched.

Report results.

## Step 5 — Stop

Summarize what changed and which tests ran. **Do not commit, push, or open a PR.** Tell the user to review and run `/create-pr` when ready.
