---
name: ticket-code-consistency
description: Update a Jira ticket's description to match what the code on the current branch actually does. Use when asked to make the ticket match the code, sync a ticket description with the changes, or fix ticket/code inconsistencies. Edits the Jira ticket directly.
allowed-tools: Bash, Read, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__editJiraIssue
argument-hint: [TICKET-ID]
---

# Ticket / Code Consistency

Reconcile a Jira ticket's description with the **delivered code**, and update the ticket so it accurately describes what was built. The direction is always **code → ticket**.

## Step 1 — Determine the ticket

Use `<TICKET-ID>` from `$ARGUMENTS` if provided. Otherwise derive it from the current branch name (`datap-5585` → `DATAP-5585`).

## Step 2 — Gather the delivered changes

```bash
git diff master...HEAD --stat
git diff master...HEAD
```

Understand what the branch actually changes — behavior, APIs, scope, edge cases.

## Step 3 — Compare with the ticket

Fetch the current description via `getJiraIssue` (fields `summary,description`). Identify where the description and the code diverge:

- Scope described but not implemented.
- Behavior implemented but not described, or described differently.
- Acceptance criteria that no longer match the delivered code.

## Step 4 — Update the ticket (auto, no confirmation)

Produce an updated description that matches the delivered code:

- **Preserve** the parts of the original description that are still accurate (intent, context, rationale).
- **Rewrite** the parts that diverge so they describe what the code does.

Apply it directly with `editJiraIssue`. **No confirmation step** — this skill edits the ticket autonomously.

## Step 5 — Report

Summarize what you changed in the description and why, and link the ticket.
