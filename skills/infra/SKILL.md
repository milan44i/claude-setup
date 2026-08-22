---
name: infra
description: Account-level infrastructure map + runbook for Milan's demo-selling business (12 biz vertikala + restorani + kartice-ponuda) - Cloudflare Pages branch-deploy model, Workers side (kartice-ponuda, kartica-44), GitHub/milan44i conventions, domains & email, pruning and cap management, automation schedule. Use for "infra", "gde je X deployovan / hostovan", "kako se deployuje", "koliko projekata imamo", account-level wrangler operations (create/delete Pages projects, cap check, prune), CONVERT go-live infrastructure, and questions about the autopilot's schedule. NOT for generic Cloudflare/Wrangler platform questions - use the cloudflare/wrangler skills for those.
---

# infra

The single source for **account-level** infrastructure of the demo-selling business: the
12 biz verticals + restorani + kartice-ponuda. Per-flow build/deploy steps live in
`biz-site` / `restaurant-site`; this skill owns what no other doc owns - the account map,
the cross-cutting runbook, and the decision records.

**Freshness rule:** conventions and decisions below are stable prose. Counts, lists, and
states are volatile - NEVER trust a number written in a file (including this one); run the
command that answers the question (see Live facts).

## 1. Account map

- One Cloudflare account, wrangler **OAuth-logged-in on this machine** (`<your-gmail>`).
  There is no CF API token secret anywhere - all deploys are local wrangler, no CI deploys exist.
- **Pages cap: 100 projects per account** (hard, "not routinely increased"). Hit on
  2026-08-15; that event produced the branch-deploy model below.
- **Demos are branch deployments on ONE shared Pages project per vertical** (since
  2026-08-15): URL `https://<slug>.<projekat>.pages.dev`. Project = vertical dir from
  `~/work/projekti/VERTICALS.md`; the ONLY exception is `saloni` → project **`beauty-saloni`**
  (name `saloni` globally taken on pages.dev). Restorani use project `restorani`;
  kartice-ponuda demos use project `kartice-ponuda`.
- Every shared project's production branch is the **reserved `prod`** - nothing ever
  deploys to it, so a forgotten `--branch` lands as a harmless `main` preview instead of
  overwriting anything.
- Each client repo's `src/data/site.json` config carries the deploy target:
  `cfProjectName` (the shared project) + `cfBranch` (the slug). Sold sites have
  `cfProjectName: <slug>` and NO `cfBranch`.
- **Legacy fleet:** demos pitched before 2026-08-15 (~75 of them) live on dedicated
  per-slug projects (`<slug>.pages.dev`). Their URLs are in sent emails/DMs - they keep
  their projects until the account genuinely runs out of room (see Prune policy).
- **Sold sites** always get a dedicated Pages project + custom domain at CONVERT time.
- **`sajt-analiza`** - shared Pages project outside the vertical scheme: per-lead
  site-analysis reports deploy as branch deployments (`<slug>.sajt-analiza.pages.dev`,
  `scripts/deploy-all.sh` in the repo), and branch **`poruke`** is Milan's mobile outreach
  board `https://poruke.sajt-analiza.pages.dev/` - the surface he sends Viber pitches
  from. A demo counts as done only when it appears there (odluka 2026-08-19); rebuild via
  collect -> `build-phone.mjs` -> deploy branch `poruke` (repo `~/work/projekti/sajt-analiza`;
  collect.mjs derives verticals dynamically from PIPELINE.md presence). Branch **`kokpit`**
  on the same project is the funnel dashboard `https://kokpit.sajt-analiza.pages.dev/`
  (kandidati/build/ponude/follow-up + autopilot health, laptop-first, read-only, noindex
  like the board); regenerate + deploy via `~/work/projekti/funnel/deploy-kokpit.sh` after
  `funnel.mjs --html` (night autopilot step 8 and the biz-kokpit skill both do this).

## 2. Workers side

- **`kartice-ponuda`** (Worker, assets-only SPA from `~/work/projekti/kartice-ponuda`): serves
  the three SENT cafe pitches - one route per cafe (`/<cafe-slug>`, names in the repo's
  router) plus `/demo/*` - as routes on one Worker. **These URLs are frozen** (sent
  2026-08). Future cafes deploy as branches on the `kartice-ponuda` Pages project instead:
  `<cafe>.kartice-ponuda.pages.dev`. Deploy conventions: repo README.
- **`kartica-44`** - the SOLD production stack that kartice-ponuda demos sell deployments
  of: Worker (SPA + `/api/*`), D1 `kartica-db`, daily cron `0 7 * * *`, transactional
  email via `info@kartica.<your-domain>` (EMAIL_MODE=live), customer-facing domain
  `kartica.<client-domain>`. A kartice go-live = a fresh deployment of this stack for
  the new cafe (own Worker name, own D1, own sender address). Deep detail: `~/work/projekti/44-kartica`.
- Out of scope for this skill: `sitescore`/seo-checker and anything in the day-job workspace (`~/work/<employer>`) (`sajt-analiza` IS in scope - see Account map).

## 3. GitHub model

- Account **`milan44i`**; one **private** repo per client site, scaffolded from the engine.
  Pushing is backup only - **it never deploys** (GitHub Actions retired 2026-07-13; no CI
  anywhere in the business).
- Engines (`biz-engine`, `restorani/restaurant-engine`) take changes via feature branch →
  push (pre-push hook runs `pnpm verify` - never `--no-verify`) → PR → merge. Engine work
  happens in a dedicated git worktree, never the shared checkout.
- All GitHub operations through `gh-axi`.
- **Actions leftovers burn storage:** GitHub emailed 2026-08-16 that milan44i hit 90% of
  the free 0.5 GB Actions storage (resets monthly; overage BILLS unless a $0 Actions
  budget is set in account billing - Milan's manual step, still pending as of 2026-08-17).
  CI was retired 2026-07-13, but client repos scaffolded before then still carry workflow
  files, so every backup push can trigger runs and store artifacts. When touching an old
  client repo, check for `.github/workflows/` and delete it in the same commit.
  - **The `gh` token has no `workflow` OAuth scope** (`gh auth status` → only
    `admin:public_key, gist, read:org, repo`). GitHub hard-requires the `workflow` scope
    to create/update/delete anything under `.github/workflows/` via the REST API *or*
    an HTTPS git push - those calls 404 (masked, not a clear permission error). Git
    operations protocol is **ssh** though, and SSH pushes are not scope-gated, so to
    remove leftover workflow files: clone via `git@github.com:milan44i/<repo>.git`,
    `git rm -r .github/workflows`, commit, `git push origin HEAD:<default-branch>`.
    Don't burn time retrying the API route for this specific path.
  - Only **artifacts** count toward the storage quota, not workflow run records/logs
    (GitHub purges run log data itself after ~90 days regardless). Full 2026-08-17 sweep
    of all 145 milan44i repos found artifacts in exactly one place - **162 artifacts
    (~700MB live, rest already expired) in `gamescore`** - now deleted via
    `DELETE /repos/{owner}/{repo}/actions/artifacts/{id}`; every other repo was already
    at 0. If this recurs, check artifacts account-wide before assuming it's spread out.
  - `gh-axi api DELETE` on `actions/runs/{id}` appears to only succeed for the most
    recent run per repo, then 404s on older ones - matches "log data already purged",
    not worth fighting with retries.
  - 12 repos had leftover `.github/workflows/` as of 2026-08-17 (cleaned): 7 client
    demos (workflows removed, and Actions also disabled via
    `PUT actions/permissions {enabled:false}`) plus 5 personal/legacy repos
    (workflows removed, Actions left enabled since they're not client repos).
    The engine repos and `funnel` were clean. Re-derive the current list from the
    account rather than from this note - run the sweep, don't trust these counts.

## 4. Domains & email

- Sold clients: **Milan pays for and manages the domain end to end** through his own
  registrar account (cost absorbed in the retainer); the **business is named registrant**
  so the domain is legally theirs (odluka 2026-08-16; .rs goes through RNIDS-accredited
  registrars, ~2500 RSD/yr). Domain points at the client's dedicated Pages project.
  Commercial acceptance playbook: `~/work/projekti/terenska-prodaja/ONBOARDING.md`.
- **`<your-domain>`** is Milan's own domain - used for email senders
  (`info@kartica.<your-domain>` via Cloudflare/Resend) and the odd demo alias
  (exactly one demo carries a Pages custom domain on a subdomain of it).
- 44-kartica memory notes a Resend key + custom-domain work still pending for that app.

## 5. Runbook (cross-cutting ops - nobody else owns these)

```bash
# How many Pages projects are we using? (cap is 100)
npx wrangler pages project list | grep -c 'pages.dev'
```

```bash
# Create a shared vertical project (only if a NEW vertical appears; all current ones exist)
npx wrangler pages project create <dir> --production-branch prod
```

```bash
# Deploy a demo (from its repo; values from src/data/site.json config)
pnpm build && npx wrangler pages deploy dist --project-name=<cfProjectName> --branch=<cfBranch> --commit-dirty=true
```

```bash
# Deploy the kartice-ponuda Worker (the three frozen sent URLs)
cd ~/work/projekti/kartice-ponuda && npm run deploy
```

```bash
# Prune a Pages project (POLICY GATE FIRST - see below)
npx wrangler pages project delete <name> --yes
```

```bash
# Disk janitor: reclaim node_modules/dist from client repos idle 30+ days (dry-run; add --apply)
~/work/projekti/.claude/skills/infra/janitor.sh
```
The janitor never touches engines (`restaurant-engine`, `salon-engine`) or dirty repos;
everything it deletes restores with `pnpm install && pnpm build`. A monthly scheduled task
(`infra-janitor-monthly`) runs it with `--apply` and reports.

**Prune policy:** a dedicated demo project may be deleted ONLY if its PIPELINE.md row says
`odbili`, or the demo was never pitched (Ponuda poslata `-`). Anything `pending` has its
URL in a sent message - a late reply must not hit a dead link. Sold sites and shared
vertical projects are never deleted. When pruning an odbili row, strike the URL through in
PIPELINE.md with `(projekat obrisan <datum>)`.

**CONVERT infra steps** (the account-level part; full flow in the site skills): create
dedicated project `npx wrangler pages project create <slug> --production-branch main`, set
`site.json` `cfProjectName: <slug>` + remove `cfBranch`, attach the custom domain, deploy
without `--branch`.

## 6. Live facts - which command answers which question

| Question | Command |
|---|---|
| Where is demo X? | `cfProjectName`/`cfBranch` in its repo's `src/data/site.json`, or its PIPELINE.md row |
| Project count / cap headroom | `npx wrangler pages project list \| grep -c 'pages.dev'` |
| What Workers/configs exist? | `find ~/work/projekti -maxdepth 3 -name 'wrangler.*' -not -path '*/node_modules/*'` |
| D1 / KV / R2 state | `npx wrangler d1 list` / `kv namespace list` / `r2 bucket list` |
| A project's deployments | `npx wrangler pages deployment list --project-name=<p>` |
| Scheduled agents + state | `scheduled-tasks` MCP list (or `/schedule`) |
| Vertical → dir/project mapping | `~/work/projekti/VERTICALS.md` |

## 7. Decision records

- **2026-08-15 - branch-deploy model.** The 100-project cap blocked a build (bros-gyros).
  4 odbili projects pruned, 16 never-pitched + 3 blocked builds migrated to branches, all
  12 vertical projects created. Branch deployments are unlimited → scales past 1000 demos
  at zero cost. Engines PR #75 (biz) / #117 (restaurant).
- **Reserved `prod`** production branch: makes a forgotten `--branch` harmless.
- **Never Vercel:** free tier disallows commercial use; Pro pricing doesn't scale against
  small monthly retainers. Cloudflare Pages/Workers only.
- **Local wrangler deploys only, no CI:** no tokens to leak, the OAuth login is the whole
  auth story; a push is never a deploy.
- **Demos are unlisted:** `indexable: false` (noindex + robots Disallow), never shared
  beyond the owner.

## 8. Automation (state stamped 2026-08-15 - verify live before relying on it)

Claude Code scheduled tasks in `~/.claude/scheduled-tasks/<id>/SKILL.md` (prompts live
there - never restate them):

- `biz-autopilot-night` - 00:00 except Monday, **enabled**: pick 9 candidates, BATCH build + unlisted deploy, report to AUTOPILOT.md, no sending.
- `biz-scout-weekly` - Monday 00:05, **enabled**: refill CANDIDATES.md across all 13 verticals, no builds.
- `biz-followup-morning` - 08:06 daily, **disabled** (2026-08-16: pitch channel switched to Viber + brat door-to-door, NO email; briefly re-enabled earlier that day, then turned off with the channel switch): read-only detection of due follow-ups (7/14/21 ladder).
- `infra-janitor-monthly` - 1st of month 09:00, **enabled** (added 2026-08-16): runs `janitor.sh --apply`, reports reclaimed disk.
- Kill switch for the biz pipeline tasks: `touch ~/work/projekti/funnel/AUTOPILOT-PAUSE` (does not affect the janitor).

## Single-source map (who owns what)

- Generic Cloudflare/Wrangler platform knowledge → `cloudflare` / `wrangler` skills.
- Per-flow build/QA/deploy/CONVERT steps → `biz-site` / `restaurant-site` / `polish-design`.
- Vertical → dir mapping, prices, statuses → `~/work/projekti/VERTICALS.md` + each `VERTICAL.md`/`PIPELINE.md`.
- Account-level model, runbook, decisions, automation map → THIS skill.

**Maintenance:** any change to the hosting model, account conventions, or automation set
updates this file in the same commit/session as the change itself.
