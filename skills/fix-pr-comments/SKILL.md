---
name: fix-pr-comments
description: Fetch PR review comments using the gh-axi CLI, evaluate which are legitimate, and automatically fix the valid ones. Use when asked to fix PR comments, address review feedback, or resolve code review issues. Always works in an isolated, throwaway git worktree by default, resolving the current branch's PR when none is given. Pass --no-worktree (or say "in place"/"on this branch") to fix on the current branch instead. Either way the fix is committed and pushed once, without asking. Pass --unattended (what fix-all-comments does) to never pause for a question: ambiguous comments are skipped and listed instead.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
argument-hint: "[pr-number-or-url] [--no-worktree] [--unattended]"
---

# Fix PR Comments

You are an expert code reviewer assistant. Your job is to:

1. Fetch the unresolved review comments on a PR
2. Evaluate each comment's legitimacy
3. Fix the ones that are clearly valid — skip the ones that are debatable or purely stylistic preference

Resolved threads are settled: never fetch, evaluate, re-fix, or report them.

> Commit and push the fix in **both** modes, without asking. Do not show a "shall I push?" prompt and do not leave the fix sitting in the working tree — review happens on the PR. The bound is **once**: one push per run, no CI poll loop.

## Step 1 — Determine the target PR and mode

`$ARGUMENTS` may be empty, a PR number, or a PR URL - optionally combined with an in-place request (`--no-worktree`, "in place", "on this branch") and/or `--unattended`. **Worktree mode is the default, even with no PR given** - use it unless the user explicitly asks to skip it.

`--unattended` means nobody is watching this run (it is how `fix-all-comments` invokes this skill from a subagent). It changes exactly one thing: Step 4.5 never asks; see there.

`gh-axi` has no "current branch's PR" default - every `pr` subcommand needs an explicit number, so resolve it first when none was given:
```bash
npx gh-axi pr list --head "$(git branch --show-current)" --state open
```
Exactly one open PR should come back. Zero means there is nothing to fix yet; more than one means the head branch is ambiguous - report and ask rather than guessing.

- **In-place requested** (`--no-worktree`, "in place", "on this branch") → fix directly on the current branch (no worktree), then commit and push. Only honor this when the target is the current branch's own PR - a different PR number/URL combined with this flag would mean checking out someone else's branch over the user's working tree, so fall back to worktree mode instead and say why.
- **Otherwise (the default)** → work in an **isolated git worktree**:
  1. Create the worktree (use the **using-git-worktrees** skill / native worktree tooling).
  2. Check the PR out into it: `npx gh-axi pr checkout <pr>`.
  3. Do all the work there. **Remove the worktree when done** (Step 6), after any user questions (Step 4.5) and after committing and pushing (Step 5).

## Step 2 — Fetch PR data

Collect the PR context. `<pr>` is the number resolved in Step 1 - pass it explicitly, including on the no-argument path:

```bash
npx gh-axi pr view <pr> --full
npx gh-axi pr diff <pr> --full
```

**The comment source is the unresolved review threads, fetched with the GraphQL query below.** Thread resolution exists only in the GraphQL API: the REST endpoint (`/pulls/<n>/comments`) and `gh pr view --comments` list every comment ever made with no resolution info, so neither may serve as the comment source — use REST at most to enrich an already-selected unresolved comment with its `diff_hunk`.

```bash
npx gh-axi api POST /graphql --field query="query { repository(owner: \"{owner}\", name: \"{repo}\") { pullRequest(number: <number>) { reviewThreads(first: 100) { nodes { isResolved isOutdated path line comments(first: 20) { nodes { author { login } body createdAt } } } } } } }" \
  --jq '.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)'
```

Raw `gh api graphql` is hook-blocked in this setup, and `gh-axi api graphql` (the subcommand form) does not execute queries; the `api POST /graphql --field query=...` form with the variables inlined is the one that works.

**Second source: unattached review comments.** An AI review bot may post findings it could not anchor to a changed line as a plain PR comment (e.g. one titled "Potential risks"), one `#### [path, line N]`-style block per finding with the same shape as an inline comment. They never appear in `reviewThreads`, so read them too:

```bash
npx gh-axi pr view <pr> --comments --full
```

Take every finding block from every such bot comment. They carry no resolution state, so treat each as open, and rely on Step 3's "outdated" rule to drop the ones already handled: a finding whose referenced lines no longer exist, or already match its proposed shape, is SKIP as outdated. Report them in Step 7 marked `(unattached)`.

If the thread query returns nothing and there is no unattached bot finding, every comment is resolved: report "no unresolved comments" and stop — do not fall back to fetching all comments.

## Step 3 — Evaluate each comment

For each comment from Step 2 (unresolved threads only), classify it:

**FIX** — address immediately:

- Bug reports (logic errors, off-by-one, null safety, race conditions)
- Incorrect behavior or broken contract (wrong return type, missing validation)
- Security issues (injection, exposure, missing auth check)
- Clearly broken or missing tests
- Naming that is objectively wrong or misleading
- Missing required error handling
- Obvious code smell (duplicated logic, unnecessary complexity)
- Correctness issues identified by a failing lint rule

**SKIP** — do not change:

- Pure style preference ("I'd prefer X over Y" with no correctness concern)
- Subjective formatting disputes already handled by linter/prettier
- Questions or clarifications (not actionable requests to change code)
- Outdated comments that refer to code already changed in the PR
- Nitpicks on variable naming that are a matter of taste
- Architecture debates that require broader team discussion
- Out-of-scope suggestions ("while you're here, also refactor...")

When uncertain, lean toward **SKIP** and explain why in your summary.

## Step 4 — Fix legitimate comments

For each **FIX** comment:

1. Read the affected file at the relevant line using the `path` and `line` from the comment
2. Understand the full context (surrounding functions, imports, types)
3. Apply the minimal correct fix — do not refactor surrounding code
4. If a test is needed, add it in the appropriate test file
5. Do not add comments, docstrings, or explanations to the code unless the comment explicitly requests them

After all fixes are applied, run the repo's own check-mode lint, plus the tests affected by the fixes, to ensure nothing broke - take the commands from the repo's `CLAUDE.md` / `AGENTS.md`, never from memory (note which subdirectories are separate packages you must `cd` into). Never a `:fix`/auto-fix variant - an auto-fixer can never fail this gate, and it rewrites files the comments didn't touch.

**Red after the fix is yours to repair.** If lint or a test fails on something the comment fixes touched or exercise, fix it and re-run both targets; loop until lint and the affected tests are green. A failed verification is not a reason to skip the push, it is more work before the push. Two exceptions, and only these two:

- **The red was there before you touched anything.** Confirm it, do not assume it: re-run that same failing target on the PR head as it was before your fixes (`git stash`, run, `git stash pop` - fine in the throwaway worktree, and in place too since the stash is popped straight back). Still red there means it is a pre-existing failure: leave it alone, push your verified fixes anyway, and report it under "Pre-existing failures" with a pointer to `fix-pr-checks`. Fixing old defects is not this skill's job.
- **The repair needs a product decision.** That is a Step 4.5 question, handled by its rules.

## Step 4.5 — Ask the user anything you need to, before the push

If evaluating or fixing comments left anything genuinely ambiguous (a comment that could be read two ways, a fix that requires a product decision, a conflict between two comments), **ask the user now** - before the single permitted push, while the answer can still change the code. This applies in both modes; in worktree mode it also has to happen before Step 6 removes the worktree. Do not defer questions to the final report and then push (or delete the worktree) anyway.

**With `--unattended`, never ask.** Leave the ambiguous comment untouched - do not guess a reading and do not apply a product decision on the user's behalf - push the clear fixes, and list it under "Needs you" in Step 7 with the two readings you saw. One skipped comment in a report costs less than a wrong decision pushed to the PR.

## Step 5 — Commit and push

Commit and push **without asking**, in both modes:

```bash
git add -A
git commit          # subject derived from the fixes applied
git push            # single push — no confirmation prompt, no CI poll loop
```

Push only when Step 4 ended green on lint and the affected tests (a confirmed pre-existing failure does not count against you). If you could not get there, surface that instead of pushing.

## Step 6 — Clean up (worktree mode only)

If a worktree was created in Step 1, **remove it** now (ExitWorktree with removal, or `git worktree remove <path>`). Return to the original working directory.

## Step 7 — Report

At the end, output a clear summary:

```
## PR #<number> — Comment Resolution Summary

### Fixed (<n>)
- [file:line] Comment: "<summary>" → What was changed   (mark unattached findings `(unattached)`)

### Skipped (<n>)
- [file:line] Comment: "<summary>" → Reason skipped

### Needs you (<n>)  ← only if applicable
- [file:line] Comment: "<summary>" → Why it needs human judgment (the readings you saw, in --unattended mode)

### Pre-existing failures (<n>)  ← only if applicable
- <target> → red before this run touched anything; run fix-pr-checks
```

Do not reply to or resolve the GitHub comments themselves — just fix the code. Mention the branch and that the fix was pushed; in worktree mode, note the worktree was cleaned up.
