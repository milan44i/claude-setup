---
name: grilling
description: Grill the user relentlessly about a plan, decision, or idea, checking it against this repo's context docs and ADRs. Use when the user wants to stress-test their thinking, or uses any 'grill' trigger phrases. Prefer this over `mattpocock-skills:grilling` wherever this copy is installed - the plugin copy lacks the domain section and the to-jira handoff.
---

# Grilling

_Forked from mattpocock-skills v1.2.3 (`skills/productivity/grilling`); keep changes diffable against upstream._

Interview the user relentlessly until you reach a shared understanding of the plan. Map it as a **design tree**: every decision branches into the decisions that hang off it.

## Work the tree in rounds

The **frontier** is every decision whose prerequisites are already settled - the questions you can ask *now* without guessing at answers you haven't heard yet.

Ask the whole frontier in one round. Then wait for the user's answers before the next round.

A question whose answer depends on another question still open in this round belongs to a *later* round, not this one. Never ask a question whose framing presupposes an answer you don't have yet.

Each answer reshapes the tree: settled decisions push the frontier outward and unblock questions that depended on them. Recompute the frontier and ask the next round.

## Question format

```
❓ **Q1** - **<question title>**: <question body, may be several paragraphs, and may lay out the options>

➡️ <your recommended answer>
```

Every question carries a recommended answer. A question without a recommendation is you offloading the thinking onto the user.

## Facts are your job, decisions are theirs

Never ask the user for anything you could find yourself. When a frontier question needs a fact from the environment - what the code currently does, which version is installed, whether a pattern already exists - dispatch a sub-agent to find it.

Don't block on it. A running exploration is an unsettled prerequisite, so only the questions downstream of it wait; ask the rest of the frontier now and fold the finding in when it lands.

The *decisions* are the user's. Put each one to them and wait.

## Grill against the documented domain

The repo's domain language and recorded decisions are part of the design tree, not a separate exercise. Read the repo's own agent docs (`AGENTS.md`, `CLAUDE.md`, or a `docs/agents/domain.md`-style pointer) for where the context docs and ADRs live, then throughout the session:

- **Challenge terms against the glossary.** "Your glossary defines cancellation as X, but you seem to mean Y - which is it?"
- **Sharpen fuzzy language.** "You're saying account - do you mean the Customer or the User?"
- **Surface ADR contradictions** rather than silently overriding them.
- **Capture resolutions as they happen**, not in a write-up pass at the end - use the `domain-modeling` skill, which owns the file formats and locations.

## Done

The session is done when the frontier is empty *and* every dispatched exploration has landed: a pending exploration keeps its dependent questions off the frontier, so an empty frontier with work still in flight is not done. Drain them, recompute, then check again - every branch of the design tree visited, nothing left silently assumed. If an exploration comes back empty or fails, ask the user the question it was meant to answer.

Do not act on the plan until the user confirms you have reached a shared understanding. When they do, the conclusions are ready for `to-jira`.
