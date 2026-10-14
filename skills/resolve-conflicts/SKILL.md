---
name: resolve-conflicts
description: Merge the latest master into a branch and resolve the conflicts. Use when a branch has merge conflicts after master moved, or when asked to resolve conflicts or update a branch with master. No argument = the current branch, resolved in place; pass a PR number, PR URL, or branch name to resolve that branch in an isolated git worktree. Auto-resolves clear conflicts, asks on ambiguous ones, then commits and pushes the merge.
allowed-tools: Bash, Read, Edit, Grep, Glob
argument-hint: "[pr-number-or-url-or-branch]"
---

# Resolve Conflicts

Bring a branch up to date with `master` and resolve the resulting conflicts. **Merge, not rebase** (repo convention). The final push happens without asking, as everywhere else in this setup; only failing verification stops it.

**Always resolve. Never `git merge --abort`.** Backing out leaves the branch exactly as stuck as it was.

## Step 1 — Determine the target branch and mode

`$ARGUMENTS` may be empty, a PR number, a PR URL, or a branch name.

- **No argument** → the **current branch**, resolved **in place** (no worktree).
  - **If the current branch is `master`** (or `main`): do **not** proceed. There is nothing to merge into. **Stop and ask the user which PR** (or branch) to resolve, then re-run with that as the argument.
- **Argument given** (PR number, PR URL, or branch name) → work in an **isolated git worktree** so the current workspace is untouched:
  1. Create the worktree (use the **using-git-worktrees** skill / native worktree tooling).
  2. Check the target out into it:
     - PR number or URL → `npx gh-axi pr checkout <pr>` (raw `gh pr checkout <pr>` as fallback)
     - branch name → check out / track that branch in the worktree
  3. Do all the work there. **Remove the worktree when done** (Step 7).

All remaining steps run in the target's working directory (the current dir for in-place mode, the worktree for argument mode).

## Step 2 — Merge latest master

```bash
git fetch origin
git merge origin/master
```

## Step 3 — Recover the intent behind each side

A conflict is two changes that disagree. You cannot resolve it correctly from the hunk alone — the hunk shows *what* each side did, never *why*. Before touching a single conflicted file, find the primary source for each side:

```bash
git log --merge -p -- <file>              # the commits from both sides that touch this file
git log --format='%h %an %s' -1 <sha>     # the commit subject/body for one side
```

For each conflicted file, work out:

- **The commit** that introduced each side, and what its message claims it was doing.
- **The PR** that carried it — `npx gh-axi search prs "<sha>"` (or raw `gh pr list --search <sha>` as fallback; gh-axi's `pr list` has no `--search` flag), then read its description and review discussion.
- **The ticket** the PR references (`[ABC-123]` in the title, or a Jira link in the body) — fetch it when the PR description is thin. The ticket carries the requirement; the diff only carries one implementation of it.

Skip the archaeology only for conflicts that are provably mechanical: import ordering, lockfile regeneration, formatter churn, generated files.

## Step 4 — Resolve

For each conflicted file, resolve toward the two intents you just recovered, not toward the text:

- **Both intents survivable** → keep both. This is the common case and includes most "overlapping" hunks: the two changes usually want different things from the same lines.
- **Genuinely incompatible** → keep the one that matches the stated goal of this merge (normally: `master` is the new baseline, the branch's own feature is what you are preserving), and note the trade-off in the summary so the discarded intent is not lost silently.
- **Still unclear after reading the commits, PRs, and tickets** → **stop and ask the user**, showing the hunks, what each side was trying to do, and your recommendation.

Never blindly accept one side, and never invent behaviour that was on neither side. A resolution that compiles but drops one side's requirement is a worse outcome than asking.

## Step 5 — Verify

After all conflicts are resolved and staged, run lint and the tests affected by the merged + conflicted files, using the repo's own commands — take them from the repo's `CLAUDE.md` / `AGENTS.md`, never from memory (note which subdirectories are separate packages you must `cd` into). If nothing is documented, infer from the build files (`package.json` scripts, `build.sbt`, `Makefile`). Use check-mode lint, never a `:fix` variant — an auto-fixer can never fail the gate.

Report results. If tests fail because of the merge, fix them or surface them.

## Step 6 — Commit the merge locally

```bash
git add -A
git commit --no-edit     # keep the default merge commit message
```

## Step 7 — Push

Push the merge to the branch's remote:

```bash
git push
```

Only push if Step 5 verification passed. If lint or tests failed because of the merge and you couldn't fix them, **stop and surface the failures instead of pushing.**

## Step 8 — Clean up (worktree mode only)

If a worktree was created in Step 1, **remove it** now (ExitWorktree with removal, or `git worktree remove <path>`). Return to the original working directory.

## Step 9 — Summarize

Summarize the conflicts resolved, the intent recovered for each side, any trade-off where one intent had to be dropped, and any conflict you asked about. Confirm the merge was pushed. In worktree mode, note which branch was updated and that the worktree was cleaned up.
