# MANIFEST - skills and tools I use but did not write

Everything in [`skills/`](skills/) is mine. Everything below is somebody else's, and it is
listed rather than vendored: a copied skill rots silently, and publishing a fork I never meant
to maintain is worse than publishing a link.

Install commands are what I actually run. `npx skills` is the
[Skills CLI](https://github.com/vercel-labs/skills); `/plugin` commands are Claude Code's own.

---

## Agent CLIs (npm)

These replace their conventional counterparts - see
[WORKFLOW.md → the axi CLIs](WORKFLOW.md#the-axi-clis-over-raw-clis-and-over-mcp). Each npm
package ships its own skill, so installing the package is installing the skill.

```bash
npm i -g gh-axi chrome-devtools-axi lavish-axi
npm i -g no-mistakes
```

| Tool | Why I use it |
|---|---|
| **`gh-axi`** - [npm](https://www.npmjs.com/package/gh-axi) | Every GitHub operation: issues, PRs, CI runs, releases, labels, raw API. Compact structured output instead of prose, so a PR review costs a fraction of the context `gh` does. Raw `gh` is blocked by a hook so I do not backslide. |
| **`chrome-devtools-axi`** - [npm](https://www.npmjs.com/package/chrome-devtools-axi) | Real-browser work: navigate, snapshot, click, screenshot, console/network. Preferred over the chrome-devtools and playwright MCP servers, whose tool schemas load into every session whether or not I open a browser. |
| **`lavish-axi`** - [npm](https://www.npmjs.com/package/lavish-axi) | Turns a plan, comparison or report into an HTML page I can annotate in the browser and send feedback back from. The review loop for anything visual. |
| **`no-mistakes`** - [npm](https://www.npmjs.com/package/no-mistakes) | A local gate in front of the push target: review, test, lint, docs, push, PR, CI. Same instinct as the hooks in this repo, run as a pipeline instead of per-edit. |

**`firstmate`** - [github.com/kunchenguid/firstmate](https://github.com/kunchenguid/firstmate)

The orchestration layer the whole workflow now runs through. It dispatches tasks to agents in
disposable git worktrees, each reporting state back on a status file, so several jobs run in
parallel without ever sharing a checkout. Not mine, public, and the reason the worktree
discipline in WORKFLOW.md stopped being optional.

---

## Cloudflare's own skills

```bash
npx skills add cloudflare/skills --skill cloudflare
npx skills add cloudflare/skills --skill cloudflare-email-service
npx skills add cloudflare/skills --skill wrangler
```

| Skill | Why I use it |
|---|---|
| **`cloudflare`** | The personal side of the business deploys entirely onto Cloudflare Pages and Workers; this is the platform map, and it retrieves from live docs rather than trusting pre-training. |
| **`cloudflare-email-service`** | Transactional email for the one sold product that sends any (Email Sending + Email Routing, SPF/DKIM/DMARC). |
| **`wrangler`** | Every deploy is a local `wrangler` invocation - there is no CI deploy anywhere in the personal tree - so correct current flags matter more than usual. |

---

## Bundled and standalone skills

| Skill | Source | Why I use it |
|---|---|---|
| **`pdf`** | Anthropic, ships with Claude | Reading, merging, splitting and filling PDFs. Client menus and price lists arrive as PDFs. |
| **`find-skills`** | [vercel-labs/skills](https://github.com/vercel-labs/skills) - `npx skills add vercel-labs/skills --skill find-skills` | The discovery half of the Skills CLI: how everything else on this page got found. |
| **`grill-me`** | [mattpocock-skills](https://github.com/mattpocock/skills) plugin - `/plugin install mattpocock-skills@claude-plugins-official` | The plain grilling entry point when there is no repo domain to grill against. |
| **`notebooklm`** | [teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py) - `pip install notebooklm-py` | Programmatic Google NotebookLM: build a notebook from a pile of sources and query it. How a knowledge base gets loaded without clicking through the web UI. |

---

## Plugins (official marketplace)

```bash
claude plugin marketplace add anthropics/claude-plugins-official
```

`settings/machine.settings.json` carries the full enabled set, and `./install.sh --plugins`
merges it in (my choices lose to yours on conflict). The ones that carry real weight:

| Plugin | Why |
|---|---|
| `mattpocock-skills` | Upstream of the two forks in [`skills/`](skills/) - `grilling` and `grill-with-docs` - plus `grill-me`, `tdd`, `diagnosing-bugs`, `domain-modeling`. My forks say what they changed and are kept diffable against it. |
| `atlassian` | The Jira MCP that `to-jira`, `implement-ticket` and `ticket-code-consistency` all call. |
| `chrome-devtools-mcp`, `playwright` | Installed, but `chrome-devtools-axi` is preferred for browser work. |
| `code-review`, `code-simplifier`, `security-guidance`, `feature-dev` | Review and refactor passes. |
| `frontend-design` | Used directly by `biz-site` and `restaurant-site` when styling a bespoke theme. |
| `context7`, `typescript-lsp`, `skill-creator`, `superpowers`, `claude-md-management`, `claude-code-setup`, `vercel` | Everyday support. |

---

## Honorable mentions

Used occasionally, not part of any loop. Listed for completeness, not vendored.

| Skill | Source | What it does |
|---|---|---|
| **`caveman`** | [mattpocock/skills](https://github.com/mattpocock/skills) - dropped from the plugin as of v1.2.3, so mine is a local copy | Ultra-compressed output mode: drops articles, filler and pleasantries, keeps the technical content. Roughly a 75% cut when I am watching the token budget rather than reading for pleasure. |
| **`humanizer`** | [blader/humanizer](https://github.com/blader/humanizer) (MIT) - `npx skills add blader/humanizer` | Strips the tells of AI-written prose, using Wikipedia's "Signs of AI writing" as its checklist. I run it over anything a client will read. |
