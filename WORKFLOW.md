# How I actually work

This is the document the rest of the repo exists to serve. The hooks, the settings and the
skills are the machinery; this is what the machinery is for.

Two workspaces run side by side on one machine, and they are deliberately governed by
**opposite** rules. Almost every decision below falls out of that split, so it comes first.

---

## Two workspaces, two git rules

**Day job - team repos.** Ticket, branch, PR, review, merge. Never a commit on
`master`/`main`. That rule lives in the global `CLAUDE.md` this repo installs
([`claude-md/global.md`](claude-md/global.md)), and every skill in the ticket-to-merge chain
assumes it.

**Personal - my own tree of ~150 repos.** Commit straight to `main`. No branch, no PR, no
waiting for review. The tree's own `CLAUDE.md` says so explicitly and names the reason: I am
the only author *and* the only reviewer, so a PR is pure administrative cost. A change is
verified by deploying it and looking at the live page, not by reading a diff of it.

That is not laziness dressed up as a rule. The decision was taken the day a single pricing
change had to touch 147 repos at once. Opening 147 PRs and merging them myself would have
been ceremony performed for an audience of one.

**But the exception is where the real rule lives.** The two *engine* repos - the ones every
client site is generated from - keep the full gate: feature branch, push, PR, merge, and all
of it inside a dedicated git worktree, never the shared checkout. Around 147 sites are
cloned from those engines, so one bad commit there takes down a fleet, whereas one bad commit
in a single client site takes down one page.

The gate is not a matter of which workspace you are in. It is a matter of blast radius. Team
repos and engine repos get it; the ~147 leaves do not. Working out the blast radius of a
change is the first thing worth doing, and it is the only thing that decides the process.

---

## The day-job loop: ticket to merged

The core work skills are not six independent tools. They are one chain, and each link hands
off to the next:

```
grill-me / grill-with-docs   →  a design argued to the point where nothing is assumed
        ↓
to-jira                      →  the conclusions written into a ticket (or an epic + slices)
        ↓
implement-ticket             →  a worktree, a ticket-named branch, the code, the tests
        ↓
create-pr                    →  commit, push, PR titled and bodied to the repo's convention
        ↓
fix-pr-checks / fix-pr-comments  →  CI green, review comments triaged and answered
        ↓
resolve-conflicts            →  when the base branch moves underneath the PR
        ↓
ticket-code-consistency      →  the ticket rewritten to match what actually shipped
```

Three properties hold across the whole chain, and they are the point of it.

**The ticket is the spec, and the spec is written before the code.** `to-jira` exists because
a grilling session produces conclusions that evaporate if nobody writes them down, and
`implement-ticket` treats the ticket description as the source of truth. So `to-jira` has a
hard job: pre-answer everything `implement-ticket` would otherwise stop and ask about. A
ticket that leaves a decision open turns into an agent guessing, and a guessed requirement is
worse than an absent one.

**Nothing in the chain assumes my repos.** The base branch comes from the remote, branch
naming is inferred from the branches the repo already has, build and test commands come from
the repo's `CLAUDE.md`/`AGENTS.md` or from the CI log - never from memory - and PR titles are
learned from the repo's own merged-PR history. The tracker is Jira or GitHub Issues,
whichever the repo actually uses, with a ticketless fallback when there is no tracker at all.

**The loop closes.** `ticket-code-consistency` runs code → ticket, the opposite direction from
`to-jira`. Scope shifts during implementation; without the closing step the ticket quietly
becomes a lie about what was built, and the next person reads the lie.

---

## The personal loop: lead to sold site

The `biz-*` and `restaurant-*` skills encode a small business, not a hobby. The pipeline is
the same shape in both verticals:

```
biz-scout / restaurant-scout   →  find and qualify candidates, write a dossier
        ↓
biz-site / restaurant-site     →  build a bespoke themed demo site, deploy it, QA it
        ↓
polish-design                  →  page-by-page design pass before an owner ever sees it
        ↓
biz-pitch / restaurant-pitch   →  draft the outreach message, land it on the sending board
        ↓
biz-kokpit                     →  read-only view of the whole funnel: what to do next
        ↓
infra                          →  the account map and runbook everything above deploys onto
```

What makes this work as *agent* instructions rather than as notes-to-self:

**Volatile facts are commands, not prose.** The `infra` skill states its own freshness rule:
never trust a number written in a file, including that file - run the command that answers the
question. Counts, lists and states go stale silently; conventions and decisions do not. So the
skills carry the conventions and point at the CLI for the state.

**One skill owns each file format.** `biz-kokpit` is a thin wrapper over a CLI and is
explicitly forbidden from parsing the funnel's markdown by hand. When two things can read a
format, they drift, and the drift is invisible until it corrupts a registry.

**Decisions carry their date and their cause.** "Branch deploys since 2026-08-15" reads as
arbitrary until you see that the Cloudflare Pages 100-project cap was hit on 2026-08-15. A
rule without its cause gets "simplified" away by the next reader - human or agent.

---

## What both halves share

### The axi CLIs, over raw CLIs and over MCP

Three agent-ergonomic wrappers replace their conventional counterparts: `gh-axi` for all
GitHub work, `chrome-devtools-axi` for anything needing a real browser, `lavish-axi` for
review surfaces. They emit compact structured output plus a next-step hint, instead of the
prose-shaped output a human CLI is designed for.

The reason is context, which is the budget that actually runs out. A raw `gh pr view` spends
context on formatting; an MCP server spends it on tool schemas loaded whether you call them or
not. Preference alone was not enough - the model would reach for `gh` out of habit - so
[`hooks/prefer-gh-axi.py`](hooks/prefer-gh-axi.py) blocks raw `gh` at `PreToolUse` and hands
back the `gh-axi` form. `gh auth` stays exempt, because gh-axi delegates authentication to
the tool underneath it.

### Validation gates the push; review does not

Both halves refuse the same thing: shipping first and finding out later.

- The pre-push hook on the engine repos runs the full verify. `--no-verify` is never
  acceptable - there is no CI behind it, so that hook *is* the gate.
- `create-pr` and `fix-pr-checks` run the affected lint and tests before pushing, in check
  mode, never a `:fix` variant. An auto-fixer can never fail a gate, and it rewrites files
  the change never touched.
- A deploy is not done when the build is green. It is done when the live URL has been fetched
  and checked - status, `noindex` still present on demos, the computed styles of whatever was
  just claimed fixed.
- [`hooks/ts-typecheck.sh`](hooks/ts-typecheck.sh) pulls this all the way down to the single
  edit: type-check after every write, filter the errors to the file just touched, and re-wake
  the model with them. Type breakage gets fixed inside the flow that caused it rather than at
  PR time, when the context that would explain it is gone.

`no-mistakes` is the same instinct as a named pipeline - review, test, lint, docs, push, PR,
CI - run as a gate in front of the push target rather than as a checklist after it.

### One worktree per task

Every skill that touches a shared checkout works in a git worktree instead. Not for tidiness:
concurrent sessions share a checkout's HEAD, index and build output, so working in place
races them. Your commit lands on `main` instead of your branch, a `git add -A` sweeps in
another session's uncommitted files, and two builds corrupt each other's chunks.

Inside an isolated worktree those hazards invert - `git add -A` becomes the *safe* option,
because the index belongs to nobody else. The rule is per-location, not global, which is
exactly the kind of thing worth writing down: "never `git add -A`" is wrong half the time.

### Context is a resource you can see

Compaction throws context away, so [`hooks/precompact.py`](hooks/precompact.py) snapshots
branch, changed files, test results and todos mechanically, then has a model write the
narrative - problem, what was tried, findings, next steps - before the window closes.
Mechanical extraction is cheap and never hallucinates; the model pass captures what the
mechanical pass structurally cannot.

The statusline shows context usage and session cost side by side, because those are the two
budgets that actually run out, and neither is visible unless you put it on screen.

### Small, typed, greppable memory

Preferences and project facts live one-fact-per-file with frontmatter, a stated **Why**, a
**How to apply**, and wikilinks between related facts - an index file, not a prose blob.
A memory that only says *what* gets misapplied the first time the situation differs slightly;
the *why* is what makes it portable.

Memory has to stay consistent with the instructions shipped alongside it. This repo used to
carry a "never commit without being asked" memory next to a `CLAUDE.md` that says *finish the
job in git*. Both were sincere, six months apart. The memory is gone; the current rule stands
alone.

### Orchestration on top

`firstmate` is the layer above all of this: it dispatches work to agents in isolated
worktrees, each reporting state back through a status file, so several tasks run in parallel
without sharing a checkout. It is the reason the worktree discipline above is not optional
any more - the parallelism is now the normal case rather than the exception.
