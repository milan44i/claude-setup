---
name: polish-design
description: Page-by-page design polish for one deployed restaurant site - fixes everything that looks unprofessional (misalignment, broken spacing, overflow, cascade-order CSS bugs) and applies bounded beautification within the site's existing design DNA, then redeploys and records the pass in PIPELINE.md. The deterministic structural gate (cascade-sweep + probe.mjs) now runs inside every build, so run this human Tier-2 pass when that gate flagged an overflow on a demo, or when beautification is wanted - not as a blanket step after every build. One site per invocation.
---

# polish-design

Design-quality pass for Milan's restaurant fleet. Sibling of `restaurant-site` (builds) and
`restaurant-pitch` (sells): this skill takes an already-deployed site and makes every page
look professional before an owner sees it. Born from the 2026-07-13 Thyme pass, where five
"finished" sites carried 35+ really-broken style overrides plus assorted visual defects.

**Path root: everything lives under `~/work/projekti/restorani/`.** One site per invocation
(`polish-design <slug>`), worked inline - no subagent fan-out. A fleet sweep is just this
skill invoked once per slug.

## Eligibility

Resolve `<slug>` against PIPELINE.md (demo URL, offer status) and the local repo
`~/work/projekti/restorani/<slug>` (clone from `milan44i/<slug>` if missing; `pnpm install` if
node_modules is pruned).

- **Frozen repos: refuse.** The chooser-era four (`beogradnavatri`, `stari-pingvin`,
  `stari-nikola`, `restoran-cezar`) and any row whose Napomena marks it ZAMRZNUT. Say why:
  frozen repos predate the current engine and get regenerated as bespoke builds instead.
- Pitched-but-unanswered demos are fair game - the DNA does not change, so the owner sees
  the same design, only more correct. A broken site under evaluation costs more than a deploy.
- Sold sites (indexable, custom domain) are allowed - normal retainer work - but the report
  must say production was touched, and the deploy target is the client's CF Pages project.

## What it may touch - two tiers

**Tier 1 - defects (always):** anything objectively unprofessional. Misaligned or off-center
text, wrong section spacing, horizontal overflow, grid breaks at 390px, widows in display
headings, duplicated kicker/title pairs, caption misalignment, broken hover states, typo-level
copy noise (double spaces, stray punctuation).

**Tier 2 - bounded beautification (within the existing DNA):** refinement that must cite a
craft rule, never taste. Vertical-rhythm consistency (spacing steps on a scale), type-scale
consistency (stray one-off sizes snapped to the scale), every interactive element gets a
visible hover/focus state, consistent image treatment within a context. If a page seems to
want more than ~5 Tier 2 edits, that is a design problem, not a polish problem - write a
proposal in the report instead of editing.

**Never:** the design DNA axes (palette, typography pairing, layout archetype, texture,
imagery treatment - the registry entry stays true), engine primitives (`src/components/`,
`src/lib/` - if the defect lives there, stop and report it as engine-level so the whole
fleet gets the fix), new JS, facts/data (prices, hours, addresses, menu items), `site.json`
config. Copy edits only for unambiguous typos.

## Procedure

1. **Build + baseline:** `pnpm build`, `node scripts/qa.mjs` - deterministic failures get
   fixed first (data problems, not guards). Save "before" screenshots of any page you expect
   to change (needed for the Tier 2 report).
2. **Cascade sweep:** `node scripts/cascade-sweep.mjs` (if the script is missing in the
   client repo, copy it from engine main - same drill as any engine script drift). It reports
   page-level overrides at (0,1,0) that fight Layout rules and win or lose purely on Astro
   chunk order. Fix every BROKEN pair and harden every LATENT pair the same way: raise the
   override to 0,2,0 (double-class like `.tsc-section.tsc-about-head`, or ancestor prefix
   like `.tsc-about-head .tsc-about-title`), including any `@media` variants of the same
   selector. Re-run until it prints `0 broken, 0 latent`.
3. **Visual audit - every enabled page** (`site.json` enabledPages, plus `/ponuda/`), SR at
   desktop 1440x900 and mobile, scroll segments through the full page, EN spot-check on
   desktop (string-length breakage: hero, nav, menu labels). Check `document.documentElement.
   scrollWidth` is exactly the viewport width on mobile (menu pages especially - nowrap
   chips stretch sections via min-content).
4. **Fix loop:** fix, `pnpm build`, `node scripts/qa.mjs`, re-shoot affected pages, verify
   computed styles for alignment claims (axis coordinates, margins) rather than eyeballing.
5. **Ship:** commit (plain description), push (backup, not a deploy), then
   `npx wrangler pages deploy dist --project-name=<cfProjectName> --branch=<cfBranch> --commit-dirty=true`
   (both from `site.json` config - demos are branch deployments on the vertical's shared
   project since 2026-08-15; sold sites have no `cfBranch`, deploy without `--branch`;
   account-level model: `infra` skill)
   and verify live: HTTP 200 on all
   routes, noindex meta + robots `Disallow: /` still present on demos, computed-style probes
   of the headline fixes, and deep-link hrefs still emitted if the theme uses `menuAnchor`.
6. **Engine sync:** the theme lives in both repos. Work in a worktree, never the shared
   checkout: `git -C ~/work/projekti/restorani/restaurant-engine worktree add
   ~/work/projekti/restaurant-engine-<slug> -b polish/<slug>` (pull main first). `import-theme.mjs`
   is a no-op for existing themes, so sync manually: `diff -ru` the client theme dir against
   the engine copy and copy changed files over. `pnpm verify` must be green (never
   `--no-verify` - the pre-push hook is the gate, there is no CI), push, PR via
   `npx -y gh-axi pr create`, merge, remove the worktree.
7. **Record:** set the site's `Polish?` column in `~/work/projekti/restorani/PIPELINE.md` to
   today's date (YYYY-MM-DD). The row must already exist (restaurant-site appends it on
   deploy); if it does not, report the anomaly instead of appending.

## Browser discipline (violations have hung agents for 600s)

- chrome-devtools-axi. Mobile viewport ONLY via `emulate --viewport "390x844x2,mobile,touch"`,
  never `resize` (Chrome clamps the window at 500px and the capture path hangs).
- Never full-page/`--full` captures (>16384px stitch hangs); viewport shots + JS scroll
  segments, scrolling with `behavior: 'instant'` (smooth-scroll themes shoot mid-animation).
- Known artifacts, not bugs: lazy images blank in CDP shots, reveal animations frozen at
  opacity 0, 100vh hero distortion at odd viewports. Re-verify at a normal viewport before
  changing code.
- Engine-owned interactions (burger nav, lightbox, reservation form, language switch) are
  covered by the engine Playwright suite - do not click-test them per site.

## Report

Always text: defect -> fix list (one line each), pages that were already clean, deploy URL +
verification result, engine PR number + merged, PIPELINE.md updated, anything engine-level
found but not fixed. When Tier 2 changed anything, also render a `lavish` before/after page
(screenshot pairs per changed page) so Milan can judge the beautification by eye - the
per-site commit is atomic, so a rejected change is one revert away. Update memory only for
new bug classes or operational lessons, not routine passes.

**Handoff:** if the site's "Ponuda poslata?" is `-` and it has an email on record, end with:
"Sajt je ispoliran i live. Želiš li da pozovem `restaurant-pitch` da napravi draft ponude?"
