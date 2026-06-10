---
name: ticket-code-consistency
description: Update a ticket's description (Jira or GitHub issue) to match what the code on the current branch actually does. Use when asked to make the ticket match the code, sync a ticket description with the changes, or fix ticket/code inconsistencies. Edits the ticket directly.
allowed-tools: Bash, Read, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__editJiraIssue
argument-hint: [TICKET-ID]
---

# Ticket / Code Consistency

Reconcile a ticket's description with the **delivered code**, and update the ticket so it accurately describes what was built. The direction is always **code → ticket**.

## Step 1 — Determine the ticket

Use the ticket reference from `$ARGUMENTS` if provided. Otherwise derive it from the current branch name (`abc-123` → `ABC-123`). Pick the tracker that fits: a Jira-shaped ID with the Atlassian MCP connected → Jira; a GitHub issue ref → `gh issue`. If neither resolves, ask the user.

## Step 2 — Gather the delivered changes

```bash
BASE=$(git symbolic-ref --short refs/remotes/origin/HEAD 2>/dev/null | sed 's|^origin/||')
[ -n "$BASE" ] || BASE=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
git diff "$BASE"...HEAD --stat
git diff "$BASE"...HEAD
```

Understand what the branch actually changes — behavior, APIs, scope, edge cases.

## Step 3 — Compare with the ticket

Fetch the current description (`getJiraIssue` with fields `summary,description`, or `gh issue view <ref> --json title,body`). Identify where the description and the code diverge:

- Scope described but not implemented.
- Behavior implemented but not described, or described differently.
- Acceptance criteria that no longer match the delivered code.

## Step 4 — Update the ticket (auto, no confirmation)

Produce an updated description that matches the delivered code:

- **Preserve** the parts of the original description that are still accurate (intent, context, rationale).
- **Rewrite** the parts that diverge so they describe what the code does.

Apply it directly (`editJiraIssue`, or `gh issue edit <ref> --body` for GitHub issues). **No confirmation step** — this skill edits the ticket autonomously.

## Step 5 — Report

Summarize what you changed in the description and why, and link the ticket.
