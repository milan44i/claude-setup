---
name: slack-release-message
description: Draft the Slack message that announces a shipped or about-to-ship feature, upgrade or tooling change to the team, from a Jira ticket, an epic or a PR URL. Reads the ticket, its PRs and the actual diff, keeps only claims the code supports, measures a central benefit itself when the ticket does not prove it, and returns a What / Why / Scope message for the channel or group the user names (the team channel by default). Drafts only, never posts. Use whenever the user asks for an announcement, a heads-up, a release or upgrade message, or a Slack message about a ticket or PR, in English or Serbian ("pripremi announcement", "napiši obaveštenje za tim", "obavesti @grupu da ...", "poruka za Slack za ovaj PR"), including when they add extra content such as a config snippet or a mention.
allowed-tools: Bash, Read, Grep, Glob, Agent
argument-hint: "<ticket-key, ticket URL or PR URL> [audience, extra content]"
---

# Slack Release Message

Turn a finished ticket into a Slack announcement the team can trust. The message says what shipped, why, and what it means for readers, and every sentence in it is backed by the code that actually landed. Anything you could not confirm goes to the user in chat, never into the message.

You draft. You never post to Slack.

## Inputs

| Input | Required | Source |
|-------|----------|--------|
| Ticket | Required | `$ARGUMENTS`: a key (`ABC-123`), a number, or a Jira URL; ask if missing |
| Ticket and epic text | Required | Atlassian MCP (`getJiraIssue`, fields `summary,description,parent,issuelinks`); `cloudId` once from `getAccessibleAtlassianResources`. For an epic, also its children |
| The PRs | Required | `npx gh-axi search prs "<KEY>" --repo <owner>/<repo>` in each repo the team ships from, once with `--state closed` (merged ones are the interesting ones) and once with `--state open`; there is no `--state all` |
| The diff | Required | `npx gh-axi pr diff <n> --full` per PR, and the merged commits (`git log --format='%h %an %s' --grep=<KEY>` in the repo) |

The ticket description is supposed to be up to date with the code. Treat that as a claim to check, not a fact.

## Step 1 - Read what shipped

Fetch the ticket; if it has a parent epic, fetch the epic; if it *is* an epic, fetch its children. Find every PR referencing the key (or a child key) and read its body and diff. Note which PRs are merged - an open PR is not shipped and does not go into an announcement without saying so.

Collect the contributors from the PR authors and the commit authors. They get thanked by name in the message; make sure they are people, not bots.

## Step 2 - Audit every claim against the diff

List each claim the ticket, epic, and PR bodies make: what changed, what improved, what readers must do. Check each one against the diff:

- **Confirmed** - the diff shows it. Goes in the message.
- **Disagrees** - the text says one thing, the code another (a dropped scope item, a version that differs, an option the PR rejected but the ticket still lists). Never in the message; report it in chat with the evidence so the user can fix the ticket.
- **Unconfirmed benefit** - a claimed outcome the diff cannot show by itself ("faster builds", "smaller bundle", "lint is quicker"). Handled in Step 3.

Two claims to be paranoid about: version numbers (read the lockfile, not the ticket) and "no action needed" (read the migration guides of what was bumped, and grep the repo for the removed or renamed options).

## Step 3 - Benefits: confirmed, measured, or left out

A benefit is in the message only when you can stand behind a number or a mechanism you have seen.

- **Central and measurable** - if the benefit is the point of the announcement (a performance upgrade that promises a faster load, a lint rewrite that promises speed) and it can be measured here in bounded time - two builds, two lint runs, two bundle sizes on the merge commit and its pre-change parent - **measure it**, and put the result in the message with its unit and any caveat that would change how a reader takes it (file count changes, HTTP/1.1 vs HTTP/2, unrelated code that landed between the two revisions). Run the measurement in a throwaway worktree, never in the live checkout, and never patch either revision to make it build. A number that kills the claim is as good as one that supports it; say which way it went.
- **Not central, or not measurable here** - leave it out of the message. In chat, tell the user the benefit you dropped and how they could confirm it, so they can decide whether it is worth the measurement.

Never write "we're measuring X and will follow up" or any variant of a promise in the message. The message states what is true today or says nothing.

## Step 4 - Write the message

Audience: the team channel unless the user names another. Engineers who know the tools, so tool names, versions and technical terms stay; what goes is padding, marketing adjectives and anything the reader cannot act on or learn from.

```
Hi Team :wave:,

*What*
<one or two sentences: the thing that shipped, named plainly, with the ticket linked>

*Why*
<the reason it was worth doing, in the reader's terms: what was wrong or missing before, what this changes for them; the measured number lives here or in Scope, whichever reads better>

*Scope*
• <component or tool> - <what changed and, if anything, what a reader will notice>
• ...

*What you need to do*            ← only when at least one item is real; otherwise omit the section entirely
• <concrete action, for whom, by when if it matters>

Thanks to @<name> for <what they did>.   ← every contributor, from Step 1; omit only when the author is the only one
```

Rules:

- Short. Emphasis goes to what changed and what it means; history and mechanics only when they help a reader act.
- Every claim traceable to Step 2 or Step 3. If you cannot point to the diff or your own measurement, it is not in the message.
- The ticket is linked once, in What, as `<<your-jira-url>/browse/KEY|KEY>`.
- Slack formatting: `*bold*`, `•` bullets, no Markdown headers.
- No em dashes; plain dash. No "we're excited", no exclamation marks in prose.
- A benefit with a number states the number and the caveat in the same sentence.

## Step 5 - Return it

Output two things:

1. The message, in one code block, ready to paste.
2. **Notes for you** (chat only, never part of the message): claims that disagreed with the code and where; benefits you left out and how to confirm them; anything measured, with the exact revisions and commands so it can be reproduced; open PRs that referenced the ticket but are not merged.

Do not post, do not edit the ticket, do not comment on the PRs.
