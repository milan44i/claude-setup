---
name: create-pr
description: Create a GitHub pull request following ts-polaris conventions — commit, push, and open the PR end to end. Use when asked to "create a PR", "open a PR", "make a draft PR", or "create a no-jira PR" for the current changes.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue
argument-hint: [--draft] [no-jira]
---

# Create PR

Create a pull request for the current changes, end to end: **stage → commit → push → open the PR**. Invoking this skill **is** the authorization to commit and push — proceed without a second confirmation.

> **Scoped exception.** The standing rule is "never commit or push without an explicit ask." Running `/create-pr` is that explicit ask, **for this run only**. Do not carry the authorization to any later action in the session.

## Arguments

`$ARGUMENTS` may contain:

- `--draft` — open the PR as a draft (`gh pr create --draft`).
- `no-jira` — force a no-ticket PR (title prefix `[no jira]`, skip the Jira lookup).

## Step 1 — Determine the branch and ticket

```bash
git branch --show-current
```

- **On `master`**: this work needs its own branch. Determine the ticket id (from `$ARGUMENTS`, the conversation, or ask the user), then create the branch with the **lowercased** id:
  ```bash
  git checkout -b <ticketId>     # e.g. datap-5585, mfe-7799
  ```
- **Already on a branch**: use it as-is. Derive the ticket id from the branch name, **uppercased** (`datap-5585` → `DATAP-5585`).
- If `no-jira` is set, or no ticket id can be determined, treat this as a no-jira PR.

## Step 2 — Fetch the ticket title (skip for no-jira)

Fetch the ticket summary via the Atlassian MCP (`getJiraIssue`, field `summary`).

**Strip any leading bracketed prefix** from the summary (e.g. `[Portal] `, `[BE] `).

Title rule (**hard requirement**):

```
[<TICKET-ID>] <ticket summary, leading [..] prefix stripped>
```

Example: ticket `DATAP-5755` titled *"[Portal] Add Publish action (update flow) to Job Configuration Export dialog"* →
`[DATAP-5755] Add Publish action (update flow) to Job Configuration Export dialog`.

For a **no-jira** PR, the title is `[no jira] <concise title derived from the diff>`.

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

Build the body from `.github/PULL_REQUEST_TEMPLATE.md` **verbatim** — keep every heading and checklist. Then fill what you can from the diff and ticket:

- **The first line of the body must be the ticket in brackets**: `[<TICKET-ID>]` (or `[no jira]`).
- Fill **Rationale** and **Main code changes to review** from the diff/ticket; tick the relevant **test** checklist items.
- Leave **Monitoring** / **Affected services** as template placeholders unless you have concrete info.
- **No files-changed list** — reviewers see the diff natively.

```bash
gh pr create --base master --title "<title>" --body "<body>" [--draft]
```

## Step 6 — Report

Print the PR URL and the title used. Done — do not resolve comments or take any further action.
