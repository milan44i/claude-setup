# skills/

Everything here is mine, and everything here runs. Skills I use but did not write are listed
in [`MANIFEST.md`](../MANIFEST.md) with an install command instead of a copy.

`./install.sh --skills` installs all of them into `~/.claude/skills/`. They are grouped the
way [WORKFLOW.md](../WORKFLOW.md) is: the team-repo chain, the personal-business pipeline, and
the two that serve both.

---

## Core work - the ticket-to-merged chain

These run against team repos: ticket, branch, PR, review. None of them assumes my employer or
my repos - base branch comes from the remote, branch naming from the repo's existing branches,
build and test commands from the repo's own `CLAUDE.md`/`AGENTS.md` or its CI log, PR titles
from the repo's merged-PR history. The tracker resolves to Jira or GitHub Issues, with a
ticketless fallback.

| Skill | What it does |
|---|---|
| [`to-jira`](to-jira/SKILL.md) | Writes the conclusions of a grilling session into the tracker - rewriting one ticket, creating one, or creating an epic with independently-mergeable child slices. Every ticket it writes has to pre-answer what `implement-ticket` would otherwise stop and ask. |
| [`implement-ticket`](implement-ticket/SKILL.md) | Builds a ticket from its description on a ticket-named branch, in an isolated worktree by default. Treats the ticket as the spec, runs the affected tests and the `no-mistakes` gate, then hands off to `create-pr` for a draft PR. |
| [`create-pr`](create-pr/SKILL.md) | Commits, pushes and opens the PR end to end - title from the repo's own convention, body from its PR template. Invoking it *is* the commit/push authorization, scoped to that run. |
| [`fix-pr-checks`](fix-pr-checks/SKILL.md) | Reproduces each failing check locally with the command from the CI log, fixes the root cause, verifies green, pushes once. Reports (does not touch) what it cannot reproduce locally. |
| [`fix-pr-comments`](fix-pr-comments/SKILL.md) | Classifies each review comment FIX or SKIP - bugs, security, broken contracts and missing tests get fixed; taste and out-of-scope do not - then fixes the legitimate ones with minimal diffs. Errs toward SKIP. |
| [`resolve-conflicts`](resolve-conflicts/SKILL.md) | Merges the moved base branch, auto-resolving the clear conflicts and asking (with a recommendation) on the ambiguous ones. Runs the affected tests before the merge commit lands. |
| [`ticket-code-consistency`](ticket-code-consistency/SKILL.md) | Rewrites the ticket to match what the branch actually built. The closing direction - code → ticket - so the ticket does not quietly become a lie. |
| [`implement-sprint`](implement-sprint/SKILL.md) | Works a whole sprint: collects your ready tickets, builds the blocking graph before any code, then runs `implement-ticket` per ticket in parallel waves, stacking PRs on unmerged blockers, with one review-and-fix cycle each. |
| [`fix-all-comments`](fix-all-comments/SKILL.md) | Runs `fix-pr-comments --unattended` on every open PR of yours that has unresolved review threads, in parallel, one worktree each, and ends with one consolidated report. |
| [`slack-release-message`](slack-release-message/SKILL.md) | Drafts the team announcement for a shipped ticket or PR: audits every claim against the diff, measures the central benefit when the ticket does not prove it, and never posts. |
| [`deploy-custom-image`](deploy-custom-image/SKILL.md) | A template: dispatch a build workflow that turns a branch into a custom image, read the built tag from the run, and confirm the rollout on a Prometheus-compatible metrics endpoint. |
| [`grilling`](grilling/SKILL.md) | Interviews you about a plan as a design tree, asking a full frontier of questions per round and dispatching sub-agents for any fact it could look up itself. Grills the plan against the repo's own glossary and ADRs. **A fork of `mattpocock-skills:grilling` v1.2.3** - the domain section and the `to-jira` handoff are the additions; kept diffable against upstream. |
| [`grill-with-docs`](grill-with-docs/SKILL.md) | The entry point that runs `grilling` together with `domain-modeling`, so decisions land in the context docs and ADRs as they crystallise rather than in a write-up pass that never happens. Also a fork of the upstream one-liner. |

## Personal - the demo-selling pipeline

A real small business: find local businesses without a decent website, build one, polish it,
pitch it. Twelve `biz-*` verticals plus restaurants, roughly 147 generated client sites on
Cloudflare Pages. These are published as-is because the method is the interesting part.

| Skill | What it does |
|---|---|
| [`biz-scout`](biz-scout/SKILL.md) / [`restaurant-scout`](restaurant-scout/SKILL.md) | Find and qualify candidates in a vertical, verify every fact and URL, and write a dossier the build lane can work from without asking anything. |
| [`biz-site`](biz-site/SKILL.md) / [`restaurant-site`](restaurant-site/SKILL.md) | Build a bespoke themed demo from the dossier on top of the shared engine, deploy it, QA it live, and sync the theme back to the engine through a per-slug worktree and a PR. |
| [`polish-design`](polish-design/SKILL.md) | Page-by-page design pass on a deployed site before an owner sees it: defects always, bounded beautification within the site's existing design DNA, never the DNA itself. |
| [`biz-pitch`](biz-pitch/SKILL.md) / [`restaurant-pitch`](restaurant-pitch/SKILL.md) | Draft the outreach message per lead and put it on the sending board. A demo is not done until it is reachable from there. |
| [`biz-kokpit`](biz-kokpit/SKILL.md) | Read-only funnel view across every vertical: candidates, built, offered, outcome, plus what to do next. A thin wrapper over the funnel CLI - it is forbidden from parsing the state files by hand. |
| [`infra`](infra/SKILL.md) | The account-level map and runbook everything above deploys onto: the Pages branch-deploy model, the Workers side, domains and email, cap management, and the decision records behind each. Its own freshness rule: never trust a count written in a file, run the command. |

## Both halves

`gh-axi`, `chrome-devtools-axi`, `lavish`, `no-mistakes`, `find-skills`, `grill-me` are used
constantly by both loops but are not mine - see [`MANIFEST.md`](../MANIFEST.md).
