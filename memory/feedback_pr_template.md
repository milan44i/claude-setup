---
name: feedback-pr-template
description: Every PR must follow the structure of the repo's .github/PULL_REQUEST_TEMPLATE.md
metadata:
  type: feedback
---

Every PR MUST use the structure of the repo's `.github/PULL_REQUEST_TEMPLATE.md` for its description. Read the template before drafting and keep all of its headings and checklists intact.

**Why:** A PR opened without the template was flagged. Repos ship a template because it encodes what reviewers and CI expect; skipping it makes the PR harder to review and drops required sections.

**How to apply:**
- Before calling `gh pr create`, `Read` the repo's `.github/PULL_REQUEST_TEMPLATE.md` and use it as the body skeleton.
- Keep the ticket reference as the first line of the body (per [[feedback-pr-no-files-changed]] and whatever `[TICKET-ID]` convention the repo uses), then the template sections.
- Fill checklists honestly — mark only items actually done. Leave any "AI review" section with a placeholder if no review has run yet.
- Do not omit headings even if a section is N/A — write "N/A" instead.
- Combine with [[feedback-no-auto-commit]]: still need explicit per-prompt authorization to push / open PRs.
