---
name: biz-site
description: Build, update, and sell bespoke small-business websites on the shared biz-engine, covering the 12 biz verticals - fizioterapeuti i maseri (masaža), pet frizeri i veterinari (veterinarska ambulanta), auto škole, vulkanizeri, auto servisi (mehaničari, mali/veliki servis), stomatolozi i privatne ordinacije, vinarije i ruralni turizam (salaš, etno selo), knjigovođe (knjigovodstvena agencija), stolarija/PVC/renoviranje, škole stranih jezika, igraonice i rođendaonice, beauty saloni (kozmetički salon, nail studio/nokti, trepavice i obrve - lash & brow, PMU). Researches the business, derives a story-first design DNA, builds a one-of-one demo, deploys to Cloudflare Pages, and maintains client sites. Modes - BUILD (new business), BATCH (list, no-stop auto-pick), UPDATE (existing client change), CONVERT (demo sold, go live). Use for "izgradi/napravi sajt (demo) za <auto školu / auto servis / vinariju / stomatologa / kozmetički salon / nail studio / igraonicu...>", "update cenovnik za X", "X su kupili / go live". For restorane use restaurant-site - not biz-*.
---

# biz-site

Productized pipeline for Milan's small-business-website service across the twelve generic verticals. The reusable code lives in the shared engine repo; this skill is the process around it. Sibling of `biz-scout` (finds leads) and `biz-pitch` (sends offers).

**Two path roots.** The shared engine lives at `~/work/projekti/biz-engine` - ONE engine for all twelve verticals. Each vertical lives in its own container dir `~/work/projekti/<dir>/` holding `VERTICAL.md`, `CANDIDATES.md`, `PIPELINE.md`, `pitch-template.md`, `batches/`, and the client repos. The vertical -> `<dir>` mapping lives in `~/work/projekti/VERTICALS.md`; if paths ever move, registry and this line are the only places the roots are defined.

## Vertical resolution (always first)

1. Identify the vertical from the request ("napravi demo za vinariju X" -> vinarije i ruralni turizam; a business name alone may need a quick search to classify).
2. Read `~/work/projekti/VERTICALS.md`, resolve `<dir>`. Restorani are standalone there - hand those to `restaurant-site`.
3. Read `~/work/projekti/<dir>/VERTICAL.md` (structure below). Vertical unclear? Ask, don't guess.

## VERTICAL.md - the per-vertical configuration

Every vertical dir carries a `VERTICAL.md` that all three biz-* skills read before doing anything vertical-specific. Expected sections:

- **Identitet** - what the vertical is, the in/out-of-scope boundary, the pitch noun ("za ordinaciju", "za radnju"...) including segment variants.
- **Segmenti** - segment list with one-liners; feeds scout scoping, the CANDIDATES Segment column, and pitch-template variant selection.
- **Šta sajt mora da ima** - must-have pages and content for this vertical, `config.schemaType` value(s) (per segment where they differ, e.g. grooming salon vs veterinarska ambulanta), and the booking/appointment platforms in use (feeds `bookingUrl`).
- **Design DNA smernice** - vertical-specific design guidance and the vertical's named generic failure mode (its anti-kitsch clause, consumed in §2).
- **Copy ton** - voice guidance for the Serbian copy.
- **Pitch** - pitch-angle specifics, channel norms (email / IG DM / phone-first), segment -> pitch-template variant mapping.
- **Tržišne beleške** - scout sources, popularity signals and thresholds, geography, platform/directory landscape.
- **Otvorene pretpostavke** - open assumptions to resolve with Milan before they harden.

A section may be missing while a vertical is young: fall back to the generic rules in this skill and flag the gap in the report - never invent vertical policy silently.

**The design promise: no two sites look alike - across the whole fleet.** Every client gets a bespoke theme derived from their own story; the engine provides the shared skeleton (data model, primitives, i18n, SEO, deploy), the theme provides a one-of-one face. Because all twelve verticals share one engine, the fingerprint registry and its anti-convergence veto span the entire fleet - a stomatolog demo may not converge with a vinarija theme either. That is a feature: uniqueness is guaranteed fleet-wide, and it stays a byproduct of specificity - every design decision traces to a researched fact about this business, never to generic taste.

**Engine**: `~/work/projekti/biz-engine` (fork of `salon-engine`, generalized across verticals). Read its `README.md` for the data contract before touching data files: `services.json` (cenovnik/usluge: groups > sections > items, optional `durationMin`), `packages.json` (paketi; `sections: []` hides), `copy.json` sr+en, `gallery.json`, `images.json` (semantic slots), `site.json` (facts + `config.schemaType` from VERTICAL.md + `bookingUrl` for the business's existing booking-platform profile), `pitch.json`. Bespoke themes compose the engine's shared primitives (`ServiceList`, `GalleryGrid`, `SlotImage`, `BrandMark`, `BookingForm`) and are committed back to the engine with a fingerprint registry entry - the library compounds, and the engine's local gate (`pnpm verify`; no CI exists) builds affected themes on each change. The engine ships the pipeline scripts: `new-site.mjs`, `import-theme.mjs`, `sync-engine.mjs`, `qa.mjs` - **use them instead of doing their work by hand**. Cenovnik/usluge get transcribed from whatever the vertical publishes (platform profiles, IG price posts, photographed price lists, PDF cenovnici) - VERTICAL.md names the usual sources.

**Never trigger a permission dialog in an unattended run (Milanova odluka 2026-08-20).** The night autopilot builds while Milan is asleep; a dialog does not slow the run, it **kills** it - the agent blocks until morning and the batch dies. `Bash(*)`, `WebFetch(*)` and `WebSearch(*)` are already granted, so ordinary work never prompts. Two things still do, and both are avoidable:
- **No browser against a third-party domain.** Browser navigation asks per-domain approval ("Allow Claude to act on https://..."), which no allow-rule covers. Read pages with `curl` or `WebFetch`. For competitor page-weight (rebuild rubric §4), `curl -sL -o /dev/null -w '%{size_download}'` on the HTML plus each parsed subresource gives size and request count with no browser - label it "curl-measured". Un-measurable without a browser → skip and flag, never block. Driving your OWN built `dist` through the local QA server is fine (localhost, no dialog).
  - **Old-site screenshots for the compare pitch** come from a rendering service over `curl`, never from your own browser: `image.thum.io` works for desktop and `api.microlink.io` (with `viewport.isMobile`) for mobile - both proven on 2026-08-20. `s.wordpress.com/mshots` returns 403; don't bother.
  - **Serbian business-registry checks** (`companywall.rs`, APR - worth doing, it caught a suspended business in that same batch) are JS-only SPAs that `curl` cannot search. A web search sometimes surfaces the record and sometimes does not. When it does not, record the operating status as **unverified and flag it for a phone call before sending** - never open a browser for it, never block the build.
- **No shell command that trips a built-in safety heuristic** - these fire regardless of permission rules. Never `rm` with a **variable-plus-glob** path (`rm -f $P/*.jpg` is read as possibly-empty and flagged, since empty `$P` expands to `/*.jpg`); `cd` first and use a literal relative path (`rm -f src/assets/photos/*.jpg`). Never `rm -rf` an interpolated path - prefer `find <literal-dir> -maxdepth 1 -name '*.jpg' -delete`, or just overwrite. Keep deletions inside the client repo or batch dir.
A dialog you hit is a defect in your command, not something to wait on - rewrite it in a form that does not prompt.

**Hard rules (business-wide, no exceptions):**
- Hosting is **Cloudflare Pages, never Vercel** - Vercel's free tier disallows commercial use and Pro doesn't scale against the small monthly maintenance retainers.
- **Deploys are local `wrangler pages deploy` - always.** There is no CI deploy and no CF token secret anywhere; wrangler is OAuth-logged-in on this machine. Pushing to GitHub backs up code, it does NOT deploy. Never report a change as live without having run the deploy and verified the URL.
- One private GitHub repo per client under `milan44i/`, scaffolded from the engine.
- Demos are unlisted: `indexable: false` (noindex + robots Disallow), `*.pages.dev` URL, never shared beyond the owner.
- All GitHub work through `gh-axi`, browser work through `chrome-devtools-axi`.
- Prices, durations, hours, addresses, and services are facts: transcribe, never invent. If a fact can't be verified, leave it out and flag it in the dossier. Price-transparency norms differ per vertical (auto škole and stomatolozi publish cenovnike; stolarija quotes per job; knjigovođe sell packages) - VERTICAL.md says which; where the vertical doesn't publish prices, the services structure ships without them, never with guessed numbers.
- **Price per the vertical's VERTICAL.md ## Pitch section - skills never carry canonical prices.** Scope is judged per dossier, price is not: it is fixed per vertical (set 2026-07-15; validation status tracked in VERTICAL.md Otvorene pretpostavke) - never quote anything else.
- **Never build a booking, scheduling, or client-portal system.** If the business books through a platform (VERTICAL.md names the vertical's platforms), the demo's booking CTA links their existing profile (`bookingUrl`); otherwise the engine's `BookingForm` (front-end only on demos) + tel. The site amplifies their existing flow.
- **Generative vs locked:** everything the eye sees is generated per business (layout archetype, hero pattern, typography, palette, texture/graphic language, imagery treatment, cenovnik presentation, micro-motion). Everything the crawler, screen reader, and maintainer see is engine-locked (content model, image-slot semantics, sr/en, SEO/JSON-LD/llms.txt, a11y floor, near-zero-JS perf budget, responsive rails). No bespoke JS per site.

## Mode detection

| Request looks like | Mode |
|---|---|
| "make a site/demo for <business>" | BUILD |
| "update X's cenovnik / hours / photos" | UPDATE |
| "<business> bought it / go live / connect domain" | CONVERT |
| "here is a list of businesses / build demos for all of these" | BATCH |

"Polish X / X looks unprofessional" is a design-polish pass on a deployed site, not an UPDATE - if no biz polish skill exists yet, run the restaurant `polish-design` procedure with paths swapped to `~/work/projekti/<dir>/` and say so in the report.

---

## BUILD mode

Pipeline: research → design DNA directions → dossier (auto-pick recommended) → build bespoke theme → QA → deploy unlisted → report. **No human checkpoint - the flow runs end to end without stopping.** The dossier is still produced as the build record; the recommended direction is selected automatically, and anti-convergence stays guaranteed by the registry veto (§2), not by a human pick.

### 1. Research

Sweep every reachable source. Sources split into four use-tiers with different rules:

**A. Facts** (name, address, phone, hours, services, prices, durations):
- **Vertical platform profiles** (VERTICAL.md Tržišne beleške names them - booking platforms, professional registries, vertical portals): usually the best structured source - service list, prices, hours, reviews. Note which platform they book through (feeds `bookingUrl`).
- **Google listing via web search**: exact name, address, phone, hours, review themes, photo inventory, and any **posted cenovnik/price-list photos or extracted menu/services panel** - a REQUIRED check on every research pass. Photographed price lists are the authority over Google's OCR extraction (it has shifted prices by a row and dropped items before - cross-check against the photo). Caution: Maps direct sweeps get reCAPTCHA-blocked - use web search + directory fetches instead of retrying; login-walled surfaces (IG) go through Milan's Chrome (claude-in-chrome), public Google through chrome-devtools-axi.
- **Existing website** (if any): scrape all copy, cenovnik/usluge, photos (note originals' URLs), structure. Measure it while you're there (see rebuild rubric).
- **Instagram/Facebook**: price posts, highlights, story locations, DM/phone booking instructions. IG is login-walled - use search snippets and any mirrors; never guess numbers off memory.
- **Directories** (011info, NaVidiku, PlanPlus): hours/contact cross-checks. Hours often conflict across directories - always flag, never pick silently.
- Verify load-bearing facts against at least two sources; discrepancies go in the dossier as open questions for the owner, not silent guesses.

**B. Story** (feeds the design brief and all copy):
- Review text mining: which services clients actually praise, the owner's/master's name (small operations are personal brands), atmosphere adjectives, "radi od 19XX" claims, specializations, awards and certifications (vinske medalje, licence, kategorije).
- Serbian press/blog features, listicles, TikTok presence.
- **Wayback Machine** on their current or dead site: history, old cenovnici, lost content - story gold, and a disarming pitch moment.

**C. Design reference** (mined, never shipped - zero licensing exposure):
- IG grid aesthetic, interior/workshop/estate photos, TikTok frames, Street View: derive the actual business's palette, materials, lighting (the oak barrels, the tiled ordinacija, the lift in the radnja) so the generated DNA matches the real place. Nothing from this tier is ever republished as an asset.

**D. Shipped photos - tiered waterfall (record the tier in the dossier):**
1. Business's own website images.
2. Their own Instagram/Facebook photos and **Yandex Maps org galleries** (`avatars.mds.yandex.net/.../orig` serves full resolution) - allowed ONLY for unlisted noindex demos pitched to that owner; swapped or properly licensed at sale (CONVERT checklist enforces this). **Privacy note:** photos with recognizable faces of patients/clients (fizioterapeuti, stomatolozi) and ESPECIALLY children (igraonice, škole jezika) - for the unlisted demo use only shots the business itself already published, prefer face-free material for children wherever it exists; at CONVERT the owner confirms consent or swaps them - put that line in the dossier and the CONVERT checklist. Pets are fine.
3. **Google Business listing photos** (owner or client uploads on the business's own listing; `lh3.googleusercontent.com/gps-cs-s/<token>=s1600-k-no` serves 1200-1600px originals) - same conditions as tier 2, INCLUDING the privacy note above (faces/children rules apply identically): unlisted noindex demos only, credited on the credits page, mandatory swap at CONVERT (Milanova odluka 2026-08-11).
4. CC-licensed placeholders with a credits page, flagged for replacement at onboarding.

Checking tier 1-3 (their site, IG/FB/Yandex, Google listing) is the default on EVERY build - relevant photos found there get used, not just inventoried; CC placeholders are the fallback when all three come up empty. TripAdvisor user photos are **not** shipped-photo sources - facts and story only. Never ship third-party stock as if it were theirs on a sold site. AI-generated photography is last-resort backfill only - an owner recognizes their own place and work.

### 2. Story-first design DNA

Derive, don't decorate. From the research, extract 2-4 concrete **story hooks** (the instructor's 30 years without a failed candidate, the third-generation vinograd, the mobile vulkanizer who comes to you, the igraonica's pirate ship). Then compose **2-3 competing DNA directions**, each built on a different hook. Every direction specifies all generative axes:

- layout archetype (page structure, section composition, nav pattern)
- hero pattern (how the first screen is constructed)
- typography pairing (display + text, with era/character justification)
- palette family (derived from tier-C design reference: the actual place/brand)
- texture / graphic language (borders, dividers, grain, ornament style)
- imagery treatment (duotone, film grain, full-bleed vs framed)
- cenovnik/usluge presentation style (the page clients actually come for)
- micro-motion (CSS-only; the near-zero-JS budget holds)

Each direction gets its story hook named and a one-line "why this fits". Mark one **recommended**.

**Anti-generic guard:** every vertical has its own interchangeable-default failure mode - VERTICAL.md Design DNA smernice names it (the medical teal-and-cross, the auto checkered-flag-and-carbon, the wine grapes-and-burgundy-serif, the kids primary-colors-balloon-font, the beauty blush-pink-and-gold-script). A palette/typography choice is only allowed if it traces to THIS business's actual interior, brand mark, or story - "teal because medicina" is a defect by definition. If the business's real identity IS the cliché color, the other axes must carry the uniqueness.

**Registry veto (anti-convergence, fleet-wide):** load the engine's theme fingerprint registry (`src/themes/_registry/*.json` in `biz-engine`). The registry spans ALL twelve verticals - collisions are checked against the entire fleet, not just this vertical (plus, per §BATCH, against this batch's already-approved picks). A proposed direction may collide with any shipped theme on **at most one axis**; if it collides on two or more, regenerate the colliding axes - and resolve the collision by returning to the story for a different hook, never by inventing arbitrary difference. A design decision that can't be traced to a dossier fact is a defect.

**Rebuild anti-reference:** if the business has an existing site, characterize its look in the brief and explicitly design away from it - the owner's first impression must be "night and day", never "same thing, cleaner".

The engine's preset themes are reference points and sample-data fallbacks only. Never pitch them to a new lead.

### 3. Scope (judged per dossier - no segment profiles)

No per-segment presets. Propose scope per business in the dossier: page set (a one-man vulkanizer may collapse to one-pager + usluge; a poliklinika or vinarija with events may take home/services/about/gallery/contact), copy depth, and photo bar (a premium business demo on CC placeholders undermines the claim - say so and propose the photo plan). VERTICAL.md Šta sajt mora da ima sets the must-have baseline (e.g. auto škola: kategorije + cena + uslovi; knjigovođa: paketi + ko je knjigovođa; igraonica: rođendanski paketi + galerija). Scope is part of the business's story; the dossier settles it automatically. Price is never scope-based - it comes from the vertical's VERTICAL.md ## Pitch section regardless.

### 4. Rebuild rubric (only when an existing site exists)

Makes "a lot better" falsifiable, and arms the compare pitch:

1. **Content-parity inventory**: crawl the old site; list every page, fact, service, price, and photo. The new site loses nothing - a vanished cenovnik kills a rebuild pitch at the worst moment.
2. **Measured deltas**: Lighthouse/CWV, page weight and request count, mobile usability, SEO structure (JSON-LD, sitemap, llms.txt, hreflang), sr/en coverage - captured before (their site) and after (the demo).
3. **Anti-reference**: old design characterized in the DNA brief as what to escape (see §2).
4. **Wayback sweep**: content their site lost over the years (see §1B).

### 5. Dossier (record, no stop)

The dossier is two artifacts working together (both modes, BUILD and BATCH):

- **`dna.json`** - the canonical machine-readable design spec the build step consumes. Full 8 axes **only for the recommended direction** (the one that gets built). Each alternate is a one-line **seed**, not a full axis set. Written at the client repo root (BUILD) or `<dir>/batches/<batch>/<slug>/dna.json` (BATCH).
- **`dossier.md`** - a thin human-readable index + sales record. It does **not** re-prose the axes; it points at `dna.json` and carries the record bits. Written at the client repo root (BUILD) or `<dir>/batches/<batch>/<slug>/dossier.md` (BATCH). Plain markdown.

`dossier.md` contents:

1. **Verified facts** - name, address, phone, email, IG handle, hours, socials, **segment** (drives schemaType and the pitch variant), booking platform (feeds `bookingUrl`), price range + source per fact; open questions highlighted.
2. **Photos found** - count, quality verdict, tier used and why; face/consent flag when relevant (§1D - mandatory line for children).
3. **Cenovnik/usluge source** - platform profile / IG price post / photographed price list / PDF / old site; transcription effort estimate; whether prices are published at all in this vertical; discrepancies flagged.
4. **Design DNA** - name the **recommended** direction's story hook and one-line why-it-fits, and say "full axes: see `dna.json`". State the registry-veto result. List each **alternate as a one-line seed**: `<story hook> - <one headline sentence>`.
5. **Scope proposal** - page set, copy depth, photo bar, and why (per §3).
6. **Pitch angle** - `compare` (existing site: rebuild rubric artifacts + measured metrics) or `invisible` (no site: "Google/AI can't see you today - a platform profile or FB page isn't a web presence you own").
7. **Names** - proposed repo (`milan44i/<slug>`), CF Pages branch (`<slug>` on the vertical's shared project), demo URL (`<slug>.<vertikala-projekat>.pages.dev`), theme slug.

In `dna.json`, each axis of the recommended direction carries a **fact-trace tag**: `"palette": "oak + slate + brass (← tasting-room photos, tier-C)"`. The `←` names the dossier fact the decision traces to.

Auto-select the **recommended** direction and run straight to build - do not stop to ask. The alternate **seeds** are back-pocket objection handlers: if the owner later pushes back on the look, expand that seed on that live signal, never speculatively. Open questions and unverified facts are not blockers - carry them into the dossier and surface them in the final report (§10).

### 6. Build

1. Scaffold the client repo: `cd ~/work/projekti/biz-engine && node scripts/new-site.mjs <dir>/<slug> <theme-slug> --name "<Biznis X>"` - the `<dir>/<slug>` argument makes it scaffold into `~/work/projekti/<dir>/<slug>`. This prunes themes to `_scaffold` + the new theme, resets the registry, stamps `site.json` config (`cfProjectName` = the vertical's shared Pages project, `cfBranch` = slug, `lockedTheme`, `indexable: false`, branch-deployment URL), and git-inits. It builds green immediately. Then `cd ~/work/projekti/<dir>/<slug> && pnpm install`.
2. Fill `src/data/*` in this order: `site.json` (facts, `schemaType` from VERTICAL.md per the dossier's segment, `bookingUrl` if they book through a platform), `services.json` + `packages.json` (transcribe from the §1 source with prices/durations where the vertical publishes them; fix typos and KEEP A LIST of fixes - they're pitch material), `copy.json` (both languages, grounded strictly in researched facts and VERTICAL.md Copy ton; write sr first, translate to en yourself), `gallery.json` + `images.json` (map semantic slots), `pitch.json`.
3. Photos into `src/assets/photos/` (downloaded per tier), logo into `src/assets/brand/` if they have a usable one (`config.logo`), else leave `null` (text fallback).
   - **Favicon is the business's identity, never a generic/engine placeholder.** Source in order: (a) if they already had a website, keep the same favicon it used; (b) otherwise their own logo/mark (IG/FB profile picture is usually the canonical mark) - cropped square, legible; (c) if no logo exists anywhere, generate a simple representative mark from the design DNA (a monogram in the theme's display face, or a single motif from its graphic language); never ship the engine default. Wire it in `site.json`/head config.
4. **Style the bespoke theme** in `src/themes/<theme-slug>/` from the approved DNA direction using the `frontend-design` skill, and fill its real registry entry (axes from the dossier's DNA, storyHook, date, cssPrefix). **Claim the CSS prefix before writing a line of CSS:** it is the single class on the theme's `<body>`, must be at least 3 characters, and must not appear as `cssPrefix` in any engine registry entry - two themes on one prefix is invisible in a one-theme client repo but corrupts the engine's chooser build, and renaming it later means touching the token block, every class and every `@media` variant. `import-theme.mjs` and `validate-registry.mjs` both reject a duplicate. The theme owns its design tokens, typography, textures, and layout files, but **must compose engine primitives** (`SlotImage`, `ServiceList`, i18n text, `BookingForm`, lightbox). Raw `<img>`, hand-rolled cenovnik markup, or duplicated i18n plumbing inside a theme is a defect - the engine's guard lint fails the build on it.
5. `pnpm build` - the engine fails loudly on missing image slots or links to disabled pages; fix data, not guards.

### 7. QA

- `node scripts/qa.mjs` - deterministic pass first: internal links, srcset, hreflang pairs, JSON-LD parse, noindex/robots consistency, favicon, llms.txt/sitemap, fragment-anchor targets. Fix failures before any visual work.
- **Deterministic gate (send-ready bar) - always, before any visual pass:** after `qa.mjs`, run `node scripts/cascade-sweep.mjs` and fix/harden every BROKEN + LATENT pair (raise to 0,2,0) until it prints `0 broken, 0 latent`, then `node scripts/probe.mjs` (Playwright headless horizontal-overflow check over the built `dist`, every enabled page × mobile 390 / desktop 1440; **detect-only** - cascade-sweep is the only auto-fixer). A `probe.mjs` non-zero exit is **flag-not-block**: never block the build on it - in BUILD surface it in the report + handoff (recommend a `polish-design` pass on the flagged page), in BATCH write `gate: <overflow summary>` to `state.md` + the demo's `PIPELINE.md` Napomena and continue. The gate does NOT set the `Polish?` column (that stays the human Tier-2 tracker).
- `node scripts/qa.mjs --serve` - serves `dist` on a free port. **Visual pass is scoped, not exhaustive**: screenshot and read **just two pages** at desktop 1440×900 + mobile 390×844: the **homepage** (the pitch face) and the **cenovnik/usluge page** (longest, most overflow-prone; on a one-pager, the home page's services section). ~4 reads, flat regardless of page count.
  - **Tripwire → read all pages:** if either read shows a **theme-level** defect (broken layout primitive, palette/type misrender, systemic overflow, a mis-composed engine primitive), expand and read every enabled page. A **data typo** is not a tripwire: fix the data and re-shoot only that page.
- Known capture artifacts (do NOT "fix" these): lazy-decoded images blank in full-page CDP captures; load animations frozen at opacity 0; pages >16384px stitch wrong; 100vh heroes distort under the tall-viewport workaround. Verify suspicious findings with normal-viewport shots before changing code.
- **Interactions are engine-owned - do NOT click-test any of them per build.** The booking form (closed-day rejection + validation), gallery lightbox, language switch, and mobile burger nav run on shared engine JS covered by the engine's Playwright suite. Re-verifying any interaction per demo is pure waste.
- **Favicon check**: the browser-tab icon is the business's own mark (per Build §6.3), legible at 16×16, not the engine default.

### 8. Pitch asset

- **compare mode** (existing site): rebuild-rubric artifacts are the ammunition - parity inventory framed as "nothing lost, everything gained", plus measured metrics: old site via `performance.getEntriesByType('resource')` decodedBodySize (wrap multi-statement eval in an IIFE), request and JS-file counts; screenshot old+new, desktop+mobile into `src/assets/pitch/`; fill `pitch.json` metrics/fixes with measured numbers and the typo-fix list; the offer page serves at `/ponuda/` and its `offer` block gets tailored per client.
- **invisible mode** (no site): pitch.json `fixes` lead with invisibility - Google/Maps/AI assistants can't read an Instagram profile, an FB page, or a platform listing you don't own; show what `llms.txt` + schema make possible; the cenovnik that today lives in an IG highlight or a laminated sheet becomes indexable HTML.
- Both modes: the one-of-one line is the spine of the pitch - "this design exists nowhere else; it was built from your story." Name the story hook in the pitch copy. VERTICAL.md Pitch adds the vertical-specific angle (what these owners care about) - consult it before writing `pitch.json`.

### 8b. Pitch message (Serbian, ready to send)

Every finished demo ships with ONE ready-to-send outreach message for the owner. Deliver it in the report (BUILD) and write it to `<dir>/batches/<batch>/<slug>/pitch-message.md` (BATCH).

**The canonical template lives in `~/work/projekti/<dir>/pitch-template.md`** - the single source of truth shared with the `biz-pitch` skill. Read it from there; never restate it from memory. The template may contain **named segment variants** (VERTICAL.md Pitch maps segment -> variant, e.g. "za salon" vs "za ambulantu") - pick the variant by the dossier's segment, then send it verbatim: the ONLY per-demo substitution is the demo URL (both occurrences - base URL, and base + `/ponuda/`). Do not reword, shorten, add a story hook, or state a price. Keep proper Serbian diacritics (č/ć/š/ž/đ) exactly as written. The same text serves as Viber message and IG DM (no email - kanal odluka 2026-08-16).

### 9. Deploy (unlisted demo)

1. Create private repo: `npx -y gh-axi repo create <slug> --private --description "..."` ; `git remote add origin git@github.com:milan44i/<slug>.git`; push `main`. This is code backup only - **it does not deploy**.
2. **Demos share ONE CF Pages project per vertical** (decision 2026-08-15 - the account's 100-project cap killed project-per-demo; dedicated projects are for sold sites only). Project name = vertical dir, exception `saloni` → `beauty-saloni` (pages.dev name taken); all 13 exist. Never create a per-demo project. If a brand-new vertical ever needs one: `npx wrangler pages project create <dir> --production-branch prod` - `prod` is a reserved branch nothing deploys to, so a forgotten `--branch` can't overwrite anything. Account-level model, cap status, and prune policy: `infra` skill.
3. Deploy as a branch deployment: `pnpm build && npx wrangler pages deploy dist --project-name=<cfProjectName> --branch=<cfBranch> --commit-dirty=true` (both values from `site.json` config; wrangler is OAuth-logged-in on this machine - if not, ask Milan to run `wrangler login`).
4. Verify the live demo URL `https://<slug>.<projekat>.pages.dev` (the branch alias) renders.
5. Confirm noindex + robots Disallow on the live URL.
6. **Append a row to `~/work/projekti/<dir>/PIPELINE.md`**: `Ime | Kraj | Demo URL | Email | Instagram | Ponuda poslata? | Ishod | Polish? | Napomena`. Fill Ime/Kraj/Demo URL, Email and Instagram from the dossier (or `-`), leave "Ponuda poslata?", "Ishod", "Polish?" as `-`. **Record the segment in Napomena** - `biz-pitch` picks the template variant by it. Keep the table header + legend intact. **In the same step, delete the business's row from `~/work/projekti/<dir>/CANDIDATES.md`** if it has one - built demos leave CANDIDATES for PIPELINE. A row left behind at `dossier-ready` gets re-picked by the next batch's auto-pick and rebuilt. In BATCH this is the build subagent's per-demo job, not the orchestrator's at batch end.
7. **Import the theme back into the engine - always in a dedicated git worktree, never the shared `biz-engine/` checkout.** Concurrent sessions (any vertical!) share that checkout's HEAD, index, and `dist/`; working in place races them. The worktree gives this sync its own HEAD + index + `dist/`:
   - `cd ~/work/projekti/biz-engine && git worktree add ~/work/projekti/biz-engine-<slug> -b theme/<slug>`
   - `cd ~/work/projekti/biz-engine-<slug> && pnpm install`
   - `node scripts/import-theme.mjs ../<dir>/<slug>`, run the verify commands it prints
   - stage import-theme's whole footprint (registry file, theme dir, `src/lib/routes.ts`, `package.json`, `pnpm-lock.yaml`, `src/data/images.json`, `src/data/copy.json`); `git add -A` is safe **here** because the worktree's index is isolated. Commit, `git push -u origin theme/<slug>` (the pre-push hook runs `pnpm verify` - never bypass with `--no-verify`), PR via gh-axi, merge once verify passes
   - `cd ~/work/projekti/biz-engine && git worktree remove ~/work/projekti/biz-engine-<slug>` once merged
   **A build is not done until its registry entry is on engine main** - this is what keeps the §2 veto honest across the fleet.

### 10. Report

Live demo URL, chosen DNA direction + story hook, scope, pitch angle, **the pitch message (8b, paste-ready)**, typo-fix count, photo tier (+ consent flag if tier 2 with faces/children), registry entry merged to engine main, PIPELINE.md row appended, anything left open (missing phone, unverified hours/prices). Update memory (the biz-verticals memory file or the client's own). **Not done until on the board:** the demo must appear on the outreach tabla `https://poruke.sajt-analiza.pages.dev/` - in solo BUILD refresh it from `~/work/projekti/sajt-analiza` and verify the business shows live (in BATCH the orchestrator does this once at batch end).

**Handoff:** the deterministic gate (cascade-sweep + probe, §7) already ran in-build, so recommend a `polish-design` (human Tier-2) pass **only if the gate flagged an overflow** or beautification is wanted - not as a blanket default. Then ask: "Demo je live. Želiš li da pozovem `biz-pitch` da napravi draft ponude za <biznis>?" On "da", invoke `biz-pitch <slug>` (it prints a paste-ready Viber/IG DM message - it never emails or sends).

---

## UPDATE mode (48h retainer changes)

1. Locate the client repo in `~/work/projekti/<dir>/<slug>` (clone from GitHub if missing; `pnpm install` if node_modules was pruned). If the vertical isn't stated, find the slug by checking the registry's dirs.
2. Apply the change in `src/data/` (cenovnik prices/durations, hours, photos, copy). Data-only changes are the norm; theme edits are the exception - if a theme edit is needed, mirror it to the engine **in a per-slug git worktree, never the shared engine checkout** (see §9.7), run `pnpm verify` there, and PR + merge. Apply your edit targeted, don't copy whole files over blind.
3. `pnpm build`, `node scripts/qa.mjs`, screenshot the affected pages, read them.
4. Commit, push (backup), then **deploy explicitly**: `npx wrangler pages deploy dist --project-name=<cfProjectName> --branch=<cfBranch> --commit-dirty=true` (from `site.json` config; sold sites have no `cfBranch` - deploy their dedicated project without `--branch`). Pushing alone deploys nothing. Verify the change on the live URL.
5. Report: what changed, live URL, turnaround time.

## CONVERT mode (demo → sold site)

1. `site.json` config: `indexable: true`, prune `enabledPages` to what was sold, set `config.url` to the custom domain.
2. Delete `src/pages/ponuda.astro`, `src/data/pitch.json`, `src/assets/pitch/`.
3. **Photo licensing + consent**: replace every Tier-2/3 (social/Yandex/Google-listing scrape) photo with owner-provided originals or properly licensed images; owner confirms consent for any recognizable client/patient faces that stay - **written confirmation for children's photos (igraonice, škole jezika), no exceptions**; any surviving Tier-4 CC photo gets a visible credits page.
4. Real booking contact: confirm phone/email/`bookingUrl` are the business's own; if they want the form live, deploy the booking Worker and set `config.bookingEndpoint`; `demoNote` copy removed from the flow.
5. **Dedicated Pages project** (sold sites get their own; demos live as branches): `npx wrangler pages project create <slug> --production-branch main`, then in `site.json` config set `cfProjectName: <slug>` and remove `cfBranch`. The old demo branch on the vertical project stays live (noindex) - harmless, delete its deployments if the owner asks.
6. Custom domain: **Milan pays and does everything** (registration, DNS, cert) through his own registrar account, cost absorbed in the retainer; the **business is named registrant** so "domen je vaš" stays literally true (odluka 2026-08-16; .rs goes through RNIDS-accredited registrars, ~2500 RSD/yr). The owner does nothing technical. Point it at the new dedicated Pages project, verify cert. Commercial side of acceptance: `~/work/projekti/terenska-prodaja/ONBOARDING.md`.
7. Rebuild, `node scripts/qa.mjs` (sold-site invariants: robots Allow, sitemap, llms.txt), deploy via `npx wrangler pages deploy dist --project-name=<slug>`, verify: root URLs, no demo note, canonical + hreflang on the custom domain.
8. Ask Google/Bing to discover it (Search Console is Milan's manual step - flag it).
9. Report + update memory: client is live, retainer clock starts. Flip the registry entry's `status` to `sold` in the engine (small PR). Move the demo's PIPELINE.md row to the vertical's `PIPELINE-ARHIVA.md` (Ishod `prihvatili`, note "live na <domen>").

---

## BATCH mode (list of businesses)

Orchestrates BUILD over a list with **no gates** - research, auto-pick, and build run straight through. **Batches are per-vertical**: a mixed list splits into one batch per vertical, run one after another. Context is the scarce resource: the orchestrating session never does research, theme generation, or QA itself - subagents do, and everything they produce lands in files, not in the conversation.

### 0. Preflight (fail fast)

Create `~/work/projekti/<dir>/batches/<YYYY-MM-DD>-<label>/` with `state.md`: the list, one status line per business (`pending -> researched -> picked-<direction> | skipped-<reason> -> built -> deployed -> registered | failed-<reason>`). `registered` means the theme + registry entry are merged to engine main - **a business is not finished until it reaches `registered`**. Before any research, verify the batch can actually ship: `npx wrangler whoami` logged in, gh-axi authed. Anything missing -> stop and ask Milan now, not at deploy #1. Check `~/work/projekti/<dir>/CANDIDATES.md` for candidates already researched by an earlier batch (status `dossier-ready`) before researching anyone from scratch.

### 1. Research fan-out (subagents), overlapped with builds

One research subagent per business, 2-3 concurrent, each spawned with `subagent_type: "biz-research"` (Sonnet at `xhigh` effort - see `~/work/projekti/.claude/agents/biz-research.md`). The research lane is fact-gathering, transcription and URL verification, which Sonnet does at full quality for roughly a third of the cost; measured 2026-08-12, research was ~40% of a batch's total tokens. **The build lane stays on the session model (Opus)** - it carries the theme code, the deterministic gate and the registry merge. Do not "simplify" by putting both lanes on one model.

Each research subagent runs BUILD steps 1-5 and writes `<batch-dir>/<slug>/dna.json` plus the thin `<batch-dir>/<slug>/dossier.md`. It returns to the orchestrator ONLY: slug, pitch/skip verdict + one-line reason, recommended direction, open-question count. A bad candidate (already has a strong site, closed, no usable photos) gets verdict skip-with-reason, and the orchestrator honors that verdict automatically.

**Incremental deconfliction (no barrier):** as each dossier lands, check its recommended direction immediately - against the engine's fleet-wide registry AND against every already-approved pick in this batch (max 1 shared axis anywhere). Pass -> approved, eligible to build while later research is still running. Collision -> regenerate from that business's story, re-check. Do NOT wait for all research to finish before build #1 starts.

### 2. Auto-pick (no stop)

`state.md` plus the per-business dossier files ARE the batch record. For each business, take the research subagent's verdict as final. Write picks and skips to `state.md` as they happen.

### 3. Build + deploy (sequential builds, overlapped with research)

One build subagent per approved business, **strictly sequential among themselves** - a defect found in build #2 must not get cloned into #7, and registry merges must land in order. Because the registry is fleet-wide, this sequencing holds across the whole engine: **never run two biz-site build lanes concurrently, even for different verticals.** The build lane still runs concurrently with the research lane. Each subagent runs BUILD steps 6-10 from its dossier + picked direction, deploys, merges theme + registry to engine main **in a per-slug worktree (§9.7)**, deletes its business's row from `CANDIDATES.md` (§9.6 - built demos leave CANDIDATES for PIPELINE), and writes the pitch message to `<batch-dir>/<slug>/pitch-message.md`. It updates `state.md` and returns ONLY: demo URL, QA verdict, open items. A failure -> `failed-<reason>` in `state.md`, continue with the next business; the batch never dies on one.

### Context discipline

- Dossiers, dna.json, pitch assets, and QA screenshots live in the batch dir; the orchestrator reads `state.md` and subagent one-liners, never full dossiers or images.
- Any fresh session resumes a batch by reading `state.md` and continuing from the first non-terminal status.
- **Researched-but-unbuilt candidates get written back to `~/work/projekti/<dir>/CANDIDATES.md`** at batch end: `dossier-ready` (with the dossier path) or `skipped-<reason>` - paid research never evaporates. Built demos are the opposite: their rows are already deleted per demo in §9.6 - never write a built business back.

### Report

One table: business | verdict | demo URL | direction + story hook | pitch angle | open questions - plus each business's pitch message printed in full, paste-ready. Update the biz-verticals memory once per batch, not per business.

**PIPELINE reconciliation (orchestrator, mandatory):** at batch end, for every demo at `deployed` in `state.md`, confirm a `PIPELINE.md` row exists (grep the demo URL); append any that are missing (segment in Napomena, per §9.6) - and confirm its `CANDIDATES.md` row is gone, deleting any straggler (a leftover `dossier-ready` row means tomorrow's picker rebuilds the same demo). A demo is not reported done until its row is present.

**Outreach tabla (orchestrator, after reconciliation):** a demo is not done when it is live - it is done when it is on the board Milan actually sends from, `https://poruke.sajt-analiza.pages.dev/` (odluka 2026-08-19). A demo missing from the board never gets pitched. Procedure and its gotchas live in `~/work/projekti/sajt-analiza` (collect -> analyze -> `build-phone.mjs` -> `wrangler pages deploy dist-poruke --branch=poruke`); run it once per batch, not per demo, and verify the new businesses appear on the live page. This publishes Milan's own worktable - it is NOT outreach, and it does not relax the rule that pitch messages are files only, never sent.

**Batch-dir cleanup (orchestrator, final step - always after reconciliation):** run `node scripts/cleanup-batches.mjs --apply` from the engine root (if the script exists in biz-engine; otherwise clean resolved batch dirs by hand with the same rule: delete only dirs where every business is live in PIPELINE.md or marked skipped/failed). Ordering matters: reconciliation first.

**Handoff:** after the table, recommend a design-polish pass per shipped demo, then ask once - "Demoi su live. Želiš li da pozovem `biz-pitch` da napravim draftove ponuda?" On "da", invoke `biz-pitch <slug> <slug> ...`; name any that will go via IG DM instead of email.

## SEO / AI baseline

Built into the engine - verify, don't reimplement: JSON-LD with the `schemaType` VERTICAL.md prescribes for the segment, full HTML cenovnik/usluge (never image-only - it's the flagship pitch point: today their offer lives in an IG highlight, a PDF, or a laminated sheet nobody can index), sitemap, hreflang sr/en, `llms.txt`, agent-welcoming robots.txt (sold mode), astro:assets image optimization, near-zero JS. If a client build needs something beyond this, add it to the ENGINE so every vertical benefits, then pull it into the client repo.
