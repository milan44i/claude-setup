---
name: create-pr
description: Create a GitHub pull request following the current repo's conventions - commit, push, and open the PR end to end. Use when asked to "create a PR", "open a PR", "make a draft PR", or "create a no-jira PR" for the current changes.
allowed-tools: Bash, Read, Edit, Write, Grep, Glob, Skill, mcp__claude_ai_Atlassian__getJiraIssue
argument-hint: "[--ready] [no-jira]"
---

# Create PR

Create a pull request for the current changes, end to end: **stage → commit → push → open the PR**. Invoking this skill **is** the authorization to commit and push — proceed without a second confirmation.

> Committing and pushing is the default across this setup, not an exception. Never ask "shall I commit?" or "shall I push?" — just do it and report the PR URL. The one thing that still stops you is failing verification.

## Arguments

`$ARGUMENTS` may contain:

- `--ready` — open the PR ready for review. Without it the PR is opened as a **draft** (the default).
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

**Establish whose changes are in the tree.** Step 3 needs this - unrelated WIP can be sitting in the tree alongside this work, and it must not be swept into the commit. Decide it from how you were entered:

- **`implement-ticket` called you, or you're in a worktree.** Both start from a clean tree, so everything dirty now is this work. All of it is yours.
- **Standalone on a live branch.** Only the paths you changed in this session are yours. Anything else dirty is the user's WIP and must not ride along.

If you cannot tell which side of that line a dirty path falls on, list the ambiguous paths and ask before Step 3. Guessing wrong publishes someone's unfinished work.

## Step 2 — Fetch the ticket title and description (skip for no-jira)

Fetch the ticket via the Atlassian MCP (`getJiraIssue`, fields `summary,description`). The summary drives the title; **keep the description** — Step 6 compares it against the diff to detect divergence.

**Strip any leading bracketed prefix** from the summary (e.g. `[Portal] `, `[BE] `).

Title rule (**hard requirement**):

```
[<TICKET-ID>] <ticket summary, leading [..] prefix stripped>
```

Example: ticket `DATAP-5755` titled _"[Portal] Add Publish action (update flow) to Job Configuration Export dialog"_ →
`[DATAP-5755] Add Publish action (update flow) to Job Configuration Export dialog`.

For a **no-jira** PR, the title is `[NO-JIRA] <concise title derived from the diff>`.

## Step 3 — Commit

Commit exactly the paths that are yours, by the rule established in Step 1. The **commit subject is derived from the diff** (what actually changed), not from the ticket title.

```bash
# A real assertion, not a comment: Step 1's `checkout -b` may have failed fatally
[ "$(git branch --show-current)" != master ] && [ "$(git branch --show-current)" != main ] || exit 1
git add <your paths>
git commit -m "<subject derived from the diff>" -- <your paths>
git show --stat HEAD             # confirm only your paths landed
```

**Never `git add -A`, and always pass the pathspec to `git commit`.** `-A` sweeps up the user's WIP, and without the trailing `-- <paths>` on `git commit`, it writes the *whole index* — so anything already staged before this run is published regardless of what you added. A rename contributes both sides, so pass the old path as well as the new one or the deletion stays uncommitted.

**Do not** add any AI attribution or "Generated with…" trailer to the commit message.

## Step 4 — Push

```bash
git push -u origin <branch>
```

## Step 5 — Open the PR

Build the body from `.github/PULL_REQUEST_TEMPLATE.md`, keeping every **heading** and **checklist** structure. "Verbatim" applies to the structure, **not** to the placeholder prompts — those must be filled or removed (see below).

- **The first line of the body must be the ticket in brackets**: `[<TICKET-ID>]` (or `[NO-JIRA]`). Screenshots, when the PR earns them (see **Screenshots** below), come right after that line, each with a one-line caption, before the Rationale heading.
- **Write for a colleague.** Short paragraphs, plain words. No tool or pipeline vocabulary ("fails closed", "decision recorded", "ask-user", run ids), no rationale that belongs in the ticket.
- **Replace, never echo, the italic placeholder prompts.** The template's Rationale section ships with an italic instruction line:
  `_What is this change for?_ _(also please make sure to link the ticket either in PR title, description or branch name)_`
  This is a prompt *to the author*, not body text. **Delete it entirely** and write the actual rationale in its place. The final PR body must **never** contain the words "What is this change for?" or "also please make sure to link the ticket". Treat any leftover italic `_..._` prompt or `<!-- ... -->` hint the same way: replace it with real content, or drop the line.
- **Describe what was done and how — do not duplicate the ticket.** The linked ticket owns the *why* and the spec; the PR body owns *what was actually done and how*. Derive every section from the **diff**, not the ticket. If a sentence restates the ticket's goal, context, or background, cut it.
  - **Rationale**: one line naming the change (e.g. `prettier -> oxfmt migration`), then, when the change has a measured win, a second short sentence with the most important gain (e.g. `-29 KB on the login screen.`). No bullets, no per-file detail; the full measurements and tables stay under testing.
  - **Main code changes to review**: ≤ ~6 items, each a **bold claim** plus one sentence that a reviewer can check against the diff (e.g. "**Scope is identical to today's.** …", "**Removed:** …"). Point at what to scrutinise, **not** a file-by-file restatement.
  - **How was this tested**: one short line (what you ran) plus the ticked checklist boxes - no paragraph re-describing each test. Label every measurement with where it ran ("Locally, …", the CI job name), and put a `**Result**:` line with the headline delta under each table.
  - **AI Review Notes**: never. Remove that heading and its placeholder from the body entirely, even though the template carries it; review evidence belongs in chat, not in the PR.
  - Tick the relevant **test** checklist items.
- **No-jira exception**: with no ticket to carry intent, include a short standalone *why* (1–2 sentences) in **Rationale** in addition to the what/how.
- **Do not annotate divergence from the ticket in the body** — keep the body to what was done. Divergence is surfaced (and reconciled) in Step 6.
- Leave **Monitoring** / **Affected services** as template placeholders unless you have concrete info.
- **No files-changed list** — reviewers see the diff natively.
- **Keep only claims a reviewer checks; cut the story.** Leave out:
  - how the change was produced ("generated with `--migrate`, then reviewed by hand");
  - explanations of how a third-party tool behaves;
  - per-file edge-case stories;
  - version-pin reasoning and config internals;
  - "if you re-run this yourself" instructions;
  - asides such as "which is the check that matters here", and parenthetical percentages.

  A list that explains a single point becomes one sentence.
- **Backtick every tag, path, command and identifier.** GitHub deletes a bare `<script>` or `</pre>` from the rendered body.
- **Before opening the PR, scan the assembled body** and confirm no template prompt text survived (no "What is this change for?", no raw `<!-- ... -->` comment hints in sections you filled). If any did, fix it first.

Open it with `gh-axi` first (token-efficient output):

```bash
npx gh-axi pr create --draft --base master --title "<title>" --body "<body>"
# drop --draft only when the `--ready` argument was passed
```

Only if `gh-axi` is unavailable or the call itself fails, fall back to the raw GitHub CLI with the same flags: `gh pr create --base master --title "<title>" --body "<body>"`.

### Screenshots

**When:** only when the PR brings a visible or measurable benefit.
- Bug fix with a visible symptom: before and after shots.
- New feature or UI change: an after shot, plus a before shot when one exists.
- Performance change: the measured number, master against the branch under the same conditions.

**When not:** refactors, config, tests, docs and internal tooling. Add no images and never invent a visual.

**Capture:** real screenshots only. Claude in Chrome drives the page in the captain's Chrome: local dev, or a custom image deployed with `deploy-custom-image`. Take screen captures with computer use so the DevTools panels (Network, Performance) show; the extension's own screenshot captures only the tab. The captain opens DevTools once per tab: computer use has read-only access to browsers, and the extension cannot reach the browser chrome. Use a matched pair - same filter, same cache setting - cropped to the relevant area, with no personal data or tokens in frame. Narrow a network filter to what the PR changed (e.g. `&raw` shows only AppIcon raw-SVG imports). Only when a real capture is impossible, use a card rendered from measured data, labelled with where it was measured.

**Attach:** GitHub has no API for attaching images to a PR body. After `pr create`, Claude in Chrome opens the PR, edits the description, and uploads the PNGs into the GitHub editor with the extension's file upload; GitHub generates the `user-attachments` URLs. Each image goes right after the `[TICKET-ID]` line with a one-line caption. Save, then re-read the PR body to confirm the images rendered. If Chrome is not connected, leave the PNGs and a ready-to-paste markdown snippet, and report their paths so the captain can drag them in himself.

## Step 6 — Sync the portal user-guide docs (ts-polaris only)

In the **ts-polaris** repo, a merge-gatekeeper check (`fe-nav-kb-validate`) blocks the PR when portal
FE code changed but its portal user-guide page did not. Now that the PR exists, clear it:

- **Only if** this is ts-polaris **and** the branch diff touches the guard's watched paths
  (`portal/src/unified/**`, `portal/src/router/routes.ts`, `portal/src/**/layouts/**`, `Sidebar.vue`,
  or `apps/aiAgentRuntime/knowledgeBase/portalUserManual/**`). If the diff touches none of these, skip
  this step - the check passes instantly.
- When it applies, invoke the **update-portal-user-guide** skill. It reproduces the check locally and
  either updates the affected guide page (user-facing change) or lands the required `User-guide: n/a`
  line in this PR's description (no user-facing change), then verifies a local PASS.

If the skill edits doc pages or `nav-kb-map.json`, those land in the working tree - commit and push
them onto this branch (this run is already authorized to push), so the PR carries the doc sync.

## Step 7 — Report

Print the PR URL and the title used.

**Divergence check (skip for no-jira).** Compare the diff against the ticket **description** fetched in Step 2. If the implementation diverges — extra scope, dropped scope, or a different approach than the ticket specifies — print a prompt (do **not** auto-run anything):

> ⚠️ The changes appear to diverge from the ticket (`<one-line what>`). Run `/ticket-code-consistency` to bring the ticket and this PR description in line.

Otherwise say nothing about divergence. Done — do not resolve comments or take any further action.
