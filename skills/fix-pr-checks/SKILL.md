---
name: fix-pr-checks
description: Fetch a PR's failing GitHub checks and fix the build, unit-test, and lint failures. Use when a PR's CI is red, the build is broken, or tests are failing and you want them fixed. No argument = the current branch's PR (fixed in place); pass a PR number or URL to fix that PR in an isolated, throwaway git worktree.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
argument-hint: [pr-number-or-url]
---

# Fix PR Checks

Fix the failing **build**, **unit-test**, and **lint** checks on a pull request. Reproduce each failing target locally, fix the root cause, verify it's green locally, then push the fix once.

> **Scoped exception.** The standing rule is "never commit or push without an explicit ask." Running `/fix-pr-checks` is that explicit ask — it authorizes a **single** push of the fix, for this run only. It does **not** loop on CI or push repeatedly.

## Step 1 — Determine the target PR and mode

`$ARGUMENTS` may be empty, a PR number, or a PR URL.

- **No argument** → the current branch's PR. **Fix in place** on the current branch (no worktree).
  ```bash
  gh pr view --json number,headRefName,url
  ```
- **PR number or URL given** → work in an **isolated git worktree**:
  1. Create the worktree (use the **using-git-worktrees** skill / native worktree tooling).
  2. Check the PR out into it: `gh pr checkout <pr>`.
  3. Do all the work there. **Remove the worktree when done** (Step 6).

## Step 2 — Find the failing checks

```bash
gh pr checks <pr>                          # list checks; note the failed ones
gh run view <run-id> --log-failed          # failing logs for a red run
```

Classify each failure:

**FIX** (reproduce and fix locally):
- **Build** — TypeScript / `nest build` / portal `vite build` compile errors.
- **Unit tests** — root (`pnpm test`) or portal (`npm run test:unit`).
- **Lint** — ESLint / Prettier (`pnpm run lint:fix`, portal `npm run lint`).

**REPORT only** (do not attempt to fix):
- **Integration tests** (`apps_it`) — need `.env.mock` + live services; not reliably reproducible locally.
- **Domain linters** — swagger, k8s, event-schema, db-migration-guard, etc.
- **Flaky / infra / timeout** failures unrelated to the diff.

## Step 3 — Reproduce the failing target locally

Run **only the failing target**, not the whole suite (the monorepo is large):

- Build: build just the failing app/package.
- Unit test: the specific failing test file or package — e.g. `npm run test:unit -- <file>` (portal), `pnpm test <path>` (root).
- Lint: `pnpm run lint:fix` (root) or `npm run lint` (portal).

Confirm you can see the same failure locally before changing anything.

## Step 4 — Fix and verify

Fix the root cause with the minimal correct change. Re-run **that same target** and confirm it is green locally. Do not refactor unrelated code.

## Step 5 — Commit and push (once)

```bash
git add -A
git commit          # subject derived from the fix
git push            # single push — no confirmation, no CI poll loop
```

## Step 6 — Clean up (worktree mode only)

If a worktree was created in Step 1, **remove it** now (ExitWorktree with removal, or `git worktree remove <path>`). Return to the original working directory.

## Step 7 — Report

Summarize:
- Which checks were red, and the root cause of each.
- What was fixed and verified locally, and the single push made.
- Which failures were **left for you** (integration / domain-linter / flaky) and why.

CI will re-run on the push. If a *different* check then fails, re-invoke this skill.
