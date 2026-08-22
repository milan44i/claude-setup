---
name: to-jira
description: Use when the conclusions of a design or grilling conversation (grill-me / grill-with-docs) need to land in Jira - the user says "create a ticket", "make an epic", "file this in Jira", "write up the conclusions", "update the ticket", or wants a vague ticket turned into an implementable spec.
allowed-tools: Bash, Read, Grep, Glob, AskUserQuestion, mcp__claude_ai_Atlassian__getJiraIssue, mcp__claude_ai_Atlassian__editJiraIssue, mcp__claude_ai_Atlassian__createJiraIssue, mcp__claude_ai_Atlassian__searchJiraIssuesUsingJql, mcp__claude_ai_Atlassian__createIssueLink
argument-hint: "[TICKET-ID] [PROJECT] [--epic|--single]"
---

# To Jira

A design gets grilled until scope, decisions, and edge cases are settled. This skill records those conclusions in Jira. Three outcomes, decided by target and scope:

- ticket referenced, scope fits one PR → rewrite its description
- no ticket, scope fits one PR → create one ticket
- scope exceeds one PR → create an **epic with child tickets** (a referenced ticket becomes one of the children)

Every ticket this skill writes is consumed by `implement-ticket`, which treats the description as the spec - so a ticket must pre-answer everything that skill would otherwise stop and ask about.

## Step 1 - Resolve the target ticket

1. `$ARGUMENTS` contains a `<TICKET-ID>` → that ticket is the target.
2. A Jira ID or URL **explicitly present in this conversation** (e.g. `https://<your-site>.atlassian.net/browse/PROJ-5920` → `PROJ-5920`) → that ticket.
3. Otherwise → no target; create path.

**Do not** treat the current branch name as a referenced ticket. A branch like `proj-5920` means you're *working near* a ticket, not that the user wants conclusions written into it. If the branch looks like a ticket but none was referenced, ask once: *"Update PROJ-5920 (from branch) or create new?"* - never silently pick.

## Step 2 - Gather the findings

- **This conversation** - the primary source. Mine it for the actual conclusions: agreed scope, decisions and their rationale, what was ruled out, edge cases, open questions. Resolved tangents and discarded ideas don't belong in Jira.
- **A grilling-notes file**, if one exists for the ticket/topic: `git ls-files '*grilling*' '*<topic-or-ticket>*'`. Fold its conclusions in and link it from whatever you write.
- **The current ticket** (when a target exists), via `getJiraIssue` (fields `summary,description,parent`). Preserve still-accurate parts (original intent, business context, links); merge, don't clobber.

## Step 3 - Judge the scope

**Single ticket by default.** Epic only if BOTH hold:

1. the settled scope clearly exceeds one reviewable PR, and
2. it decomposes into 2+ slices that are each independently mergeable and verifiable.

A **slice** is one `implement-ticket` run: one branch, one PR, verifiable on its own once merged. A slice spans only the layers the work actually touches (frontend-only is fine) - but one behavior is never split by layer: its migration, API, and UI are one slice, not three tickets.

`--epic` / `--single` in `$ARGUMENTS` override the judgment. When in doubt: single ticket. Splitting later is cheap; a premature epic is ceremony.

## Step 4 - Write the descriptions

All descriptions use **bold section labels** (`**Requirements**`), never `##`/`h2.` headings - Jira already renders a "Description" header. Never lead with a heading. Drop sections with no content.

**Ticket spec** (single ticket, and every epic child):

```
<one-line context sentence; for an epic child: what this slice delivers and that shared context lives on the parent epic>

**Requirements**        - concretely what to build, each item implementable and testable
**Technical Notes**     - chosen approach, affected areas, edge cases, rationale for non-obvious decisions
**Acceptance Criteria** - verifiable done-conditions, prefer checkboxes
**Out of Scope**        - what was explicitly excluded
**Open Questions**      - genuinely unresolved items and who/what closes them
```

**Epic body** (shared-context home; children stay lean and never restate it):

```
<one-line statement of intent>

**Approach**        - the cross-cutting conclusions: overall design, decisions + rationale, link to grilling-notes file
**Slice Map**       - one line per child: <TICKET-ID> - what it delivers
**Out of Scope**    - epic-level exclusions (incl. any deferred phase-2 tail)
**Open Questions**  - cross-cutting unknowns only; slice-specific ones go on the child
```

**Quality bar - only write what was actually concluded.** A guessed requirement is worse than an absent one. Genuine uncertainty goes under *Open Questions*, never an invented resolution. Carry the *why* of non-obvious decisions so nobody reopens the debate.

## Step 5 - Jira mechanics (every created issue)

- **Project:** `$ARGUMENTS` override → else the default project key recorded in memory (a `reference_jira_<project>.md` fact) → else ask.
- **Issue types:** `Task` for tickets and epic children (children get `parent` = epic key); `Epic` for the epic.
- **Titles:** synthesize from the conclusions. For Tasks, learn the project's prefix vocabulary first - `searchJiraIssuesUsingJql: project = <P> ORDER BY created DESC` (~30 summaries), extract leading `[...]` tokens (`[Frontend]`, `[Backend]`, …) and prepend the matching one silently; no confident match → no prefix, never ask. Epic titles: plain feature name, no prefix.
- **Required custom fields:** a project may reject `createJiraIssue` without one (a *Requested Due Date* `customfield_<id>` is the common case). Learn the project's required fields from `getJiraIssueTypeMetaWithFields` once and record them in memory. For a date field, set a placeholder ~4 weeks out via `date -v+4w +%Y-%m-%d` - triage resets it. It is a field, never a line in the description. **Never ask the user for a date.**
- **Label:** `needs-triage` on every created issue - the only label this skill applies.
- **Duplicate guard:** `createJiraIssue` can hang ~20 min and double-create. On timeout, search `project = <P> AND summary ~ "<title>"` before retrying.

## Step 6a - Single ticket (auto, no confirmation)

Update path: apply the new description with `editJiraIssue` - the grilling was the review. Create path: `createJiraIssue` per Step 5. Fully autonomous either way.

## Step 6b - Epic path (one checkpoint, then auto)

1. **Draft slices.** Slice 1 is the thinnest complete path through the feature and carries the shared foundation (migration, new module, shared component) - a child that delivers no verifiable behavior is not a slice, so there are no standalone plumbing/infra tickets.
2. **Blocking - fan, not chain.** Every later slice blocks on slice 1 only. Add another `Blocks` link only for a genuine technical dependency (slice N consumes what slice M introduced), never for narrative order.
3. **Bounds.** 2-6 children is healthy. More means the grilled scope is too big: keep the core slices and move the tail into the epic's *Out of Scope* as a phase-2 note - flag this at the checkpoint.
4. **Checkpoint (the only one).** Present: epic title; per slice its title, one-line scope, and blockers; any scope-smell flag; on the conversion path, explicitly *"<TICKET-ID> becomes slice N of this epic"*. Iterate until approved - then create everything with no further confirmation.
5. **Create.** Epic first, then children blockers-first (so `Blocks` links reference real keys), each per Step 5.

**Conversion (update path, epic-sized scope):** never convert the ticket's type and never leave it as an umbrella of links. Create a fresh epic above it; the existing ticket becomes the child slice its original scope best matches (usually slice 1), its description rewritten to that slice's scope, its `parent` set to the epic. Siblings are created alongside; the epic's **Approach** links back to the origin ticket. History, comments, and watchers stay on implementable work.

## Step 7 - Report

- **Updated:** what changed - scope locked in, anything moved to Out of Scope, Open Questions left - plus the ticket link.
- **Created:** IDs and URLs (epic + children in slice order). Suggest the next step: `/implement-ticket <slice-1-ID>`; later slices unblock as their blockers merge. (New IDs are now referenced in the conversation, so re-running this skill updates rather than duplicates.)

## Common mistakes

| Mistake | Instead |
|---|---|
| Asking the user for a due date | Placeholder `date -v+4w`; triage owns the real date |
| `ready-for-agent` or invented labels | `needs-triage` only |
| `##`/`h2.` headings in a description | Bold section labels |
| Umbrella ticket + Blocks links when scope is epic-sized | Real epic with `parent`-linked children |
| Restating shared decisions in every child | They live once, in the epic's **Approach** |
| Creating the epic or restructuring a ticket without the checkpoint | Checkpoint first, always - epic path only |
| Slicing by layer (DB ticket / API ticket / UI ticket) | Vertical slices; slice 1 carries the foundation |
