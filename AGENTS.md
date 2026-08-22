# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

## What this repo is

A sanitized public mirror of one machine's `~/.claude`. The live machine is the source of the
content; this repo is the published, generalized copy. `install.sh` only goes one way
(repo → machine); there is no export path, so a change made live has to be brought back by
hand. `README.md` states the scope; `WORKFLOW.md` is the document the rest exists to serve.

## Two rules that gate every change here

- **This repo is public - publishing is the risk.** Before anything is pushed, sweep for
  employer identifiers (tracker host, project keys, internal repo/service/product names) and
  for live URLs whose only protection is obscurity. `skills/to-jira`, `skills/grilling` and
  `skills/grill-with-docs` are the files that historically carried employer detail; the
  `biz-*` / `restaurant-*` skills carry the owner's own business URLs and client names by his
  explicit choice - do not add more.
- **Never vendor a third-party skill.** Skills the owner did not write go in `MANIFEST.md` as
  an install command plus a line on why. A copy rots silently and publishes a fork nobody
  meant to maintain. The two exceptions in `skills/` (`grilling`, `grill-with-docs`) are
  substantial forks that name their upstream in-file and are kept diffable against it.

## Installer

`install.sh` is bash 3.2-compatible on purpose (stock macOS). Components:
`claude-md hooks statusline skills memory axi plugins`. Verify any change to it with a real
sandbox run, twice, checking idempotency:

```bash
CLAUDE_HOME=/tmp/cc MEMORY_PROJECT=/tmp/demo ./install.sh --all   # run it twice
```

Two traps it has already hit: `cp -R src dst` nests when `dst` exists (skills grew a
`<name>/<name>/` on the second run), and `memory/` is **project-scoped** under
`~/.claude/projects/<slugified-cwd>/memory/`, not global.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
