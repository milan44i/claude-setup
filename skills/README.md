# skills/

## Mine

| Skill | What it does |
|---|---|
| [`fix-pr-comments`](fix-pr-comments/SKILL.md) | Fetches PR review comments with `gh`, classifies each as **FIX** (bugs, security, broken contracts, missing tests) or **SKIP** (taste, questions, out-of-scope), fixes the legitimate ones with minimal diffs, and prints a resolution summary. Errs toward SKIP when uncertain. |

Install it with `./install.sh --skills` (copies into `~/.claude/skills/`).

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
