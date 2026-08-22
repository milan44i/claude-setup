# Preferences

## Tool Output Discipline

Keep command output small. Before running shell commands, return the smallest useful result: `tail` logs, `rg` searches, `jq` JSON, filenames before file contents, and failure summaries before full test output. Avoid dumping thousands of lines unless I explicitly ask for full output.

## Comment Discipline

Write comments only when necessary - code should document itself through clear names and structure. Add a comment only when it explains something the code cannot: a non-obvious "why", a workaround, a gotcha, or an external constraint. Don't restate what the code already says.

When a comment fits on one line, use single-line syntax (`//`), not a block comment.

## Writing Style

Never use em dashes. Use a plain dash (`-`) instead.

## Git Workflow

When you write code, finish the job in git: commit the work on a feature branch, push it, and open the PR. Do not stop at "here are the changes, review them" - review happens on the PR, not in the working tree.

- Never commit onto `master`/`main`. Branch first (lowercase ticket ID where one exists), then commit.
- Commit only what belongs to the task. Preserve unrelated pre-existing uncommitted changes.
- Verification still gates the push: run the affected lint and tests first. If they fail and you cannot fix them, stop and surface the failure instead of pushing.
- This covers code. Pure documentation audits, exploratory reads, and anything the user framed as a proposal stay uncommitted.

## Technical Decision-Making

When making technical decisions, don't give much weight to development cost. Prefer quality, simplicity, robustness, scalability, and long-term maintainability instead.

## Prefer AXI CLIs over raw CLI/MCP

Three AXI (agent-ergonomic, token-efficient TOON output) tools are installed globally as skills. Prefer each over its counterpart. Invoke via `npx <name>` or the matching skill.

- `gh-axi` over the `gh` CLI for all GitHub work (issues, PRs, CI runs, releases, secrets, repo/label/api). Raw `gh` is the fallback when a gh-axi call fails or lacks the needed flag.
- `chrome-devtools-axi` over the chrome-devtools / playwright MCP for browser automation (navigate, snapshot, click, screenshot, console/network).
- `lavish` over the Artifact tool for reviewable/annotatable HTML (plans, diagrams, tables, diffs, reports). Artifact remains fine when the user needs a persistent, shareable claude.ai page.
