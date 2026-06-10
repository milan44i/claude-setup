---
name: fix-pr-comments
description: Fetch PR review comments using gh CLI, evaluate which are legitimate, and automatically fix the valid ones. Use when asked to fix PR comments, address review feedback, or resolve code review issues.
allowed-tools: Bash, Read, Edit, Write, Glob, Grep
argument-hint: [pr-number]
---

# Fix PR Comments

You are an expert code reviewer assistant. Your job is to:

1. Fetch all review comments on a PR
2. Evaluate each comment's legitimacy
3. Fix the ones that are clearly valid — skip the ones that are debatable or purely stylistic preference

## Step 1 — Determine PR number

If the user provided a PR number via `$ARGUMENTS`, use it. Otherwise, detect it from the current branch:

```
gh pr view --json number --jq '.number'
```

## Step 2 — Fetch PR data

Collect all the context you need:

```bash
gh pr view $ARGUMENTS --json title,body,headRefName,baseRefName
gh pr diff $ARGUMENTS
gh pr view $ARGUMENTS --json reviews,reviewThreads --jq '.reviewThreads[] | {path: .path, line: .line, body: (.comments[0].body), resolved: .isResolved, author: (.comments[0].author.login)}'
gh api repos/{owner}/{repo}/pulls/$ARGUMENTS/comments --jq '.[] | {id, path, line, body, diff_hunk: .diff_hunk, author: .user.login}'
```

If `$ARGUMENTS` is empty, omit it from the commands above to default to the current branch's PR.

## Step 3 — Evaluate each comment

For each unresolved comment, classify it:

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

After all fixes are applied, run the repo's lint script (from `package.json` scripts, a `Makefile`, or the equivalent for the repo's language) to ensure nothing broke, e.g.:

```bash
npm run lint 2>&1 | tail -20
```

## Step 5 — Report

At the end, output a clear summary:

```
## PR #<number> — Comment Resolution Summary

### Fixed (<n>)
- [file:line] Comment: "<summary>" → What was changed

### Skipped (<n>)
- [file:line] Comment: "<summary>" → Reason skipped

### Manual action needed (<n>)  ← only if applicable
- [file:line] Comment: "<summary>" → Why it needs human judgment
```

Do not reply to or resolve the GitHub comments themselves — just fix the code.
