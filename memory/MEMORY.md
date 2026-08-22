# Memory

The index loaded each session - one line per memory, newest context at a glance.
Each linked file holds **one fact** with frontmatter (`metadata.type: feedback | project | reference`),
the rule, and **Why** / **How to apply**. Facts link to each other with `[[wikilinks]]`.

Both of these are real, reusable preferences - `./install.sh --memory` copies them into
the current project's memory dir, and you can adapt them per project.

## Pull requests

- [No files-changed list in PR descriptions](feedback_pr_no_files_changed.md) - reviewers
  see diffs natively; restating them is noise.
- [Follow the repo's `PULL_REQUEST_TEMPLATE.md`](feedback_pr_template.md) - read it before
  drafting; keep every heading and checklist.
