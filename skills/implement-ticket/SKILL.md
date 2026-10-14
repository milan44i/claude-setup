---
name: implement-ticket
description: Implement a Jira ticket from its description on a branch named after the ticket, then commit, push, and open the PR. Use when asked to "implement <TICKET-ID>", build a ticket, or work a ticket. Runs in an isolated git worktree by default; pass --in-place to work in the live checkout.
argument-hint: "<TICKET-ID> [--in-place]"
---

# Implement Ticket

Implement a ticket from its description, on a branch named after the ticket, and take it all the way to an open PR. Review happens on the PR, not in the working tree.

This skill does **not** grill or plan for you - the user does that beforehand (e.g. with `grill-with-docs`). Take the ticket description as the spec.

## Inputs

| Input | Required | Source |
|-------|----------|--------|
| `<TICKET-ID>` | Required | `$ARGUMENTS` (e.g. `ABC-123`); ask if missing |
| `--in-place` | Optional | `$ARGUMENTS` flag; default is an isolated worktree |
| Ticket description, plus the parent epic's | Required | Fetched via the Atlassian MCP in Step 1; the spec for what to build |
| Repo lint/test commands | Required | The repo's `CLAUDE.md` / `AGENTS.md` or build files, never memory |

## Outputs

| Output | Description |
|--------|-------------|
| Branch `<ticketid>` | Lowercased ticket ID off up-to-date `master`, implementing commit(s) pushed |
| Open draft PR | Opened by `create-pr` (`[TICKET-ID] Title`, repo PR template); URL reported |
| Verification report | Lint result and non-zero test counts for the affected packages |
| no-mistakes evidence | The pipeline outcome (review findings fixed, tests, docs, lint), reported in chat, never in the PR body |
| Clean workspace | Worktree removed after the PR is open (worktree mode); live checkout untouched |

## Execution diagram

See [`skill-diagrams/implement-ticket.md`](skill-diagrams/implement-ticket.md) for the full step-flow Mermaid diagram (kept outside per-invocation context).

## Step 0 - Emit phase tracker

At skill entry, before the Jira fetch or any git call, create one Task per step with the Task tools (`TaskCreate` / `TaskUpdate`) and flip each to `completed` as the run advances:

```
TaskCreate("Step 1 - Read the ticket")         → in_progress
TaskCreate("Step 2 - Set up the workspace")    → pending
TaskCreate("Step 3 - Implement")               → pending
TaskCreate("Step 4 - Verify")                  → pending
TaskCreate("Step 4b - Validate via no-mistakes") → pending
TaskCreate("Step 5 - Ship via create-pr")      → pending
TaskCreate("Step 6 - Summarize")               → pending
```

No step enters `in_progress` while the previous one is still open: Step 4 gates Step 4b, Step 4b gates Step 5, and the worktree is removed only after Step 5 confirms the PR is open. If the Task tools are unavailable in the session, keep the same tracker inline in your replies; do not fall back to `TodoWrite`.

## Step 1 - Read the ticket

`$ARGUMENTS` contains the `<TICKET-ID>` (e.g. `ABC-123`). Fetch it via the Atlassian MCP (`getJiraIssue`, fields `summary,description,parent`). `getJiraIssue` requires a `cloudId` - get it once from `getAccessibleAtlassianResources` and reuse it for every later call. Treat the description as the source of truth for what to build.

**If the ticket has a parent epic, fetch the epic too** (`getJiraIssue` on the parent key, fields `summary,description`) and read its description before coding - epic-born tickets are deliberately lean and keep the shared context (approach, cross-cutting decisions, epic-level out-of-scope) on the epic.

If the description is ambiguous or underspecified, **ask before coding** rather than guessing.

## Step 2 - Set up the workspace

**First, in both modes: pull latest master.** Run `git fetch origin master` before anything else, and branch off what you just fetched - never off a stale local `master`. A branch cut from a stale base starts life with phantom conflicts and a misleading diff.

**Default - isolated worktree.** Create a git worktree on branch `<ticketId>` (lowercased, e.g. `abc-123`) off the just-fetched `origin/master` (e.g. `git worktree add <path> -b <ticketId> origin/master`), and do all work there - use whatever worktree tooling is available (EnterWorktree, the using-git-worktrees skill, or native `git worktree add`). The live checkout, and any WIP sitting in it, stays untouched; Step 5 removes the worktree once the PR is open.

**With `--in-place`:** work in the live checkout instead. Two guards first, because a failure here lands the ticket on `master` or drags unrelated WIP onto the branch:

```bash
[ -z "$(git status --porcelain)" ] || { echo "dirty tree - stop and ask"; exit 1; }
git checkout master && git pull --no-rebase   # merge, not rebase (repo convention)
git checkout -b <ticketId>                    # fatal if the branch exists - then plain `git checkout <ticketId>`
```

Confirm you are on the ticket branch (`git branch --show-current`) before Step 3.

## Step 3 - Implement

Implement the change described by the ticket, following the conventions of the area you're touching.

Make the minimal correct change. Ask when uncertain.

### Scope - do not fix old defects

The ticket's own requirements, working end to end, are the job.

Code this ticket touches will often turn out to have been fragile all along, and exercising it properly for the first time is exactly what exposes that. Leave it alone. Fix a pre-existing defect **only when it actually breaks this ticket's implementation** - the acceptance criteria cannot pass, or the feature cannot work end to end, without the fix. Say so in the PR body when you do.

Everything else you find on the way is a follow-up ticket, named in the PR body, not a commit on this branch.

This binds the review rounds in Step 4b and `code-review` just as hard. A confirmed finding in shared code that this ticket merely exposed is a real defect and still not yours: widening the diff into code other features depend on, on a ticket whose reproduction you may not even be able to verify against, buys risk rather than quality. When the rounds keep surfacing real defects that are no longer about this ticket and the acceptance criteria have been met, **stop** - the ticket is done, file the rest.

## Step 4 - Verify

Run lint and the **affected** tests (not the whole suite unless the change is broad), using the repo's own commands - take them from the repo's `CLAUDE.md` / `AGENTS.md`, never from memory. In a monorepo, note which subdirectories are separate packages you must `cd` into. If the repo documents nothing, infer from the build files (`package.json` scripts, `build.sbt`, `Makefile`) and report what you ran.

Two rules regardless of stack:

- Use check-mode lint, never a `:fix`/auto-fix variant - an auto-fixer can never fail a gate, and it rewrites files that are not yours.
- Treat "zero tests ran" as **not verified** - a green exit with no tests executed (wrong path, `--passWithNoTests`-style flags) proves nothing. Confirm a non-zero test count.

Report results, including the test counts.

Verification gates the push. If lint or tests fail and you cannot fix them, **stop here** and surface the failures instead of shipping.

## Step 4b - Validate via no-mistakes

Once Step 4 is green, **invoke the `no-mistakes` skill** (Skill tool, `no-mistakes`) on the ticket branch, with the push, PR and CI steps skipped - `create-pr` owns those in Step 5:

```bash
no-mistakes axi run --intent "<intent>" --skip push,pr,ci
```

The intent is the pipeline's only scope fence, so write it as two parts: the ticket's goal in one sentence, then its acceptance criteria verbatim, then this sentence: "Anything beyond these criteria - a new guarantee, mechanism, state, or guard for a case the ticket does not name - is out of scope: report it as a follow-up, do not fix it. A comment that merely restates the code, and any line no acceptance criterion needs, are findings in their own right: delete them, do not defend them." The reviewer reads the intent, and without that fence it will grow the change round after round.

That leaves the pipeline's intent check, rebase onto the base branch, the independent code review with its fix rounds, the test step, the documentation step and lint. Drive every gate it parks on with `no-mistakes axi respond` as the skill describes, and keep going until the run reports its outcome. Rules:

- Never pass `--yes`. An **ask-user** finding is a decision above this ticket's scope: stop, surface it (to the user in an interactive session, to the supervising agent in a fleet or sprint run), and apply only the answer you get. Do not answer your own finding. The default answer for a finding that would add a guarantee, mechanism or state the ticket did not ask for is **decline and file a follow-up**; only a finding that says the ticket's own behaviour is wrong gets a fix.
- Code the fix rounds write follows the same rules as yours: no comments except where the code genuinely cannot express a why (a workaround, an external constraint), no rationale paragraphs in code, no new abstractions for one call site, and no new helper when the codebase already has one that does the job (reuse or extend it).
- **At most five review fix rounds.** The review gate only re-runs because you answer it `--action fix`; count the rounds (axi status shows `round`). If findings are still open after the fifth fix round, do not answer fix again: stop, list what is still open, and surface it (user or supervising agent) - five rounds means the finding is not converging, and more rounds only add code.
- Fix commits the pipeline makes stay on the branch. Do not squash, rebase or amend them away before Step 5.
- If `axi run` refuses because the repo is not configured for no-mistakes, run the exact setup command it prints, then rerun. If the pipeline cannot run at all (daemon or agent missing), stop and surface it rather than shipping without the gate.
- A red outcome (a review finding you cannot fix, failing tests, lint) is a stop: report it instead of proceeding to Step 5.

**Diff-growth check, before Step 5.** Compare what the review rounds added against your own implementation: `git diff --stat <implementation-commit>` versus `git diff --stat master...<implementation-commit>`. If the fix rounds added more lines than the implementation itself, the pipeline has built something the ticket did not ask for: stop, show both stats and the fix commits, and let the user (or the supervising agent) decide what stays before anything is pushed.

Keep the outcome line for your own report; it does not go in the PR body.

## Step 5 - Ship

Once Step 4b has passed, **invoke the `create-pr` skill** (Skill tool, `create-pr`) and let it drive stage, commit, push, and open the PR (draft by default).

Do **not** hand-roll this with raw `git commit` / `git push` / `pr create`. `create-pr` owns the branch naming, the `[TICKET-ID] Title` convention, and the repo's PR template; reimplementing it inline loses all three. It already knows the ticket from the branch name.

Tell `create-pr` what was tested with real counts, and where the screenshots are. `create-pr` Step 5 owns the PR body style: a one-line Rationale plus the headline measured gain, bold checkable claims under "Main code changes", no process narrative, no pipeline vocabulary or run ids, and no "AI Review Notes" section. Screenshots, when there are any, go at the top of the body, right after the `[TICKET-ID]` line.

**The PR is a draft. Always.** `create-pr` already defaults to draft; never pass `--ready`. If any other path opened it ready for review - the pipeline's own `pr` step when push/pr/ci were not skipped, or a manual `pr create` - convert it back before you report done:

```bash
ID=$(npx gh-axi api /repos/{owner}/{repo}/pulls/<n> --jq .node_id)
npx gh-axi api POST /graphql --field query="mutation { convertPullRequestToDraft(input: {pullRequestId: \"$ID\"}) { pullRequest { number isDraft } } }"
```

(gh-axi's `pr ready` has no undo flag, and raw `gh pr ready --undo` is blocked in this setup.) Marking a PR ready for review is the user's move, after they have looked at it - never yours.

No second confirmation, and never offer to stop at "changes are ready for review".

In worktree mode, open the PR **before** removing the worktree, and ask any user-facing question before then too - the workspace is gone afterwards. Remove the worktree as soon as `create-pr` confirms the PR is open (its final steps may still commit follow-up doc edits onto the branch, so wait for its report), then return to the original directory. An open PR is the end of this worktree's life; nothing waits in it for review or merge.

## Step 6 - Summarize

Report what changed, which tests ran, the no-mistakes outcome (here, not in the PR), and the PR URL.
