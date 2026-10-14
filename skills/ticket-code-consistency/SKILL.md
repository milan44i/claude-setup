---
name: ticket-code-consistency
description: Update a Jira ticket's description (and the open PR's description) to match what the code on the current branch actually does. Use when asked to make the ticket match the code, sync a ticket or PR description with the changes, or fix ticket/code inconsistencies. Edits the Jira ticket and PR directly.
allowed-tools: Bash, Read, Grep, Glob, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__editJiraIssue
argument-hint: "[TICKET-ID]"
---

# Ticket / Code Consistency

Reconcile the **description of the work** with the **delivered code**, so it accurately describes what was built. The direction is always **code → description**. There are two descriptions to keep in sync:

1. The **Jira ticket** description.
2. The **open PR** description for the current branch (if one exists).

## Step 1 — Determine the ticket

Use `<TICKET-ID>` from `$ARGUMENTS` if provided. Otherwise derive it from the current branch name (`abc-123` → `ABC-123`).

## Step 2 — Gather the delivered changes

```bash
git diff master...HEAD --stat
git diff master...HEAD
```

Understand what the branch actually changes — behavior, APIs, scope, edge cases. This is the single source of truth for both descriptions.

## Step 3 — Sync the Jira ticket

Fetch the current description via `getJiraIssue` (fields `summary,description`). Identify where it diverges from the code:

- Scope described but not implemented.
- Behavior implemented but not described, or described differently.
- Acceptance criteria that no longer match the delivered code.

Produce an updated description that matches the delivered code:

- **Preserve** the parts of the original that are still accurate (intent, context, rationale).
- **Rewrite** the parts that diverge so they describe what the code does.

Apply it directly with `editJiraIssue`. **No confirmation step** — this skill edits the ticket autonomously.

## Step 4 — Sync the PR description

Find the open PR for the current branch and read its current body, `gh-axi` first (token-efficient output):

```bash
npx gh-axi pr view --full     # number, title, and the body; --full lifts the default truncation
```

Only if `gh-axi` is unavailable or the call itself fails, fall back to `gh pr view --json number,title,body`.

If there is **no PR** for the branch, skip this step and say so in the report.

If a PR exists, compare its body against the delivered code the same way as Step 3. Only rewrite if the description is **stale** — i.e. it describes scope/behavior that no longer matches the diff. If the PR body already matches the code, leave it untouched.

When rewriting, keep the PR conventions intact:

- First line is the ticket number in square brackets (e.g. `[ABC-123]`).
- Keep every heading and checklist from `.github/PULL_REQUEST_TEMPLATE.md` — update the content under them, don't drop sections.
- No files-changed list (reviewers see the diff natively).
- No "Generated with Claude Code" attribution.
- Preserve still-accurate context and rationale; only rewrite what diverges.

Apply it directly (this updates only the PR description, not the code — no push):

```bash
BODY=$(mktemp /tmp/pr-body.XXXXXX.md)   # unique file - a fixed path could publish another run's body
cat > "$BODY" <<'EOF'
<updated body>
EOF
npx gh-axi pr edit --body-file "$BODY" && rm -f "$BODY"
```

Same fallback rule: only on a `gh-axi` failure, use `gh pr edit --body-file "$BODY"`.

**No confirmation step** — like the ticket, the PR description is updated autonomously.

## Step 5 — Report

Summarize what you changed in each description and why. State explicitly when one was already in sync (left untouched) or when no PR exists. Link the ticket and the PR.
