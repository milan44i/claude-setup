---
name: restaurant-site
description: Build, update, and sell bespoke restaurant websites on the restaurant-engine. Researches a restaurant, derives a story-first design DNA, builds a one-of-one demo, deploys to Cloudflare Pages, and maintains client sites. Modes - BUILD (new restaurant), BATCH (list of restaurants, no-stop auto-pick), UPDATE (existing client change), CONVERT (demo sold, go live).
---

# restaurant-site

Productized pipeline for Milan's restaurant-website service. The reusable code lives in the engine repo; this skill is the process around it.

**Path root: everything lives under `~/work/projekti/restorani/`** - the engine, every client repo, `PIPELINE.md`, `batches/`, `pitch-template.md`. If that directory moves again, this line is the only place the root is defined.

**The design promise: no two sites look alike.** Every client gets a bespoke theme derived from their own story - the engine provides the shared skeleton (data model, primitives, i18n, SEO, deploy), the theme provides a one-of-one face. Uniqueness is a byproduct of specificity: every design decision traces to a researched fact about this restaurant, never to generic taste.

**Engine**: `~/work/projekti/restorani/restaurant-engine` (GitHub: `milan44i/restaurant-engine`, private). Read its `README.md` for the data contract before touching data files. Bespoke themes compose the engine's shared primitives and are committed back to the engine with a fingerprint registry entry - the library compounds, and the engine's local gate (`pnpm verify` - affected themes per change, `pnpm verify:full` for the full matrix; GitHub Actions retired 2026-07-13, no CI exists) builds affected themes on each change. The engine ships the pipeline scripts: `new-site.mjs`, `import-theme.mjs`, `scrape-menu.mjs`, `qa.mjs` - **use them instead of doing their work by hand**.

**Never trigger a permission dialog in an unattended run (Milanova odluka 2026-08-20).** The night autopilot builds while Milan is asleep; a dialog does not slow the run, it **kills** it - the agent blocks until morning and the batch dies. `Bash(*)`, `WebFetch(*)` and `WebSearch(*)` are already granted, so ordinary work never prompts. Two things still do, and both are avoidable:
- **No browser against a third-party domain.** Browser navigation asks per-domain approval ("Allow Claude to act on https://..."), which no allow-rule covers. Read pages with `curl` or `WebFetch`. For competitor page-weight, `curl -sL -o /dev/null -w '%{size_download}'` on the HTML plus each parsed subresource gives size and request count with no browser - label it "curl-measured". Un-measurable without a browser → skip and flag, never block. Driving your OWN built `dist` through the local QA server is fine (localhost, no dialog).
- **No shell command that trips a built-in safety heuristic** - these fire regardless of permission rules. Never `rm` with a **variable-plus-glob** path (`rm -f $P/*.jpg` is read as possibly-empty and flagged, since empty `$P` expands to `/*.jpg`); `cd` first and use a literal relative path (`rm -f src/assets/photos/*.jpg`). Never `rm -rf` an interpolated path - prefer `find <literal-dir> -maxdepth 1 -name '*.jpg' -delete`, or just overwrite. Keep deletions inside the client repo or batch dir.
A dialog you hit is a defect in your command, not something to wait on - rewrite it in a form that does not prompt.

**Hard rules (business-wide, no exceptions):**
- Hosting is **Cloudflare Pages, never Vercel** - Vercel's free tier disallows commercial use and Pro doesn't scale against €50/month retainers.
- **Deploys are local `wrangler pages deploy` - always** (decision 2026-07-07). There is no CI deploy and no CF token secret anywhere; wrangler is OAuth-logged-in on this machine. Pushing to GitHub backs up code, it does NOT deploy. Never report a change as live without having run the deploy and verified the URL.
- One private GitHub repo per client under `milan44i/`, scaffolded from the engine.
- Demos are unlisted: `indexable: false` (noindex + robots Disallow), `*.pages.dev` URL, never shared beyond the owner.
- All GitHub work through `gh-axi`, browser work through `chrome-devtools-axi`.
- Prices, hours, addresses, and menu items are facts: transcribe, never invent. If a fact can't be verified, leave it out and flag it in the dossier.
- **Flat price for every scope: €400 setup + €50/month.** Scope is judged per dossier, price is not. A large fine-dining build at flat price is an accepted loss-leader (portfolio value); the dossier gate is where proposed scope gets sanity-checked against flat revenue.
- **Generative vs locked:** everything the eye sees is generated per restaurant (layout archetype, hero pattern, typography, palette, texture/graphic language, imagery treatment, menu presentation, micro-motion). Everything the crawler, screen reader, and maintainer see is engine-locked (content model, image-slot semantics, sr/en, SEO/JSON-LD/llms.txt, a11y floor, near-zero-JS perf budget, responsive rails). No bespoke JS per site.

## Mode detection

| Request looks like | Mode |
|---|---|
| "make a site/demo for <restaurant>" | BUILD |
| "update X's menu / hours / photos" | UPDATE |
| "<restaurant> bought it / go live / connect domain" | CONVERT |
| "here is a list of restaurants / build demos for all of these" | BATCH |

"Polish X / X looks unprofessional / make X more beautiful" is not an UPDATE - route it to
the sibling `polish-design` skill (page-by-page design pass on an already-deployed site).

---

## BUILD mode

Pipeline: research → design DNA directions → dossier (auto-pick recommended) → build bespoke theme → QA → deploy unlisted → report. **No human checkpoint - the flow runs end to end without stopping.** The dossier is still produced as the build record; the recommended direction is selected automatically, and anti-convergence stays guaranteed by the registry veto (§2), not by a human pick.

### 1. Research

Sweep every reachable source. Sources split into four use-tiers with different rules:

**A. Facts** (name, address, phone, hours, menu, prices):
- **Google Maps listing**: exact name, address, phone, hours, price level, review themes, photo inventory, and the listing's **Menu panel + menu-card photos** - a REQUIRED check on every research pass, same rank as the website and delivery platforms. If the listing carries a menu (extracted panel or photographed card), transcribe it: the **photos of the physical card are the authority**, Google's extracted menu is OCR and has shifted prices by a row and dropped add-on items before (Kroasanterija 2026-08-10) - cross-check every price against the card photo. Caution: Maps has reCAPTCHA-blocked automated sweeps before - if blocked, switch to web search + direct page fetches rather than retrying; login-walled surfaces (IG) go through Milan's Chrome (claude-in-chrome), public Google through chrome-devtools-axi.
- **Existing website** (if any): scrape all copy, menu (often an image/PDF - download it), photos (note originals' URLs), structure. Measure it while you're there (see rebuild rubric).
- **Delivery platforms** (Wolt, Glovo, Donesi.rs): best structured-menu source with prices. For Wolt, `node scripts/scrape-menu.mjs <venue-url>` extracts the whole menu into a draft `menu.json` - no vision pass needed. Gotcha (Cezar run): delivery listings can carry stale lower prices vs the dine-in card - reconcile against a photographed physical menu when available, flag discrepancies.
- **Directories** (TripAdvisor, Restaurant Guru, 011info, local listings): hours/contact cross-checks. Hours often conflict across directories - always flag, never pick silently.
- Verify load-bearing facts against at least two sources; discrepancies go in the dossier as open questions for the owner, not silent guesses.

**B. Story** (feeds the design brief and all copy):
- Review text mining across all platforms: signature dishes guests actually praise, atmosphere adjectives, owner/family mentions, "since 19XX" claims.
- Serbian press features, local food blogs, Wikipedia sr for old kafanas.
- **Wayback Machine** on their current or dead site: history, old menus, lost content - story gold nobody else digs up, and a disarming pitch moment ("this dish was on your 2015 site").

**C. Design reference** (mined, never shipped - zero licensing exposure):
- Google Street View interior 360s, TikTok/YouTube vlog frames, IG grid: derive the actual interior's palette, materials, lighting (the brick, the tablecloths, the neon) so the generated DNA matches the real room. Nothing from this tier is ever republished as an asset.

**D. Shipped photos - tiered waterfall (record the tier in the dossier):**
1. Restaurant's own website images.
2. Their Instagram/Facebook photos and **Yandex Maps org galleries** (`yandex.com/maps/org/<slug>/<id>/gallery/`; `avatars.mds.yandex.net/.../orig` serves full resolution - proven best tier-2 source) - allowed ONLY for unlisted noindex demos pitched to that owner; swapped or properly licensed at sale (CONVERT checklist enforces this).
3. **Google Maps listing photos** (owner or guest uploads on the venue's own listing; `lh3.googleusercontent.com/gps-cs-s/<token>=s1600-k-no` serves 1200-1600px originals) - same conditions as tier 2: unlisted noindex demos only, credited on the `/krediti/` page, mandatory swap at CONVERT (Milanova odluka 2026-08-11; supersedes the 2026-07-04 exclusion for this source).
4. CC-licensed placeholders with a credits page, flagged for replacement at onboarding.

Checking tier 1-3 (their site, IG/FB/Yandex, Google listing) is the default on EVERY build - relevant photos found there get used, not just inventoried; CC placeholders are the fallback when all three come up empty. TripAdvisor user photos are **not** shipped-photo sources - facts and story only. Never ship third-party stock as if it were theirs on a sold site. AI-generated food photography is last-resort backfill only - owners recognize their own dishes.

### 2. Story-first design DNA (replaces the old vibe→theme rubric)

Derive, don't decorate. From the research, extract 2-4 concrete **story hooks** (the 1936 founding, the brick-vaulted cellar, the charcoal grill visible from the street, the third-generation owner, the fishermen's-tavern past). Then compose **2-3 competing DNA directions**, each built on a different hook. Every direction specifies all generative axes:

- layout archetype (page structure, section composition, nav pattern)
- hero pattern (how the first screen is constructed)
- typography pairing (display + text, with era/character justification)
- palette family (derived from tier-C design reference: the actual interior)
- texture / graphic language (borders, dividers, grain, ornament style)
- imagery treatment (duotone, film grain, full-bleed vs framed)
- menu presentation style
- micro-motion (CSS-only; the near-zero-JS budget holds)

Each direction gets its story hook named and a one-line "why this fits". Mark one **recommended**.

**Registry veto (anti-convergence):** load the engine's theme fingerprint registry - one file per theme under `src/themes/_registry/*.json` in the engine repo (it covers the full shipped fleet; keeping it complete is what §9.7 is for). A proposed direction may collide with any shipped theme on **at most one axis**; if it collides on two or more, regenerate the colliding axes - and resolve the collision by returning to the story for a different hook, never by inventing arbitrary difference. A design decision that can't be traced to a dossier fact is a defect.

**Rebuild anti-reference:** if the restaurant has an existing site, characterize its look in the brief and explicitly design away from it - the owner's first impression must be "night and day", never "same thing, cleaner".

The legacy presets (`dark`/`light`/`heritage`/`ember`) are reference points and sample-data fallbacks only. Never pitch them to a new lead.

### 3. Scope (judged per dossier - no segment profiles)

No kafana/fine-dining presets. Propose scope per restaurant in the dossier: page set (a kafana may collapse to one-pager + menu; fine dining may take home/menu/wine/story/private-dining/gallery), copy depth, and photo bar (a fine-dining demo on CC placeholders undermines the premium claim - say so and propose the photo plan). Scope is part of the restaurant's story; the dossier settles it automatically. Price stays flat regardless.

### 4. Rebuild rubric (only when an existing site exists)

Makes "a lot better" falsifiable, and arms the compare pitch:

1. **Content-parity inventory**: crawl the old site; list every page, fact, menu item, and photo. The new site loses nothing - a vanished wine list kills a rebuild pitch at the worst moment.
2. **Measured deltas**: Lighthouse/CWV, page weight and request count, mobile usability, SEO structure (JSON-LD, sitemap, llms.txt, hreflang), sr/en coverage - captured before (their site) and after (the demo).
3. **Anti-reference**: old design characterized in the DNA brief as what to escape (see §2).
4. **Wayback sweep**: content their site lost over the years (see §1B).

### 5. Dossier (record, no stop)

The dossier is two artifacts working together (both modes, BUILD and BATCH):

- **`dna.json`** - the canonical machine-readable design spec the build step consumes. Full 8 axes **only for the recommended direction** (the one that gets built). Each alternate is a one-line **seed** (see below), not a full axis set. Written at the client repo root (BUILD) or `<batch-dir>/<slug>/dna.json` (BATCH).
- **`dossier.md`** - a thin human-readable index + sales record. It does **not** re-prose the axes; it points at `dna.json` for the design spec and carries the record bits. Written at the client repo root (BUILD) or `<batch-dir>/<slug>/dossier.md` (BATCH). Plain markdown - no lavish render (dropped 2026-07-07 for speed).

**Why only the recommended direction is written in full:** the registry veto (§2) and BATCH deconfliction only ever check the direction you build; nothing downstream reads a full alternate. Alternates are regenerated fresh on a live objection anyway, so writing them out in full up front is pure output-token waste (decision 2026-07-09).

`dossier.md` contents:

1. **Verified facts** - name, address, phone, email, hours, socials, cuisine, price range + source per fact; open questions highlighted.
2. **Photos found** - count, quality verdict, tier used and why.
3. **Menu source** - HTML / PDF / image / photos of physical menu / Wolt scrape; transcription effort estimate; whether prices are printed; delivery-vs-dine-in price discrepancies flagged.
4. **Design DNA** - name the **recommended** direction's story hook and one-line why-it-fits, and say "full axes: see `dna.json`". State the registry-veto result (which shipped themes were nearest and on which axis). List each **alternate as a one-line seed**: `<story hook> - <one headline sentence>`. Do not write alternate axes here or in `dna.json`.
5. **Scope proposal** - page set, copy depth, photo bar, and why (per §3).
6. **Pitch angle** - `compare` (existing site: rebuild rubric artifacts + measured metrics) or `invisible` (no site: "Google/AI can't see you today").
7. **Names** - proposed repo (`milan44i/<slug>`), CF Pages branch (`<slug>` on the shared `restorani` project), demo URL (`<slug>.restorani.pages.dev`), theme slug.

In `dna.json`, each axis of the recommended direction carries a **fact-trace tag**, not prose: `"palette": "warm ochre + char (← brick cellar, tier-C streetview)"`. The `←` names the dossier fact the decision traces to - that keeps §2's "every design decision traces to a fact" rule checkable, without paragraphs of justification.

Auto-select the **recommended** direction and run straight to build - do not stop to ask. The alternate **seeds** are back-pocket objection handlers: if the owner later pushes back on the look, expand that seed to a full direction and regenerate on that live signal, never speculatively. Open questions and unverified facts are not blockers - carry them into the dossier and surface them in the final report (§10).

### 6. Build

1. Scaffold the client repo: `cd ~/work/projekti/restorani/restaurant-engine && node scripts/new-site.mjs <slug> <theme-slug> --name "<Restoran X>"`. This prunes themes to `_scaffold` + the new theme (an unstyled copy of `_scaffold`, ready to style), resets the registry to one placeholder entry, seeds the chooser card/slot, stamps `site.json` config (`cfProjectName: "restorani"`, `cfBranch` = slug, `lockedTheme`, `indexable: false`, branch-deployment URL), and git-inits. It builds green immediately. Then `cd ../<slug> && pnpm install`.
2. Fill `src/data/*` in this order: `site.json` (facts), `menu.json` + `wine.json` (from the §1 Wolt scrape draft when one exists - translate the `*En` fields, mark `featured`, reconcile prices; otherwise transcribe with vision from PDF/images; fix typos and KEEP A LIST of fixes - they're pitch material), `copy.json` (both languages, grounded strictly in researched facts; write sr first, translate to en yourself; replace the scaffolded TODO chooser card), `gallery.json` + `images.json` (map semantic slots), `pitch.json`.
3. Photos into `src/assets/photos/` (downloaded per tier), logo into `src/assets/brand/` if they have a usable one (`config.logo`), else leave `null` (text fallback).
   - **Favicon is the restaurant's identity, never a generic/engine placeholder.** Source in order: (a) **if the restaurant already had a website, keep the same favicon it used** - regulars recognize that tab icon, so preserve the continuity instead of inventing a new one; pull it from the old site or find the source mark by googling `[restaurant name] logo`; (b) otherwise use the restaurant's own logo/mark - usually findable by googling `[restaurant name] logo` - cropped to a square, trimmed padding, on a legible background (a wide wordmark reduces to its monogram or crest, not the full lockup); (c) if no logo exists anywhere, generate a simple representative mark from the design DNA (a monogram in the theme's display face, or a single motif from the theme's graphic language - the grill flame, the wine glass, the crest); never ship the engine default, a stock icon, or anything unrelated to this restaurant. Wire it as the favicon in `site.json`/head config so every page carries it.
4. **Style the bespoke theme** in `src/themes/<theme-slug>/` from the approved DNA direction using the `frontend-design` skill, and fill its real registry entry (axes from the dossier's DNA, storyHook, date). The theme owns its design tokens, typography, textures, and layout files, but **must compose engine primitives** (image-slot component, menu renderer, i18n text, reservation form, lightbox). Raw `<img>`, hand-rolled menu markup, or duplicated i18n plumbing inside a theme is a defect - the engine's guard lint fails the build on it.
5. `pnpm build` - the engine fails loudly on missing image slots or links to disabled pages; fix data, not guards.

### 7. QA

- `node scripts/qa.mjs` - deterministic pass first: internal links, srcset, hreflang pairs, JSON-LD parse, noindex/robots consistency, favicon, llms.txt/sitemap, **fragment-anchor targets** (every `#id` resolves - this is the deterministic replacement for manually clicking menu anchors). Fix failures before any visual work.
- **Deterministic gate (send-ready bar) - always, before any visual pass:** after `qa.mjs`, run `node scripts/cascade-sweep.mjs` and fix/harden every BROKEN + LATENT pair (raise to 0,2,0) until it prints `0 broken, 0 latent`, then `node scripts/probe.mjs` (Playwright headless horizontal-overflow check over the built `dist`, every enabled page × mobile 390 / desktop 1440; **detect-only** - cascade-sweep is the only auto-fixer). A `probe.mjs` non-zero exit is **flag-not-block**: never block the build - in BUILD surface it in the report + handoff (recommend `polish-design` on the flagged page), in BATCH write `gate: <overflow summary>` to `state.md` + the demo's `PIPELINE.md` Napomena and continue. The gate does NOT set the `Polish?` column.
- `node scripts/qa.mjs --serve` - serves `dist` on a **free port** (no stale-server collisions). **Visual pass is scoped, not exhaustive** (decision 2026-07-09): the engine owns the responsive rails, a11y floor, and image-slot semantics identically across every client, so the only per-build visual risk is the bespoke theme. Screenshot and read **just two pages** at desktop 1440×900 + mobile 390×844: the **homepage** (the pitch face - it must be perfect) and the **most content-dense enabled page** (the menu page - longest, most overflow-prone; on a one-pager, that's the home page's menu section). ~4 reads, flat regardless of page count.
  - **Tripwire → read all pages:** if either read shows a **theme-level** defect - a bug that lives in the theme and therefore replicates across every page (broken layout primitive, palette/type misrender, systemic overflow, a mis-composed engine primitive) - expand and read every enabled page, because the defect is fleet-wide within this build. A **data typo** (one wrong price, a missing photo in one slot) is not a tripwire: fix the data and re-shoot only that page.
- Known capture artifacts (do NOT "fix" these): lazy-decoded images blank in full-page CDP captures; load animations frozen at opacity 0; pages >16384px stitch wrong; 100vh heroes distort under the tall-viewport workaround (shoot those at normal viewport). Verify suspicious findings with normal-viewport shots before changing code.
- **Interactions are engine-owned - do NOT click-test any of them per build** (decision 2026-07-09). The reservation form (closed-day rejection + validation), gallery lightbox, language switch, and the **mobile burger nav** all run on shared engine JS with no bespoke per-site code (the burger toggle lives in `lib/mobile-nav.ts`; the theme only supplies styled markup + a `data-menu-class` hook). Their behavior is identical for every client and is covered once by the engine's Playwright suite (`tests/interactions.spec.mjs`, run by the engine's `pnpm verify` on core changes and `pnpm verify:full`); menu anchors are covered by the deterministic fragment-target check above. Re-verifying any interaction per demo is pure waste - there is no per-build interaction QA.
- **Favicon check**: the browser-tab icon is the favicon the restaurant already used (if it had a site), its logo, or its DNA-derived mark (per Build §6.3), legible at 16×16, not the engine default or anything unrelated.

### 8. Pitch asset

- **compare mode** (existing site): rebuild-rubric artifacts are the ammunition - parity inventory framed as "nothing lost, everything gained", plus measured metrics: old site via `performance.getEntriesByType('resource')` decodedBodySize (wrap multi-statement eval in an IIFE), request and JS-file counts; screenshot old+new, desktop+mobile into `src/assets/pitch/`; fill `pitch.json` metrics/fixes with measured numbers and the typo-fix list; the offer page serves at `/ponuda/` and its `offer` block (€400 + €40/mo, or €400/year; include-lists) gets tailored per client.
- **invisible mode** (no site): pitch.json `fixes` lead with invisibility - Google/Maps/AI assistants can't read a Facebook page; show what `llms.txt` + schema make possible. No fabricated metrics.
- Both modes: the one-of-one line is the spine of the pitch - "this design exists nowhere else; it was built from your story." Name the story hook in the pitch copy.

### 8b. Pitch message (Serbian, ready to send)

Every finished demo ships with ONE ready-to-send outreach message for the owner. Deliver it in the report (BUILD) and write it to `<batch-dir>/<slug>/pitch-message.md` (BATCH).

**The canonical template lives in `~/work/projekti/restorani/pitch-template.md`** - the single source of truth shared with the `restaurant-pitch` skill. Read it from there; never restate it from memory. Send it verbatim: the ONLY per-demo substitution is the demo URL (both occurrences - base URL, and base + `/ponuda/`). Do not reword, shorten, add a story hook, or state a price - the price lives on the `/ponuda/` page. Keep proper Serbian diacritics (č/ć/š/ž/đ) exactly as written.

### 9. Deploy (unlisted demo)

1. Create private repo: `npx -y gh-axi repo create <slug> --private --description "..."` ; `git remote add origin git@github.com:milan44i/<slug>.git`; push `main`. This is code backup only (no CI anywhere - GitHub Actions retired 2026-07-13) - **it does not deploy**.
2. **Demos share the ONE CF Pages project `restorani`** (decision 2026-08-15 - the account's 100-project cap killed project-per-demo; dedicated projects are for sold sites only). Its production branch is the reserved `prod` - nothing ever deploys to it, so a forgotten `--branch` can't overwrite anything. Never create a per-demo project. Account-level model, cap status, and prune policy: `infra` skill.
3. Deploy as a branch deployment: `pnpm build && npx wrangler pages deploy dist --project-name=restorani --branch=<slug> --commit-dirty=true` (wrangler is OAuth-logged-in on this machine; if not, ask Milan to run `wrangler login`).
4. Verify the live demo URL `https://<slug>.restorani.pages.dev` (the branch alias) renders.
5. Confirm noindex + robots Disallow on the live URL.
6. **Append a row to `~/work/projekti/restorani/PIPELINE.md`** (the central tracker): `Ime | Kraj | Demo URL | Email | Ponuda poslata? | Ishod | Polish? | Napomena`. Fill Ime/Kraj/Demo URL, Email from the dossier (or `-` if none), leave "Ponuda poslata?", "Ishod" and "Polish?" as `-` (`polish-design` fills the date when it runs). Keep the table header + legend intact. **In the same step, delete the restaurant's row from `~/work/projekti/restorani/CANDIDATES.md`** if it has one - built demos leave CANDIDATES for PIPELINE. A row left behind at `dossier-ready` gets re-picked by the next batch's auto-pick and rebuilt. In BATCH this is the build subagent's per-demo job, not the orchestrator's at batch end.
7. **Import the theme back into the engine - always in a dedicated git worktree, never the shared `restaurant-engine/` checkout.** Concurrent sessions share that checkout's HEAD, index, and `dist/`; working in place races them - your commit lands on `main` instead of your branch, `git add -A` sweeps in another session's uncommitted files, and two `astro build`s corrupt each other's `.prerender` chunks. The worktree gives this sync its own HEAD + index + `dist/`, so 2+ restaurants can sync at once safely:
   - `cd ~/work/projekti/restorani/restaurant-engine && git worktree add ~/work/projekti/restaurant-engine-<slug> -b theme/<slug>` (worktree lives outside `restorani/`, beside the other engine worktrees)
   - `cd ~/work/projekti/restaurant-engine-<slug> && pnpm install` (seconds from the pnpm store; the worktree owns its `node_modules` + `dist/`)
   - `node scripts/import-theme.mjs ../restorani/<slug>` (client repo is one level out now), run the verify commands it prints
   - stage import-theme's whole footprint - the registry file `src/themes/_registry/<theme-slug>.json`, the theme dir, `src/lib/routes.ts`, `package.json`, `pnpm-lock.yaml`, `src/data/images.json`, `src/data/copy.json`. `git add -A` is safe **here** because the worktree's index is isolated (the "never `-A`" caution is only for the shared checkout). Commit, `git push -u origin theme/<slug>` (the pre-push hook runs `pnpm verify` - never bypass with `--no-verify`), PR via gh-axi, merge once verify passes
   - `cd ~/work/projekti/restorani/restaurant-engine && git worktree remove ~/work/projekti/restaurant-engine-<slug>` once merged
   **A build is not done until its registry entry is on engine main** - this is what keeps the §2 veto honest.

### 10. Report

Live demo URL, chosen DNA direction + story hook, scope, pitch angle, **the pitch message (8b, paste-ready)**, typo-fix count, photo tier, registry entry merged to engine main, PIPELINE.md row appended, anything left open (missing phone, unverified hours). Update memory (`restaurant-website-service.md` or the client's own memory file). **Not done until on the board:** the demo must appear on the outreach tabla `https://poruke.sajt-analiza.pages.dev/` - refresh it once per build session from `~/work/projekti/sajt-analiza` and verify the restaurant shows on the live page (in BATCH the orchestrator does this once at batch end).

**Handoff:** the deterministic gate (cascade-sweep + probe, QA step) already ran in-build, so
recommend a `polish-design <slug>` (human Tier-2) pass **only if the gate flagged an overflow**
or beautification is wanted - not as a blanket default - then ask: "Demo je live. Želiš li da
pozovem `restaurant-pitch` da napravi draft ponude za <restoran>?" On "da", invoke `restaurant-pitch <slug>` (it prints a paste-ready
Viber/IG DM message - it never emails or sends). If the restaurant has no phone or IG on
record, say so - that one is a door-to-door kandidat.

---

## UPDATE mode (48h retainer changes)

1. Locate the client repo in `~/work/projekti/restorani/<slug>` (clone from GitHub if missing; `pnpm install` if node_modules was pruned - seconds from the pnpm store).
2. Apply the change in `src/data/` (menu prices, hours, photos, copy). Data-only changes are the norm; theme edits are the exception - if a theme edit is needed, mirror it to the engine **in a per-slug git worktree, never the shared engine checkout** (see §9.7 for why and the exact commands), run `pnpm verify` there, and PR + merge. Watch for pre-existing engine divergence when mirroring (e.g. the client theme may lag the engine on shared plumbing like mobile-nav) - apply your edit targeted, don't copy the whole file over.
3. `pnpm build`, `node scripts/qa.mjs`, screenshot the affected pages, read them.
4. Commit with a plain description, push (backup), then **deploy explicitly**: `npx wrangler pages deploy dist --project-name=<cfProjectName> --branch=<cfBranch> --commit-dirty=true` (from `site.json` config; sold sites have no `cfBranch` - deploy their dedicated project without `--branch`). Pushing alone deploys nothing - never report done on a push alone. Verify the change on the live URL.
5. Report: what changed, live URL, turnaround time.

## CONVERT mode (demo → sold site)

1. `site.json` config: `indexable: true`, prune `enabledPages` to what was sold, set `config.url` to the custom domain. (`lockedTheme` is already set on bespoke demos; legacy chooser-era demos additionally set `lockedTheme: "<chosen>"` here.)
2. Delete `src/pages/ponuda.astro` (the offer page), `src/data/pitch.json`, `src/assets/pitch/`.
3. **Photo licensing**: replace every Tier-2/3 (social/Yandex/Google-listing scrape) photo with owner-provided originals or properly licensed images; any surviving Tier-4 CC photo gets a visible credits page.
4. Real reservation contact: confirm phone/email are the restaurant's own, `demoNote` copy removed from the flow (success text stays).
5. **Dedicated Pages project** (sold sites get their own; demos live as branches on `restorani`): `npx wrangler pages project create <slug> --production-branch main`, then in `site.json` config set `cfProjectName: <slug>` and remove `cfBranch`. The old demo branch on `restorani` stays live (noindex) - harmless, delete its deployments if the owner asks.
6. Custom domain: **Milan pays and does everything** (registration, DNS, cert) through his own registrar account, cost absorbed in the retainer; the **restaurant is named registrant** so "domen je vaš" stays literally true (odluka 2026-08-16; .rs goes through RNIDS-accredited registrars, ~2500 RSD/yr). The owner does nothing technical. Point it at the new dedicated Pages project (`npx wrangler pages domain add` or dashboard), verify cert. Commercial side of acceptance: `~/work/projekti/terenska-prodaja/ONBOARDING.md`.
7. Rebuild, `node scripts/qa.mjs` (it checks the sold-site invariants: robots Allow, sitemap, llms.txt), deploy via `npx wrangler pages deploy dist --project-name=<slug>`, verify: root URLs, no demo note, canonical + hreflang on the custom domain.
8. Ask Google/Bing to discover it (Search Console is Milan's manual step - flag it).
9. Report + update memory: client is live, retainer clock starts. Flip the registry entry's `status` to `sold` in the engine (small PR). Move the demo's PIPELINE.md row to `~/work/projekti/restorani/PIPELINE-ARHIVA.md` (Ishod `prihvatili`, note "live na <domen>").

---

## BATCH mode (list of restaurants)

Orchestrates BUILD over a list with **no gates** - research, auto-pick, and build run straight through. Context is the scarce resource: the orchestrating session never does research, theme generation, or QA itself - subagents do, and everything they produce lands in files, not in the conversation.

### 0. Preflight (fail fast)

Create `~/work/projekti/restorani/batches/<YYYY-MM-DD>-<label>/` with `state.md`: the list, one status line per restaurant (`pending -> researched -> picked-<direction> | skipped-<reason> -> built -> deployed -> registered | failed-<reason>`). `picked-<direction>` is the auto-selected recommended direction; `skipped-<reason>` is the research subagent's own skip verdict; `registered` means the theme + registry entry are merged to engine main - **a restaurant is not finished until it reaches `registered`**. Before any research, verify the batch can actually ship: `npx wrangler whoami` logged in, gh-axi authed. Anything missing -> stop and ask Milan now, not at deploy #1. Check `~/work/projekti/restorani/CANDIDATES.md` for candidates already researched by an earlier batch (status `dossier-ready`, with a dossier path) before researching anyone from scratch.

### 1. Research fan-out (subagents), overlapped with builds

One research subagent per restaurant, 2-3 concurrent, each spawned with `subagent_type: "biz-research"` (Sonnet at `xhigh` effort - see `~/work/projekti/.claude/agents/biz-research.md`; it is vertical-agnostic and serves this pipeline too). The research lane is fact-gathering, transcription and URL verification, which Sonnet does at full quality for roughly a third of the cost. **The build lane stays on the session model (Opus)** - it carries the theme code, the deterministic gate and the registry merge.

Each research subagent runs BUILD steps 1-5 (research, story-first DNA directions with registry veto, scope, pitch angle) and writes `<batch-dir>/<slug>/dna.json` (canonical spec: full 8 axes for the recommended direction only, alternates as seeds - per §5) plus the thin `<batch-dir>/<slug>/dossier.md` index. It returns to the orchestrator ONLY: slug, pitch/skip verdict + one-line reason, recommended direction, open-question count. A bad candidate (already has a strong site, closed, no usable photos) gets verdict skip-with-reason, and the orchestrator honors that verdict automatically - the subagent decides the skip, since there is no human sitting.

**Incremental deconfliction (no barrier):** as each dossier lands, check its recommended direction immediately - against the engine registry AND against every already-approved pick in this batch (max 1 shared axis anywhere). Pass -> approved, eligible to build while later research is still running. Collision -> regenerate from that restaurant's story (edit dossier + dna.json, note the change), re-check. The only ordering constraint is that each pick is checked against the picks approved before it - do NOT wait for all research to finish before build #1 starts.

### 2. Auto-pick (no stop)

`state.md` plus the per-restaurant dossier files ARE the batch record (the combined lavish page was dropped 2026-07-07). For each restaurant, take the research subagent's verdict as final: pitch -> record its **recommended** direction as the pick, skip -> mark `skipped-<reason>`. Write picks and skips to `state.md` as they happen.

### 3. Build + deploy (sequential builds, overlapped with research)

One build subagent per approved restaurant, **strictly sequential among themselves** - a defect found in build #2 must not get cloned into #7, and registry merges must land in order so each later deconfliction sees them - but the build lane runs concurrently with the research lane: build #1 starts as soon as the first pick is approved. Each subagent runs BUILD steps 6-10 from its dossier file + picked direction: scaffold via `new-site.mjs`, data, bespoke theme, QA (`qa.mjs` + screenshots read inside the subagent), local wrangler deploy, theme + registry entry merged to engine main via `import-theme.mjs` **in a per-slug worktree (§9.7), never the shared engine checkout** - this is also what lets a second concurrent batch/session sync safely (engine `pnpm verify` green before the next build starts), its `CANDIDATES.md` row deleted (§9.6 - built demos leave CANDIDATES for PIPELINE), and the pitch message written to `<batch-dir>/<slug>/pitch-message.md` (8b). It updates `state.md` and returns ONLY: demo URL, QA verdict, open items. A failure -> `failed-<reason>` in `state.md`, continue with the next restaurant; the batch never dies on one.

### Context discipline

- Dossiers, dna.json, pitch assets, and QA screenshots live in the batch dir; the orchestrator reads `state.md` and subagent one-liners, never full dossiers or images.
- Any fresh session resumes a batch by reading `state.md` and continuing from the first non-terminal status.
- **Researched-but-unbuilt candidates get written back to `~/work/projekti/restorani/CANDIDATES.md`** at batch end: set Status to `dossier-ready` (with the dossier path) or `skipped-<reason>`, filling in a new row if the restaurant wasn't already one (e.g. Milan supplied it directly, not via `restaurant-scout`) - paid research never evaporates, and the next batch starts there. Built demos are the opposite: their rows are already deleted per demo in §9.6 - never write a built restaurant back.

### Report

One table: restaurant | verdict | demo URL | direction + story hook | pitch angle | open questions - plus each restaurant's pitch message (from `pitch-message.md`) printed in full, paste-ready. Update `restaurant-website-service` memory once per batch, not per restaurant.

**PIPELINE reconciliation (orchestrator, mandatory - never rely on the build subagent alone):** a build subagent appends its own `~/work/projekti/restorani/PIPELINE.md` row (BUILD §9.6), but a subagent that dies on a transient error - or a build resumed across sessions - can deploy and never reach its append step. So at batch end the orchestrator itself reconciles: for every demo at `deployed` in `state.md`, confirm a `PIPELINE.md` row exists (grep the demo URL); append any that are missing (same columns as §9.6, Email from the dossier or `-`, "Ponuda poslata?"/"Ishod" as `-`) - and confirm its `CANDIDATES.md` row is gone, deleting any straggler (a leftover `dossier-ready` row means the next batch's picker rebuilds the same demo). A demo is not reported done until its row is present. This is a guaranteed orchestrator step, not a subagent responsibility.

**Outreach tabla (orchestrator, after reconciliation):** a demo is not done when it is live - it is done when it is on the board Milan actually sends from, `https://poruke.sajt-analiza.pages.dev/` (odluka 2026-08-19). A demo missing from the board never gets pitched. Procedure and gotchas live in `~/work/projekti/sajt-analiza` (collect -> analyze -> `build-phone.mjs` -> `wrangler pages deploy dist-poruke --branch=poruke`); run it once per batch, not per demo, and verify the new restaurants appear on the live page. This publishes Milan's own worktable - it is NOT outreach, and pitch messages stay files only, never sent.

**Batch-dir cleanup (orchestrator, final step - always after reconciliation):** a batch dir is scratch; the durable record is `PIPELINE.md`. Once reconciliation is done, run `node scripts/cleanup-batches.mjs --apply` from the engine root. It deletes every batch dir in which all restaurants are resolved - live in `PIPELINE.md` or marked `skipped-`/`failed-` in `state.md` - and leaves any with an in-flight restaurant untouched. Ordering matters: reconciliation must land first so `PIPELINE.md` is authoritative before the script reads it. Run without `--apply` first if you want to see the plan.

**Handoff:** after the table, the in-build deterministic gate already ran per demo; recommend a
`polish-design <slug>` pass only for demos the gate flagged (or for beautification), not blanket, then ask once -
"Demoi su live. Želiš li da pozovem `restaurant-pitch` da napravim draftove ponuda?" On
"da", invoke `restaurant-pitch <slug> <slug> ...` for the shipped demos that have an email
on record (it drafts one email per demo in Milan's Gmail for review - it does not send);
name any skipped for missing email.

## Legacy fleet + cutover

The four chooser-era demos (`beogradnavatri`, `stari-pingvin`, `stari-nikola`, `restoran-cezar`) stay as-is while their pitches are in flight. If a pitch stalls or an owner objects to the look, regenerate that demo as a bespoke build - the redesign doubles as the re-approach ("we rebuilt it from scratch around your story"). **Stara Kuća is the next bespoke build in the queue**: her research and dossier are done; re-run only the design-DNA step (§2) on the existing dossier to produce directions, then continue from the dossier step (§5), auto-picking the recommended direction.

## SEO / AI baseline

Built into the engine - verify, don't reimplement: Restaurant JSON-LD derived from `site.json`, full HTML menu (never image-only - it's the flagship pitch point), sitemap, hreflang sr/en, `llms.txt`, agent-welcoming robots.txt (sold mode), astro:assets image optimization, near-zero JS. If a client build needs something beyond this (e.g. Menu JSON-LD with prices), add it to the ENGINE so every client benefits, then pull it into the client repo.
