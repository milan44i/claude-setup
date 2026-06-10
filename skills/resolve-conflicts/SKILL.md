---
name: resolve-conflicts
description: Merge the latest default branch into the current branch and resolve the conflicts. Use when a branch has merge conflicts after the base branch moved, or when asked to resolve conflicts or update a branch with master/main. Auto-resolves clear conflicts, asks on ambiguous ones, stops before push.
allowed-tools: Bash, Read, Edit, Grep, Glob
---

# Resolve Conflicts

Bring the current branch up to date with the repo's default branch and resolve the resulting conflicts. This skill **merges — it never rebases**. **Stop before pushing.**

## Step 1 — Merge the latest default branch

```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$BASE" ] || BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git fetch origin
git merge "origin/$BASE"
```

## Step 2 — Resolve

For each conflicted file:

- **Clear / unambiguous** (non-overlapping additions, obvious formatting, independent intent on each side): resolve automatically, keeping both sides' intent correct.
- **Ambiguous** (overlapping logic changes, semantic conflicts, unclear which side should win): **stop and ask the user**, showing the conflicting hunks and your recommendation. Do not guess.

Never blindly accept one side. Read enough surrounding context to resolve correctly.

## Step 3 — Verify

After all conflicts are resolved and staged, run lint and the tests affected by the merged + conflicted files, using the repo's own scripts (`package.json` scripts plus the lockfile, a `Makefile`, or the equivalent for the repo's language; in a monorepo, run them from the affected packages).

Report results. If tests fail because of the merge, fix them or surface them.

## Step 4 — Commit the merge locally

```bash
git add -A
git commit --no-edit     # keep the default merge commit message
```

## Step 5 — Stop

Summarize the conflicts resolved (and any you asked about). **Do not push.** Tell the user to review; they can then push or run `/create-pr`.
