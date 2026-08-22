---
name: biz-scout
description: Finds new leads for Milan's website-demo business in the 12 biz verticals - popular small businesses (strong reviews, visible reputation) with no website or a bad one. Verticals - fizioterapeuti i maseri (masaža), pet frizeri i veterinari (veterinarska ambulanta), auto škole, vulkanizeri, auto servisi (mehaničari, mali/veliki servis), stomatolozi i privatne ordinacije, vinarije i ruralni turizam (salaš, etno selo), knjigovođe (knjigovodstvena agencija), stolarija/PVC/renoviranje, škole stranih jezika, igraonice i rođendaonice, beauty saloni (kozmetički salon, nail studio/nokti, trepavice i obrve - lash & brow, PMU). Maintains the vertical's CANDIDATES.md pool, presents the top 9 ranked, on approval hands the first 3 straight to biz-site. Use whenever Milan asks to find leads in any of these verticals ("nadji vulkanizere", "nadji auto servise", "nadji fizioterapeute", "nadji salone", "ko su sledeće auto škole", "ima li novih stomatologa"), to grow a vertical's pipeline, or asks what to scout next after a batch. For restorane use restaurant-scout - not biz-*.
---

# biz-scout

Front door of the pipeline for the generic verticals: `biz-scout` finds leads -> `biz-site` researches and builds demos -> `biz-pitch` sends the offer. This skill only does the first part - it never writes a dossier, never builds, never messages an owner. One trio serves twelve verticals; every run is scoped to exactly ONE vertical, resolved before anything else.

## Vertical resolution (always first)

1. Identify the vertical from the argument or the message itself: "nadji vulkanizere" -> vulkanizeri; "ima li novih auto škola" -> auto škole; "salaš" / "etno selo" -> vinarije i ruralni turizam.
2. Read `~/work/projekti/VERTICALS.md` (the registry) and resolve the vertical's `<dir>`. Restorani are listed there as a standalone vertical - requests about them go to `restaurant-scout`, never this skill.
3. Read `~/work/projekti/<dir>/VERTICAL.md` - segments, scout sources, popularity signals, geography, market notes (expected structure documented in `biz-site`). Everything vertical-specific below comes from that file, never from memory.
4. Vertical unclear ("nadji nove leadove" with no noun, an unknown business type)? Ask Milan which vertical. Never guess, never sweep all twelve at once.

All per-vertical paths below live under `~/work/projekti/<dir>/`.

## Invocation

- `biz-scout <vertikala>` - general sweep of that vertical, all segments, biased toward geographic diversity (see §2).
- `biz-scout <vertikala> <segment>` (a segment from VERTICAL.md, e.g. "mobilni vulkanizer", "rehabilitacija", "salaš", "nail studio") - scope every research subagent to that segment. Geographic slicing still applies for diversity, but the popular-AND-underserved filter now also has to match the given segment, and the top-9 presentation (§5) filters to it too.

The in/out-of-scope boundary per vertical (what counts as a lead, what is explicitly not hunted - e.g. hospital-scale clinics, franchise chains with agency budgets) lives in VERTICAL.md Identitet/Segmenti. Honor it; it keeps the pool clean.

## Source of truth: CANDIDATES.md

`~/work/projekti/<dir>/CANDIDATES.md` is the single pool for every lead of that vertical between "found" and "built" - both this skill and `biz-site` read and write it. A row starts cheap (`biz-scout` found a name and a reason to look closer) and can gain real research weight later (`biz-site` writes back a dossier path) without moving to a different file - the Status and Dosije columns carry that distinction, not a file boundary.

Columns: `Ime | Opština | Segment | Zašto popularan | Sajt danas | Instagram | Status | Dosije | Napomena`. For verticals scouted beyond Belgrade (VERTICAL.md says which - vinarije being the obvious one), Opština holds mesto/region instead. Instagram stays a first-class column even where the vertical isn't IG-first; `-` when absent, other channels (FB page, phone) go in Napomena.

Status values:
- `candidate` - scouted, no research yet. Dosije is `-`.
- `queued` - Milan said go, handed to `biz-site`, build not confirmed yet.
- `dossier-ready` - `biz-site` researched it (has a real dossier) but didn't build it in that run; Dosije points at `dossier.md`. Ready to build as-is - cheaper than a fresh `candidate` since the expensive step is already paid for.
- `skipped-<reason>` - `biz-site` researched it and passed (already has a decent site, closed, no usable photo material, etc.). Keep the row - it's a record that money was spent and why the answer was no - unless the reason is permanent and Milan says to drop it. `skipped-dobar-sajt` can also come from this skill's skor gate (§3): old site scored > 70.

Row removed once the business shows up in `PIPELINE.md` (built) or Milan permanently passes on it. The build-time removal is `biz-site`'s job: its build agent deletes the row in the same step that appends the `PIPELINE.md` row (§9.6 - built demos leave CANDIDATES for PIPELINE); this skill only cleans up stragglers. Never write dossier-quality claims (verified hours, full cenovnik, design DNA) into a `candidate` row yourself - that's `biz-site`'s job, and doing it here would misrepresent a cheap guess as paid research.

## Flow

### 1. Reconcile + build the exclude set

Read `PIPELINE.md` (every built Ime + demo-URL slug), `CANDIDATES.md` (existing rows), and `ls ~/work/projekti/<dir>` (client repo folder names). Union all of it, name-normalized, into an exclude set - nobody already built or already sitting in the pool should resurface as a "new" find.

While reading CANDIDATES.md: any row - whatever its status - whose name now appears in `PIPELINE.md` is built; `biz-site` should have deleted it at build time, so it's a straggler - remove it. A `queued` row still absent from PIPELINE.md is still in flight - leave it, but mention it in your summary. `dossier-ready` rows are genuinely useful fresh picks (cheaper to build) - surface them, don't exclude them.

### 2. Research fan-out (subagents)

Split the search so subagents don't all rediscover the same famous places - by **segment × geography**, using VERTICAL.md's Segmenti and Tržišne beleške. Geography defaults to Belgrade opštine (centar / NBG-Zemun / periferija slices); VERTICAL.md can widen it (e.g. vinarije scout wine regions across Serbia). Always add one cross-segment **platform/directory sweep** using the vertical's named platforms. Hand every subagent the exclude set up front. Instruct each subagent explicitly to do the research ITSELF (no sub-sub-agents) and to end with the results table as its final message.

If Milan passed a segment (§Invocation), every subagent additionally filters for it.

Each subagent looks for businesses that are BOTH:
- **Popular and alive** - judged by the sources and thresholds in VERTICAL.md Tržišne beleške: each vertical has its own platform/directory landscape (booking or review platforms, professional registries, vertical portals). Generic core on top: Google rating + review count via web search, 011info/NaVidiku/PlanPlus footprint, Instagram/Facebook/TikTok activity where the vertical actually lives online, longevity claims ("od 1998"), listicles and press. Google Maps direct sweeps get reCAPTCHA-blocked - use web search + directory cross-checks instead. Must show 2025-2026 signs of life.
- **Underserved on the web** - no website at all (social/directory presence only), a dead or NXDOMAIN domain, a parked domain, an ancient template build, not mobile-friendly, no cenovnik/usluge content, or a "website" that is really just a platform profile or linktree - **a platform profile is NOT a website** (but note which platform: it may feed `bookingUrl` later). A business with a solid modern site is not a lead no matter how popular.

Keep this a lightweight discovery sweep, not a dossier - no cenovnik scraping, no photo tiering, no design DNA. Each subagent returns roughly 8-12 raw candidates: name, opština/mesto, segment, one-line popularity evidence (number + source), one-line website-gap evidence (what it actually observed - it must WebFetch any claimed domain itself), Instagram handle or other channel, contact if public, rough sources.

### 3. Merge, dedupe, rank

Combine all shortlists, dedupe by name, drop anyone in the exclude set who slipped through anyway, and rank by popularity × website-gap. Distrust unverified numbers: a follower count from a search snippet is weaker than a review count the subagent saw on the page - prefer verified evidence when candidates are close. Bias toward geographic and segment diversity when candidates are close in quality. Skip the diversity bias on a segment-scoped run if it would mean dropping a clearly-better candidate.

**Skor gate (pravilo, 2026-08-20):** before ranking, score every merged candidate whose `Sajt danas` is a real website (not a platform profile/linktree): `node ~/work/projekti/sajt-analiza/scripts/score-url.mjs <url>`. Skor > 70 → skip UNLESS the dizajn pogled below says `loš` (an ugly-but-technically-fine site is still a lead - the design IS the pitch). Skipped rows go in as `skipped-dobar-sajt` with `skor NN` in Napomena, never surfaced in the top 9. Skor ≤ 70 or a dead site → lead; record `skor NN` (or `sajt mrtav`) in Napomena. Candidates without any site skip the gate.

**Dizajn pogled (pravilo, 2026-08-20):** every candidate with a live real site also gets its design LOOKED at - the score measures tech/SEO, not looks. Screenshot the old site via the chrome-devtools-axi CLI (Bash; never the in-app browser tool on a tuđ domen - that's what kills unattended runs), Read the image, judge: `loš` only for objectively dated or broken looks (layout se raspada, 2000s template, sitne/mutne fotografije, neupotrebljivo na telefonu) - not taste. Record `dizajn: loš - <beleška>` or `dizajn: ok` in Napomena. For every `loš`, ALSO add the entry to `~/work/projekti/sajt-analiza/input/dizajn.json` as `"<Ime>": {"ocena": "los", "beleska": "<...>"}` - the Viber pitch quotes the beleška verbatim, so write it as half a sentence, lowercase, no trailing period, describing the site (e.g. `deluje kao da je pravljen pre petnaest godina, a na telefonu se raspored raspada`).

### 4. Update CANDIDATES.md

Append newly found leads as `candidate` rows with Segment and Instagram filled in (skip anyone already in the file). Treat this as a growing pool across runs, not a one-shot list.

### 5. Present the top 9

Pull the 9 best rows - prioritize `dossier-ready` (already paid for) over plain `candidate`, then rank by popularity × website-gap - filtered to the requested segment if one was given. Present ranked, in the same terse Serbian voice as PIPELINE.md:

| # | Ime | Opština | Segment | Zašto popularan | Sajt danas | Instagram | Status |
|---|-----|---------|---------|------------------|------------|-----------|--------|

### 6. Kickoff gate

Ask once, naming the actual top 3: **"Želiš li da počnem da pravim demoe za prva 3 (<Ime1>, <Ime2>, <Ime3>)?"**

- **Yes:** mark those 3 rows `queued` in CANDIDATES.md, then invoke `biz-site` naming the vertical plus the 3 names as a plain list (its mode detection reads "here is a list of businesses, build demos for these" as BATCH mode). `biz-site` owns everything from there. Don't pre-research these 3 yourself and don't pre-empt biz-site's own pitch handoff - hand off the names and stop.
- **No / not now:** stop. Rows stay as-is in CANDIDATES.md for next time.

### 7. Done - don't self-chain

This skill does not queue up batches 2 and 3 on its own. Milan decides when to come back for the next 3, either by re-running `biz-scout <vertikala>` (which will reconcile what got built, top the pool back up to 9, and ask again) or by naming rows straight to `biz-site` himself.
