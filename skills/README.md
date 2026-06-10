# skills/

## Mine

| Skill | What it does |
|---|---|
| [`fix-pr-comments`](fix-pr-comments/SKILL.md) | Fetches PR review comments with `gh`, classifies each as **FIX** (bugs, security, broken contracts, missing tests) or **SKIP** (taste, questions, out-of-scope), fixes the legitimate ones with minimal diffs, and prints a resolution summary. Errs toward SKIP when uncertain. |
| [`create-pr`](create-pr/SKILL.md) | Commits, pushes, and opens a PR end to end — title follows the repo's own PR-title convention (inferred from merged PRs), body from the repo's PR template. Invoking it **is** the commit/push authorization, scoped to that run only. |
| [`fix-pr-checks`](fix-pr-checks/SKILL.md) | Fixes a PR's failing build / unit-test / lint checks: reproduces each locally (mirroring the CI log's command), fixes the root cause, verifies green, pushes once. Current branch in place, or a PR number/URL in a throwaway worktree. Reports (doesn't touch) failures it can't reproduce locally. |
| [`implement-ticket`](implement-ticket/SKILL.md) | Implements a ticket (Jira or GitHub issue) from its description on a `<ticketId>` branch (`--worktree` for isolation). Treats the ticket as the spec, runs affected tests, and **stops before the PR** — review, then `/create-pr`. |
| [`resolve-conflicts`](resolve-conflicts/SKILL.md) | Merges the latest default branch and resolves conflicts — auto on clear ones, asks (with a recommendation) on ambiguous ones. Runs affected tests, commits the merge locally, stops before push. |
| [`ticket-code-consistency`](ticket-code-consistency/SKILL.md) | Updates a ticket's description (Jira or GitHub issue) to match what the branch's code actually does (direction is always code → ticket). Edits the ticket directly. |

Install them with `./install.sh --skills` (copies every skill here into `~/.claude/skills/`).

The PR/ticket skills together form a loop: `implement-ticket` → review → `create-pr` →
`fix-pr-checks` / `fix-pr-comments` → `resolve-conflicts` when the base branch moves →
`ticket-code-consistency` to leave the ticket honest. They adapt to the repo they run in
rather than assuming mine: the base branch is detected from the remote, build/test/lint
commands are mirrored from the CI log or the repo's own scripts, PR titles follow the
repo's merged-PR history, and tickets resolve to Jira (Atlassian MCP) or GitHub Issues
(`gh`) — with a ticketless fallback when there's no tracker at all.

## Matt Pocock's skills (`./install.sh --matt-pocock`)

I don't re-vendor other people's skills. The `--matt-pocock` component clones
[**github.com/mattpocock/skills**](https://github.com/mattpocock/skills) at install time and
copies these into `~/.claude/skills/` — so the code stays attributed to its author and you
get updates by re-running. How they fit a workflow:

- **`to-prd` / `to-issues`** — turn a fleshed-out idea into a PRD, then into grabbable issues.
- **`grill-me` / `grill-with-docs`** — adversarial interview that walks every branch of a
  design decision before committing. (This repo was shaped with `grill-me`.)
- **`tdd`** — red-green-refactor discipline for features and fixes.
- **`diagnose`** — reproduce → minimise → hypothesise → instrument → fix, not guess-and-check.
- **`improve-codebase-architecture` / `zoom-out`** — step back from line-level work to find
  structural and deepening opportunities.
- **`caveman`** — ultra-compressed output mode when you want to save tokens.
- **`setup-matt-pocock-skills`** — *not an installer*: a per-repo scaffolder you run **inside
  Claude Code** after installing the above, to tell those skills your issue tracker, triage
  labels, and domain-doc layout.

It's opt-in: `--all` includes it, but the interactive menu leaves it off by default because
it reaches out to the network.

## Also worth knowing

`./install.sh --plugins` enables the official **`superpowers`** plugin
(`superpowers@claude-plugins-official`), a *separate* collection with its own skills
(`brainstorming`, `test-driven-development`, `systematic-debugging`, `writing-plans`,
`using-git-worktrees`, …). And [`find-skills`](https://github.com/vercel-labs/skills) (from
vercel-labs) is a handy way to discover and install more.
