---
name: create-pr
description: Create a GitHub pull request following the repo's conventions — commit, push, and open the PR end to end. Use when asked to "create a PR", "open a PR", "make a draft PR", or "create a no-ticket PR" for the current changes.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue
argument-hint: [--draft] [no-ticket]
---

# Create PR

Create a pull request for the current changes, end to end: **stage → commit → push → open the PR**. Invoking this skill **is** the authorization to commit and push — proceed without a second confirmation.

> **Scoped exception.** The standing rule is "never commit or push without an explicit ask." Running `/create-pr` is that explicit ask, **for this run only**. Do not carry the authorization to any later action in the session.

## Arguments

`$ARGUMENTS` may contain:

- `--draft` — open the PR as a draft (`gh pr create --draft`).
- `no-ticket` — force a ticketless PR (title prefix `[no ticket]`, skip the tracker lookup).

## Step 1 — Determine the branch and ticket

Resolve the repo's default branch, then check where you are:

```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$BASE" ] || BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git branch --show-current
```

- **On the default branch**: this work needs its own branch. Determine the ticket id (from `$ARGUMENTS`, the conversation, or ask the user), then create the branch with the **lowercased** id:
  ```bash
  git checkout -b <ticketId>     # e.g. abc-123
  ```
- **Already on a branch**: use it as-is. Derive the ticket id from the branch name, **uppercased** (`abc-123` → `ABC-123`).
- If `no-ticket` is set, or no ticket id can be determined, treat this as a no-ticket PR.

## Step 2 — Fetch the ticket title and infer the title convention (skip fetch for no-ticket)

Fetch the ticket summary from whichever tracker fits:

- **Jira-shaped ID** and the Atlassian MCP is connected → `getJiraIssue`, field `summary`.
- **GitHub issue ref** → `gh issue view <ref> --json title`.
- **Neither works** → derive a concise title from the diff and treat the PR as no-ticket.

**Mirror the repo's existing title convention** — check recent merged PRs:

```bash
gh pr list --state merged --limit 10 --json title -q '.[].title'
```

Follow the pattern they show (prefix style, ticket placement). When no clear pattern emerges, default to:

```
[<TICKET-ID>] <ticket summary, leading [..] prefix stripped>
```

(Strip any leading bracketed prefix the tracker summary carries, e.g. `[Portal] `, `[BE] `.)

For a **no-ticket** PR, the title is `[no ticket] <concise title derived from the diff>` — or whatever the repo's history shows for ticketless PRs.

## Step 3 — Commit

Stage everything and commit. The **commit subject is derived from the diff** (what actually changed), not from the ticket title.

```bash
git add -A
git diff --cached --stat
```

Write a concise, conventional commit subject summarizing the diff. **Do not** add any AI attribution or "Generated with…" trailer.

## Step 4 — Push

```bash
git push -u origin <branch>
```

## Step 5 — Open the PR

If the repo has a `.github/PULL_REQUEST_TEMPLATE.md`, build the body from it **verbatim** — keep every heading and checklist, fill what you can from the diff and ticket, and write "N/A" rather than deleting sections. Without a template, write a short body: what changed and why, plus how it was verified.

- **Start the body with the ticket reference** (`[<TICKET-ID>]` or a `Closes #123` line for GitHub issues), unless the repo's merged PRs show a different convention.
- **No files-changed list** — reviewers see the diff natively.

```bash
gh pr create --base "$BASE" --title "<title>" --body "<body>" [--draft]
```

## Step 6 — Report

Print the PR URL and the title used. Done — do not resolve comments or take any further action.
