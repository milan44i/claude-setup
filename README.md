# claude-setup

A working [Claude Code](https://claude.com/claude-code) setup you can install piece by piece:
hooks that make the model fix its own type errors and keep context across compaction,
a statusline that shows your context/cost budget, a memory discipline, and the settings
that wire it all together.

Everything here is something I actually run. Copy the whole thing or cherry-pick a part.

```bash
git clone https://github.com/milan44i/claude-setup
cd claude-setup
./install.sh                       # interactive checklist
```

```bash
./install.sh --all                 # everything, no prompts
./install.sh --hooks --statusline  # just these
./install.sh --all --dry-run       # show every action, change nothing
```

**The installer is built to be safe to run on a machine you already use:**
it **backs up** `settings.json` and `CLAUDE.md` before touching them, **merges** instead of
overwriting (your existing keys win), is **idempotent** (re-running never duplicates hook
entries), and **does not install my permission allowlist** — only hook/statusline/plugin
wiring. Install into a sandbox first with `CLAUDE_HOME=/tmp/cc ./install.sh --all`.
Runs on stock macOS bash 3.2.

---

## Principles

The setup exists to enforce a few opinions:

- **Capture context deterministically — don't trust the model to remember.** A `PreCompact`
  hook snapshots branch, modified files, test results, todos, and an AI-written summary
  *before* compaction throws context away.
- **Make the model fix its own mistakes.** A `PostToolUse` hook type-checks every edit and,
  on failure, wakes the model with the exact errors so it self-corrects before moving on.
- **Memory is a filesystem, not a vibe.** Preferences and project facts live in small,
  typed Markdown files with an index — greppable, reviewable, and linkable.
- **Keep tool output small.** The global `CLAUDE.md` pushes for `rg`/`jq`/`tail` and
  failure-summaries-first, so context isn't burned on noise.
- **Never commit or push without being asked in the current turn.** Encoded as memory and
  honored by the whole setup.

---

## What's inside

### Hooks → `hooks/`

| File | What it does | The idea |
|---|---|---|
| [`ts-typecheck.sh`](hooks/ts-typecheck.sh) | After any `Edit`/`Write` of a `.ts`/`.tsx`/`.vue` file, finds the nearest `tsconfig`, runs `vue-tsc`/`tsc`, filters errors to the file you just touched, and exits `2` to re-wake the model with them. | A self-healing edit loop. `exit 2` + `asyncRewake` hands the model its own compiler errors as the next thing it sees — so type breakage gets fixed in the same flow, not at PR time. |
| [`precompact.py`](hooks/precompact.py) | On `PreCompact`, gathers git state + test-run results + active todos mechanically, then calls `claude -p` to write a "problem / what was tried / findings / next steps" summary. Injects it as `additionalContext` and saves `.claude/compact/summary.md`. | Compaction is lossy. Mechanical extraction is cheap and reliable; the AI pass captures the *narrative* you'd otherwise lose. Belt and suspenders. |
| [`rename-plan.py`](hooks/rename-plan.py) | Renames a written plan file to a slug derived from its `# H1`. | Small quality-of-life: plans end up named for what they are. |

`install.sh --hooks` copies these and merges their wiring into `settings.json`.

### Statusline → `scripts/`

[`context-monitor.py`](scripts/context-monitor.py) renders model, directory, git branch +
dirty count, a **context-usage bar** (parsed from the transcript, color-shifting as you
approach auto-compact), and session **cost / duration / lines changed**.
[`statusline-command.sh`](scripts/statusline-command.sh) is a minimal alternative that just
draws the context bar. The idea: make the two budgets you actually run out of — **context**
and **money** — impossible to ignore.

### Memory → `memory/`

A small, typed memory system. Each fact is one Markdown file with frontmatter
(`type: feedback | project | reference`), a body that states the rule plus **Why** and
**How to apply**, and `[[wikilinks]]` between related facts. [`MEMORY.md`](memory/MEMORY.md)
is the index loaded each session — one line per memory.

The examples here are real preferences:
[no auto-commit](memory/feedback_no_auto_commit.md),
[PR descriptions without a files-changed list](memory/feedback_pr_no_files_changed.md),
[follow the repo's PR template](memory/feedback_pr_template.md).

> Claude Code memory is **project-scoped** (it lives under `~/.claude/projects/<cwd>/memory/`),
> so the installer does **not** inject these globally. Treat them as a copyable convention:
> drop adapted versions into a project's memory dir and keep `MEMORY.md` as the index.

### Global instructions → `claude-md/global.md`

[The global `CLAUDE.md`](claude-md/global.md) — short on purpose. One rule: keep command
output small. `install.sh --claude-md` appends it to your `~/.claude/CLAUDE.md` under a
`# >>> claude-code-setup >>>` marker it can later update in place, leaving your own notes
untouched.

### Settings → `settings/machine.settings.json`

The wiring that ties the above together: `PostToolUse`/`PreCompact`/`PreToolUse` hooks
(including an inline guard that blocks edits to `.env.local`/`.env.test`/`.env.mock`),
the statusline command, and the enabled plugins. The installer merges the **safe** keys
only — it intentionally skips the permission allowlist so you don't inherit a wide-open
`Bash(*)` policy.

### Skills → `skills/`

One skill of my own plus a curated list of the community skills I lean on — see
[`skills/README.md`](skills/README.md).
[`fix-pr-comments`](skills/fix-pr-comments/SKILL.md) fetches PR review comments via `gh`,
classifies each as **FIX** (bugs, security, broken tests) or **SKIP** (taste, out-of-scope),
fixes the legitimate ones, and reports a resolution summary. `install.sh --skills` installs it.

---

## Layout

| Path | What it is |
|---|---|
| `install.sh` | Component installer — interactive or flag-driven, backup + merge, `--dry-run` |
| `claude-md/global.md` | Global instructions (tool-output discipline) |
| `hooks/` | `ts-typecheck.sh`, `precompact.py`, `rename-plan.py` |
| `scripts/` | `context-monitor.py` statusline + a minimal alternative |
| `memory/` | `MEMORY.md` index + example typed memories |
| `settings/machine.settings.json` | Hook/statusline/plugin wiring (permissions intentionally excluded) |
| `plugins/enabled.json` | The official-marketplace plugins I enable |
| `skills/` | `fix-pr-comments` + a curated list of skills I rely on |

## License

[MIT](LICENSE) — copy, adapt, and use any of this in your own setups.
