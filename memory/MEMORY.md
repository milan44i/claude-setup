# Memory

The index loaded each session — one line per memory, newest context at a glance.
Each linked file holds **one fact** with frontmatter (`metadata.type: feedback | project | reference`),
the rule, and **Why** / **How to apply**. Facts link to each other with `[[wikilinks]]`.

These three are real, reusable preferences — copy them into a project's memory dir and adapt.

## Workflow

- [NEVER commit or push without explicit ask](feedback_no_auto_commit.md) — STRICT: no
  `git commit` / `git push` / `gh pr create` unless authorized in the CURRENT prompt.
  "Do the same" does NOT carry authorization forward.

## Pull requests

- [No files-changed list in PR descriptions](feedback_pr_no_files_changed.md) — reviewers
  see diffs natively; restating them is noise.
- [Follow the repo's `PULL_REQUEST_TEMPLATE.md`](feedback_pr_template.md) — read it before
  drafting; keep every heading and checklist.
