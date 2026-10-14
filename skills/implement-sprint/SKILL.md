---
name: implement-sprint
description: Work a whole Jira sprint. Reads every To Do and Queue ticket assigned to you in the current open sprint, builds the blocking graph before writing any code, then implements each through implement-ticket - in parallel where the graph allows - running a code-review pass and fixing its findings after each one. Use when asked to "do my sprint", "implement the sprint", or work a sprint end to end. Runs inside firstmate; every ticket is implemented by its own subagent.
argument-hint: "[<SPRINT-NAME>] [--dry-run]"
---

# Implement Sprint

Take a sprint from "nothing started" to "a stack of PRs waiting for your merge", without you sequencing the work by hand.

This skill **orchestrates**; it does not implement. Every ticket is built by `implement-ticket` in its own subagent, and every review is a separate subagent. You stay the supervisor: you hold the graph, the order and the report, not the diffs.

It does **not** grill or plan a ticket for you. Each ticket's description is its spec, exactly as in `implement-ticket`.

## Inputs

| Input | Required | Source |
|-------|----------|--------|
| Sprint | Optional | `$ARGUMENTS`; defaults to `sprint in openSprints()` |
| `--dry-run` | Optional | Print the graph and the plan, implement nothing |
| Tickets | Required | Jira, via the Atlassian MCP - assignee `currentUser()`, status **To Do** or **Queue** |
| Blocking links | Required | Each issue's `issuelinks` of type `Blocks` |
| Repo per ticket | Required | The ticket's title prefix (e.g. `[Frontend]` / `[Backend]`), confirmed against the description |

## Outputs

| Output | Description |
|--------|-------------|
| Implementation order | The blocking graph and the waves derived from it, printed before any code |
| One open PR per implemented ticket | Draft, checks green, one review-and-fix cycle done |
| Jira status | Each implemented ticket moved to **In Progress** |
| Final report | Implemented, skipped, failed and no-code tickets, each with its reason |

## Step 0 - Emit phase tracker

Before the Jira query, create one Task per phase and flip each as the run advances:

```
TaskCreate("Phase 1 - Collect the sprint")     → in_progress
TaskCreate("Phase 2 - Build the blocking graph") → pending
TaskCreate("Phase 3 - Implement")                → pending
TaskCreate("Phase 4 - Report")                   → pending
```

Phase 3 gets one Task per ticket once the graph is known, so the sprint's shape is visible in the tracker rather than only in your head.

## Phase 1 - Collect the sprint

```
project = <PROJECT> AND sprint in openSprints() AND assignee = currentUser()
```

Fetch `summary`, `description`, `status`, `issuelinks`, `parent`. Get the `cloudId` once from `getAccessibleAtlassianResources` and reuse it.

**Select by status name, never by status category.** A workflow with statuses such as Backlog, On Hold, Queue, To Do and Discovery puts several of them in the "To Do" *category*, which silently sweeps in work you were not asked to start. Take **To Do** and **Queue** (or your workflow's equivalent ready-to-start statuses) and nothing else.

Everything excluded is still named in the final report, with its status. A ticket already In Progress with an open PR is skipped because re-implementing it would open a second PR for the same work - say so by name rather than silently dropping it.

If nothing qualifies, say that and stop. An empty sprint is a result, not a failure.

## Phase 2 - Build the blocking graph, before any code

For every selected ticket, read its `issuelinks` of type `Blocks` in **both** directions. The graph is not limited to the selected set: a ticket in To Do is routinely blocked by one that is In Progress.

**An unmerged PR is still a blocker.** A blocker whose status is In Progress with an open, unmerged PR has not landed, so anything downstream must build on top of it rather than on master. Only `Done`, or a merged PR, clears a blocking edge.

Jira links are the primary source and in practice they are accurate - but they are a claim, not proof. Read each ticket's description too, and treat a dependency stated in prose as real even when no link exists. Report any dependency you found that Jira does not record.

Derive **waves** from what a ticket can actually be branched off, not from what is merged:

- **Wave 1** - every ticket whose blockers all already have a branch to build on: either merged into master, or sitting in an open PR. It can start now, stacked if need be.
- **Wave 2+** - every ticket blocked by one this run has yet to implement. There is no branch to stack on until that blocker finishes, so it waits, however trivial it looks.

Worked example: `ABC-2` is blocked by `ABC-1`, whose PR is open and unmerged - a branch exists, so ABC-2 is **wave 1** and stacks on it. `ABC-3` is blocked by `ABC-2`, which this run has not built yet - nothing to stack on, so ABC-3 is **wave 2** and starts only once ABC-2 is done. Both are selected; they cannot run together.

**Cap the stack at three unmerged levels.** ABC-3 on ABC-2 on ABC-1 is already three deep with nothing merged: every rebase cascades through the whole tower, and one review comment at the bottom rewrites everything above it. Past three, stop and tell the captain which PR to merge to collapse the stack, rather than building a fourth storey on foundations he has not looked at.

Print the graph, the waves and the stack depth. Do not wait for approval - the plan is information, not a gate.

With `--dry-run`, stop here.

## Phase 3 - Implement, wave by wave

Within a wave, tickets are independent, so dispatch them **in parallel**. Across waves, respect the order. Each ticket is one subagent running `implement-ticket`, in its own isolated worktree.

### Branch and PR base

A ticket with no unsatisfied blocker branches off fresh `master` and its PR targets `master`.

A ticket whose blocker has an open, unmerged PR branches off **the blocker's branch**, and its PR targets **that branch**. The diff stays limited to this ticket's own work, which is what the review and the human reader actually read, and the merge order is enforced by the forge rather than by memory. Say so in the PR body.

**If the blocker's PR is merged while this ticket is still in flight**, rebase onto fresh `master` before calling the ticket done. The forge retargets the base on its own, but the branch still carries commits that are now in master, so an un-rebased PR shows someone else's work as its own.

### Repo resolution

Map each title prefix to its repo (e.g. `[Frontend]` means `<frontend-repo>`, `[Backend]` means `<backend-repo>`). **Confirm the prefix against the description** rather than trusting it alone. If they disagree, or there is no prefix, stop and ask - a wrong repo means a branch and a PR in the wrong place, and that is expensive to unpick.

### An underspecified ticket

`implement-ticket` says to ask before coding when the description is ambiguous. In an autonomous run there is nobody in the subagent's loop, so the subagent stops and asks **you**, the supervisor. Decide it yourself when the answer sits inside the ticket's already accepted scope; escalate to the captain only when the answer would **expand** what the ticket promises. Never skip an underspecified ticket silently.

### A ticket that needs no code

Some tickets turn out to be investigations, or already resolved. **Do not open an empty PR.** Record the finding as a report, leave the ticket untouched, and carry it into the final report as "nothing to change, and here is why".

### Validation gate - inside every ticket

`implement-ticket` now runs the no-mistakes pipeline (review with fix rounds, tests, docs, lint; push, PR and CI skipped) as its Step 4b, before `create-pr`. In a sprint that is where most defects get caught, so:

- The subagent must never pass `--yes`. An **ask-user** finding from the pipeline comes to **you**, the orchestrator, exactly like an underspecified ticket: decide it only when it stays inside the ticket's scope, otherwise stop that ticket and carry the question into the report.
- A ticket whose pipeline run ends red is a failed ticket (see "When a ticket fails"); do not let the subagent open a PR around it.
- The pipeline's fix commits stay on the branch and travel into the PR; the review-and-fix cycle below is the second, independent pass, not a replacement for the gate.
- Record the run id and outcome on the ticket's backlog item so a re-run does not repeat a passed pipeline.

### Review and fix - one cycle per ticket

After `implement-ticket` reports its PR open and checks green:

1. A **separate** subagent runs `code-review` at high effort against that ticket's diff - against the blocker's branch when the branch is stacked, so the review never re-reports findings in someone else's code.
2. The **implementing** subagent applies the fixes; it has the context, and an author reviewing their own work has a systematic blind spot.
3. Fix every confirmed finding **that is about this ticket**. Two classes are not fixed in the loop: a finding that would **expand the work beyond the ticket** (new architecture, a new subsystem, a new guarantee) goes to the captain as a decision, and a finding in **pre-existing code this ticket merely exposed** goes to a follow-up ticket named in the PR body - see `implement-ticket`'s "Scope - do not fix old defects". The bar for touching old code is that this ticket cannot pass its acceptance criteria or work end to end without it.

One cycle, not until-clean. A second review round means the first fix was wrong, which is worth a human's attention rather than another automatic pass. Rounds that keep finding real defects while the ticket's own criteria are already met are a signal the diff has drifted off the ticket: stop the loop, keep the ticket's work, file the rest.

### Definition of done, per ticket

no-mistakes passed inside implement-ticket, PR open **as a draft**, checks green, one review-and-fix cycle complete. **Then** move the Jira ticket to **In Progress**.

Every PR a sprint run opens stays a draft until the captain has looked at it; converting one to ready for review is his move, never the run's. Verify it before reporting the ticket done (`npx gh-axi pr list --state open --author '@me'` shows the draft column) and convert any non-draft back with the mutation in `implement-ticket` Step 5.

Merging is the captain's, always, and it never blocks the next ticket - waiting on a human merge would stall the whole sprint on its first PR.

### When a ticket fails

Continue with the rest. Stop only the branch **downstream of the failure**: if the failed ticket blocks another, that other one cannot proceed either, but unrelated waves keep going. Every stopped ticket is named in the report with what stopped it.

### Context and cost

Check your own context after each finished ticket. Above **50%**, compact before starting the next one - the subagents carry the code, but a supervisor that runs out mid-sprint loses the graph and the report, which is the one thing nothing else holds.

There is no spend cap. Tell the captain when the run costs unusually much for a sprint, and keep going - a tool that halts mid-chain leaves half-built branches, which is worse than expensive.

### Resumability

Record each ticket as its own firstmate backlog item, carrying its wave, its branch, its PR and its state. A re-run reads that record and continues instead of re-implementing what is already done. Sessions die; the record is what makes that a pause rather than a restart.

## Phase 4 - Report

One table, every selected ticket, plus everything excluded in Phase 1:

| Ticket | Repo | Wave | Branch base | PR | Review findings | Jira | Outcome |

Then, in prose: dependencies you found that Jira does not record, decisions escalated to the captain, tickets that needed no code, and anything that failed with what stopped it.

Give the captain the full `https://...` PR URLs and the merge order the graph implies. He merges; you do not.
