# skills/

## Mine

| Skill | What it does |
|---|---|
| [`fix-pr-comments`](fix-pr-comments/SKILL.md) | Fetches PR review comments with `gh`, classifies each as **FIX** (bugs, security, broken contracts, missing tests) or **SKIP** (taste, questions, out-of-scope), fixes the legitimate ones with minimal diffs, and prints a resolution summary. Errs toward SKIP when uncertain. |

Install it with `./install.sh --skills` (copies into `~/.claude/skills/`).

## Skills I rely on (not vendored here)

I don't re-publish other people's skills — install them from upstream. These are the ones
I actually reach for, and *how* they fit a workflow:

- **`brainstorming` → `writing-plans` → `to-prd` / `to-issues`** — turn a vague idea into a
  stress-tested plan, then into a PRD or grabbable issues before any code is written.
- **`grill-me` / `grill-with-docs`** — adversarial interview that walks every branch of a
  design decision tree before committing to an approach. (This repo was shaped with it.)
- **`test-driven-development` / `tdd`** — red-green-refactor discipline for features and fixes.
- **`systematic-debugging` / `diagnose`** — reproduce → minimise → hypothesise → instrument
  → fix, instead of guess-and-check.
- **`improve-codebase-architecture` / `zoom-out`** — step back from line-level work to find
  structural and deepening opportunities.

Most of these ship in the **`superpowers`** plugin from the official Claude Code plugin
marketplace (`superpowers@claude-plugins-official`) and **Matt Pocock's** published skill
collection. Install them from there rather than copying — that way you get updates.
