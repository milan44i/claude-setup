---
name: PR descriptions — no files-changed list
description: Don't include a "files changed" list in PR descriptions; reviewers see the file diffs natively in GitHub
type: feedback
originSessionId: <session-id>
---
**Do not include a list of changed files in PR descriptions.**

**Why:** GitHub already shows file diffs in the PR; restating them is redundant and clutters the description. The user explicitly objected to seeing the list duplicated in the body.

**How to apply:**
- PR body should cover *what changed and why* (Summary) and *how to verify* (Test plan), not which files.
- Same applies to Jira ticket descriptions when summarizing the implementation — skip the files list.
- File-level call-outs are still fine when they carry information the diff doesn't (e.g. "legacy modal kept in sync"), but don't enumerate every modified path as a checklist.
