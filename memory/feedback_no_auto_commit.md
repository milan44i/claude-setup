---
name: NEVER auto-commit
description: NEVER run git commit without an explicit request in the CURRENT prompt — even follow-up/"do the same" tasks require fresh confirmation
type: feedback
originSessionId: <session-id>
---
**NEVER run `git commit` (or `git add` with intent to commit) unless the user has explicitly asked to commit IN THE CURRENT PROMPT.**

**Why:** User wants to see every change before it lands in git history. The user was explicit and emphatic: "NEVER COMMIT ON YOUR OWN, i want to see the changes first."

**How to apply:**
- After making code changes, STOP. Report what was done and what files changed. Do not stage, do not commit.
- A prior prompt's instruction to commit does NOT carry forward. Each commit requires its own explicit authorization in the current message.
- Phrases like "do the same thing", "do X for Y now", "continue", or "apply the same pattern" are NOT commit authorization — they refer to the code-change work, not the git action.
- An open PR does NOT mean follow-up work is auto-commit-authorized. "Add tests", "fix the lint", "also do Y" after a PR was created still require explicit commit/push authorization in the current message.
- Only commit when the user writes words like "commit", "commit this", "make a commit", or asks for a PR (which implies commit).
- When in doubt, ASK before committing. Cost of asking is low; cost of an unwanted commit is non-trivial rework.
- This also covers: do not run `git push`, do not create PRs via `gh pr create`, unless explicitly asked in the current prompt.
