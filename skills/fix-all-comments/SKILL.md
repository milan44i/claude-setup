---
name: fix-all-comments
description: Run fix-pr-comments across every open PR of yours (drafts included) in the repos you list in the skill, in parallel, one isolated worktree per PR that has unresolved review threads. Fully unattended - never asks mid-run - and ends with one consolidated report. Use when asked to fix all PR comments, address review feedback everywhere, or clear the review backlog.
allowed-tools: Bash, Read, Agent
argument-hint: ""
---

# Fix All Comments

`fix-pr-comments` fixes one PR. This skill finds every PR of yours that has something to fix and runs `fix-pr-comments` on each, at the same time, then hands you one report. It orchestrates; it never edits code itself.

Takes no arguments. Never asks a question mid-run - an ambiguous comment ends up in the report, not in a prompt.

## Vocabulary

- **Open PR** - a PR authored by you, state open, in one of the `REPOS` listed in Step 1. Draft or ready makes no difference; both count.
- **Actionable PR** - an open PR with at least one **unresolved** review thread or an unattached review-bot finding. Only actionable PRs get a worktree and a subagent.

The repo list is hardcoded on purpose: name the repos your team's PRs live in, and leave out the ones with a different review culture.

## Step 1 - List the open PRs

```bash
REPOS="<owner>/<repo-a> <owner>/<repo-b>"   # your repos
for r in $REPOS; do
  npx gh-axi pr list --repo "$r" --author @me --state open --limit 50
done
```

Zero PRs in every repo: say so in one line and stop.

## Step 2 - Keep only the actionable ones

Resolution lives only in the GraphQL API (REST and `pr view --comments` list every comment ever made), so count unresolved threads per PR with:

```bash
npx gh-axi api POST /graphql --field query="query { repository(owner: \"<owner>\", name: \"<repo>\") { pullRequest(number: <number>) { reviewThreads(first: 100) { nodes { isResolved } } } } }" \
  --jq '[.data.repository.pullRequest.reviewThreads.nodes[] | select(.isResolved | not)] | length'
```

Raw `gh api graphql` is hook-blocked in this setup, and `gh-axi api graphql` (the subcommand form) does not execute queries; the `api POST /graphql --field query=...` form with the variables inlined is the one that works.

Add to that count the findings in a review bot's unattached PR comments, if your repos run one (`npx gh-axi pr view <n> --repo <owner>/<repo> --comments --full`; one `#### [path, line N]`-style block each). They have no resolution state, so a PR that carries such a comment stays actionable on every run until the findings are outdated (`fix-pr-comments` drops those as SKIP); that costs one worktree per run for that PR and is the price of not missing them.

A PR whose count is 0 is dropped silently - no worktree, no subagent, no line in the report beyond the totals. No actionable PR at all: one line ("N open PRs, none with unresolved comments") and stop.

## Step 3 - Fan out, one subagent per actionable PR, all at once

Dispatch every actionable PR in a **single message with one Agent call per PR** so they run concurrently. Each `fix-pr-comments` run works in its own throwaway worktree, which is what makes the parallelism safe; do not serialize them.

Each subagent's prompt:

```
Run the fix-pr-comments skill (Skill tool, name `fix-pr-comments`) with arguments:
  <PR URL> --unattended
If the Skill tool is unavailable, read ~/.claude/skills/fix-pr-comments/SKILL.md and follow it exactly with those arguments.
Rules of this run: never ask the user anything (--unattended already says so); one push at most; remove the worktree when done.
Return the skill's Step 7 "Comment Resolution Summary" verbatim as your final message, and state explicitly whether a push happened.
```

`--unattended` is what makes the run autonomous: an ambiguous comment is skipped and listed under "Needs you" instead of pausing for a question, and lint or tests that go red because of a fix are repaired before the push, while a failure that was already red before the run is reported and left alone (that is `fix-pr-checks` territory).

One PR failing - the subagent could not get its fixes green, or its run errored out - never stops the others. Record the failure and carry on collecting.

## Step 4 - Report, once

Wait for every subagent, then output one consolidated report:

```
## fix-all-comments - <date>

<total open> open PRs (<drafts> drafts), <actionable> with unresolved comments, <pushed> pushed.

### <repo>#<number> - <title>            ← one block per actionable PR
Fixed <n> · Skipped <n> · Needs you <n> · Pushed: yes/no
<the subagent's Comment Resolution Summary, unchanged>

### Needs you                            ← only if any PR listed one
- <repo>#<number> [file:line] "<comment summary>" → the readings seen

### Pre-existing failures                ← only if any PR listed one
- <repo>#<number> <target> → run fix-pr-checks

### Failed runs                          ← only if a subagent did not finish
- <repo>#<number> → what stopped it, nothing pushed
```

Full `https://...` PR URLs everywhere a PR is named. This skill does not reply to or resolve GitHub comments, does not change a PR's draft state, and never merges.
