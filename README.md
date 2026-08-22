# claude-setup

My working [Claude Code](https://claude.com/claude-code) setup, and the workflow it exists to
serve. Hooks that make the model fix its own type errors and carry context across compaction,
a statusline that shows the two budgets that actually run out, a typed memory discipline, the
skills I wrote, and the settings that wire it all together.

**Start with [WORKFLOW.md](WORKFLOW.md)** - the machinery only makes sense once you see what
it is for.

```bash
git clone https://github.com/milan44i/claude-setup
cd claude-setup
./install.sh                       # interactive checklist
```

```bash
./install.sh --all                 # everything, no prompts
./install.sh --hooks --statusline  # just these
./install.sh --memory              # project-scoped: installs into the repo you run it from
./install.sh --all --dry-run       # show every action, change nothing
```

**The installer is built to be safe to run on a machine you already use:**
it **backs up** `settings.json`, `CLAUDE.md` and `MEMORY.md` before touching them,
**merges** instead of overwriting (your existing keys win), is **idempotent** (re-running never
duplicates hook entries or nests a skill directory), and **installs no permission allowlist** -
the settings here carry only hook/statusline/plugin wiring, so your permission policy stays
yours. Install into a sandbox first with `CLAUDE_HOME=/tmp/cc ./install.sh --all`.
Runs on stock macOS bash 3.2.

---

## What this repo is, honestly

This is a **mirror of the setup on one machine**, sanitized for publication. Two caveats worth
stating plainly:

- **The skills under [`skills/`](skills/) are mine and are what I run**, with employer-specific
  detail stripped: tracker host, project keys and internal repo names are replaced with
  placeholders, and the skills are tracker-agnostic by design. `to-jira`, `grilling` and
  `grill-with-docs` are the three that carried any.
- **Skills I use but did not write are not vendored here.** They are listed in
  [`MANIFEST.md`](MANIFEST.md) with an install command and a line on why. A copied skill rots
  silently and publishes a fork nobody meant to maintain.

Two things the live machine has that this repo deliberately does not ship:

- A `PreToolUse` hook that blanket-auto-allows every `mcp__*` tool. It would silently loosen
  your permission policy, which is the one promise the installer makes.
- Scheduled tasks. They are personal automation, not setup.

---

## Principles

- **Capture context deterministically - don't trust the model to remember.** A `PreCompact`
  hook snapshots branch, modified files, test results, todos, and an AI-written summary
  *before* compaction throws context away.
- **Make the model fix its own mistakes.** A `PostToolUse` hook type-checks every edit and,
  on failure, wakes the model with the exact errors so it self-corrects before moving on.
- **Blast radius decides process, not workspace.** Team repos and the two engine repos get
  branch → PR → review; the ~147 sites generated from those engines commit straight to `main`.
  See [WORKFLOW.md](WORKFLOW.md).
- **Validation gates the push, not the review.** Affected lint and tests run in check mode
  before anything leaves the machine. Never a `:fix` variant - an auto-fixer can never fail a
  gate.
- **Memory is a filesystem, not a vibe.** Preferences and project facts live in small, typed
  Markdown files with an index - greppable, reviewable, and linkable.
- **Keep tool output small.** The global `CLAUDE.md` pushes for `rg`/`jq`/`tail` and
  failure-summaries-first, so context isn't burned on noise.
- **Prefer agent-ergonomic CLIs over raw CLIs and over MCP servers.** Compact structured
  output, and no tool schemas loaded for servers you never call.

---

## What's inside

### Hooks → `hooks/`

| File | What it does | The idea |
|---|---|---|
| [`ts-typecheck.sh`](hooks/ts-typecheck.sh) | After any `Edit`/`Write` of a `.ts`/`.tsx`/`.vue` file, finds the nearest `tsconfig`, runs `vue-tsc`/`tsc` (`--build` for project-references setups, `--noEmit` otherwise), filters errors to the file you just touched, and exits `2` to re-wake the model with them. | A self-healing edit loop. `exit 2` + `asyncRewake` hands the model its own compiler errors as the next thing it sees - so type breakage gets fixed in the same flow, not at PR time. |
| [`precompact.py`](hooks/precompact.py) | On `PreCompact`, gathers git state + test-run results (jest, vitest, pytest, go test, cargo test, …) + active todos mechanically, then calls `claude -p` to write a "problem / what was tried / findings / next steps" summary. Injects it as `additionalContext` and saves `.claude/compact/summary.md`. | Compaction is lossy. Mechanical extraction is cheap and reliable; the AI pass captures the *narrative* you'd otherwise lose. Belt and suspenders. |
| [`rename-plan.py`](hooks/rename-plan.py) | On `PostToolUse` for `Write`, renames a plan file written under `.claude/plans/` to a slug derived from its `# H1`. | Small quality-of-life: plans end up named for what they are. |
| [`prefer-gh-axi.py`](hooks/prefer-gh-axi.py) | On `PreToolUse` for `Bash`, **blocks** a raw `gh` invocation (exempting `gh auth`) and hands back the `gh-axi` form. | A stated preference is not a preference the model keeps. This is the one hook here that refuses a command, which is why it lives in its own opt-in component. |

`install.sh --hooks` copies the first three and merges their wiring into `settings.json` -
including `plansDirectory: ".claude/plans"` (kept only if you don't already set one) so the
plan-rename hook has somewhere to look. `install.sh --axi` adds `prefer-gh-axi.py` plus the
`SessionStart` briefings for the axi CLIs; it needs those CLIs installed
(see [`MANIFEST.md`](MANIFEST.md)), so it is off by default in the interactive menu.

### Statusline → `scripts/`

[`context-monitor.py`](scripts/context-monitor.py) renders model, directory, git branch +
dirty count, a **context-usage bar** (the native `used_percentage` when Claude Code reports
one, parsed from the transcript otherwise, color-shifting as you approach auto-compact), and
session **cost / duration / lines changed**. [`statusline-command.sh`](scripts/statusline-command.sh)
is a minimal alternative that just draws the context bar. The idea: make the two budgets you
actually run out of - **context** and **money** - impossible to ignore.

### Memory → `memory/`

A small, typed memory system. Each fact is one Markdown file with frontmatter
(`metadata.type: feedback | project | reference`), a body that states the rule plus **Why** and
**How to apply**, and `[[wikilinks]]` between related facts. [`MEMORY.md`](memory/MEMORY.md)
is the index loaded each session - one line per memory.

Claude Code memory is **project-scoped** (`~/.claude/projects/<slugified-cwd>/memory/`), so
`install.sh --memory` installs into the project you run it from. Override the target with
`MEMORY_PROJECT=/path/to/repo`. It never overwrites a memory file you already wrote, and it
appends to an existing `MEMORY.md` under a marker it can replace on the next run.

### Global instructions → `claude-md/global.md`

[The global `CLAUDE.md`](claude-md/global.md) - tool-output discipline, comment discipline,
writing style, the git workflow for team repos, technical decision-making, and the axi CLI
preference. `install.sh --claude-md` appends it to your `~/.claude/CLAUDE.md` under a
`# >>> claude-code-setup >>>` marker it can later update in place, leaving your own notes
untouched.

### Settings → `settings/machine.settings.json`

The wiring that ties the above together: `PostToolUse`/`PreCompact`/`PreToolUse` hooks
(including an inline guard that blocks edits to **any** `.env` file except `.env.example`-style
templates), the `axiHooks` block the `--axi` component merges, the statusline command, the
enabled plugins and their marketplace, and `plansDirectory`. The file contains **no permission
allowlist and no personal preferences** - it's safe to copy wholesale, and the installer merges
only the keys it owns, with your existing values winning on conflict.

### Skills → `skills/` and `MANIFEST.md`

Eighteen skills of mine, split by the workflow they belong to - see
[`skills/README.md`](skills/README.md). Everything I use but did not write is in
[`MANIFEST.md`](MANIFEST.md) instead: the axi CLIs, Cloudflare's platform skills, the official
plugins, `firstmate`, and a couple of honorable mentions.

---

## Layout

| Path | What it is |
|---|---|
| [`WORKFLOW.md`](WORKFLOW.md) | How I actually work day to day - the point of everything else |
| [`MANIFEST.md`](MANIFEST.md) | Skills and tools I use but did not write: install command + why |
| `install.sh` | Component installer - interactive or flag-driven, backup + merge, `--dry-run` |
| `claude-md/global.md` | Global instructions installed under a replaceable marker |
| `hooks/` | `ts-typecheck.sh`, `precompact.py`, `rename-plan.py`, `prefer-gh-axi.py` |
| `scripts/` | `context-monitor.py` statusline + a minimal alternative |
| `memory/` | `MEMORY.md` index + example typed memories (project-scoped installer) |
| `settings/machine.settings.json` | Hook/statusline/plugin wiring (no permissions, no personal prefs) |
| `skills/` | The eighteen skills I wrote |

## License

[MIT](LICENSE) - copy, adapt, and use any of this in your own setups.
