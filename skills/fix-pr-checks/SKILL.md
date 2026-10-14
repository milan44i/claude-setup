---
name: fix-pr-checks
description: Fetch a PR's failing GitHub checks and fix the build, unit-test, and lint failures. Use when a PR's CI is red, the build is broken, or tests are failing and you want them fixed. No argument = the current branch's PR (fixed in place); pass a PR number or URL to fix that PR in an isolated, throwaway git worktree. Add --worktree (or say "in worktree") to force worktree isolation for the current branch's PR too.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob
argument-hint: "[pr-number-or-url] [--worktree]"
---

# Fix PR Checks

Fix the failing **build**, **unit-test**, and **lint** checks on a pull request. Reproduce each failing target locally, fix the root cause, verify it's green locally, then push the fix once.

GitHub calls go through `npx gh-axi` first (token-efficient output); raw `gh` is the fallback when a gh-axi call fails or lacks the flag you need.

> Push the fix without asking — committing and pushing is the default across this setup. The bound here is **once**: one push per run. Do **not** loop on CI or push repeatedly.

## Step 1 — Determine the target PR and mode

`$ARGUMENTS` may be empty, a PR number, or a PR URL — optionally combined with a worktree request (`--worktree`, "in worktree", "in a worktree").

- **No argument** → the current branch's PR. **Fix in place** on the current branch (no worktree).
  ```bash
  npx gh-axi pr list --head "$(git branch --show-current)"   # the current branch's PR number
  ```
- **No PR given but worktree requested** (e.g. `/fix-pr-checks --worktree` or "fix-pr-checks in worktree") → the current branch's PR, but **work in an isolated git worktree** (same steps as below) instead of fixing in place.
- **PR number or URL given** → work in an **isolated git worktree**:
  1. Create the worktree (use the **using-git-worktrees** skill / native worktree tooling).
  2. Check the PR out into it: `npx gh-axi pr checkout <pr>`.
  3. Do all the work there. **Remove the worktree when done** (Step 6).

## Step 2 — Find the failing checks

```bash
npx gh-axi pr checks <pr>                  # list checks; note the failed ones
npx gh-axi run view <run-id>               # a red run's details; `gh run view <run-id> --log-failed` for full failing logs
```

Classify each failure:

**FIX** (reproduce and fix locally):
- **Build** — compile and type-check errors.
- **Unit tests** — the repo's unit-test suite.
- **Lint** — the repo's lint check.

**REPORT only** (do not attempt to fix):
- **Integration / e2e tests** — need env files, secrets or live services; not reliably reproducible locally.
- **Domain linters** — API-spec, k8s manifest, event-schema, migration guards and other org-specific checks.
- **Flaky / infra / timeout** failures unrelated to the diff.

Rule of thumb: if a clean checkout plus the repo's own scripts can't reproduce it, report it.

## Step 3 — Reproduce the failing target locally

Run **only the failing target**, not the whole suite. Take the exact commands from the repo's `CLAUDE.md` / `AGENTS.md` or the failing job's log, never from memory (note which subdirectories are separate packages you must `cd` into). If nothing is documented, infer from the build files (`package.json` scripts plus the lockfile, `build.sbt`, `Makefile`).

- Build: build just the failing app/package.
- Unit test: the specific failing test file or package.
- Lint: the repo's **check-mode** lint, scoped to the failing area where supported. An auto-fix variant is fine as a repair step, but never as the green/red gate — an auto-fixer can never fail, so it cannot confirm the check passes; re-run check mode after fixing.

Confirm you can see the same failure locally before changing anything.

## Step 4 — Fix and iterate until all green

Fix the root cause with the minimal correct change. Do not refactor unrelated code.

Then **loop until build, unit tests, and lint all pass locally**:

1. Re-run the target you just fixed — confirm it is green.
2. Re-run the **other two** FIX targets (scoped to the affected apps/packages) — a fix for one can break another (e.g. a test fix that introduces a lint error, a type fix that breaks the build).
3. If anything is still red, fix it and repeat from 1.

Do **not** proceed to Step 5 while any of build / unit tests / lint is failing locally. There is no iteration cap — keep going until all three are green. Only stop early if a failure is genuinely outside the FIX scope (see REPORT-only classes in Step 2) or unfixable without a product decision; in that case, stop and report instead of pushing a half-fix.

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
