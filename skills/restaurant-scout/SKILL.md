---
name: restaurant-scout
description: Finds new restaurant leads in Belgrade for Milan's website-demo business - popular restaurants (strong reviews/reputation) that currently have no website or a bad one. Optionally scoped to a restaurant type/segment (e.g. "fine dining", "roštiljnica", "riblji restoran"). Maintains CANDIDATES.md as the growing pool of pre-build leads, presents the top 9 ranked, and on approval hands the first 3 straight to restaurant-site to build. Use whenever Milan asks to find new restaurants, scout leads, grow the pipeline, find candidates of a given type, "ko su sledeci", "nadji restorane", "nadji [tip] restorane", "šta je sledeće", or asks what to do after finishing a batch of builds - even if he doesn't name this skill directly.
---

# restaurant-scout

Front door of the pipeline: `restaurant-scout` finds leads -> `restaurant-site` researches and builds demos -> `restaurant-pitch` sends the offer. This skill only does the first part - it never writes a dossier, never builds, never emails. Sibling of `restaurant-site` and `restaurant-pitch`; all three live under `~/work/projekti/restorani/` (see `AGENTS.md`).

## Invocation

- `restaurant-scout` - general sweep, any restaurant type, biased toward opština diversity (see §2).
- `restaurant-scout <tip>` (e.g. "fine dining", "roštiljnica", "riblji restoran", "picerija", "vegetarijanski") - scope every research subagent to that segment specifically. Opština slicing still applies for diversity, but the popular-AND-underserved filter now also has to match the given type. The top-9 presentation (§5) filters to that type too, so a scoped run doesn't surface unrelated leads sitting in the pool from an earlier general sweep.

## Source of truth: CANDIDATES.md

`~/work/projekti/restorani/CANDIDATES.md` is the single pool for every restaurant between "found" and "built" - both this skill and `restaurant-site` read and write it. A row starts cheap (`restaurant-scout` found a name and a reason to look closer) and can gain real research weight later (`restaurant-site` writes back a dossier path) without moving to a different file - the Status and Dosije columns carry that distinction, not a file boundary.

Columns: `Ime | Opština | Tip | Zašto popularan | Sajt danas | Status | Dosije | Napomena`.

Status values:
- `candidate` - scouted, no research yet. Dosije is `-`.
- `queued` - Milan said go, handed to `restaurant-site`, build not confirmed yet.
- `dossier-ready` - `restaurant-site` researched it (has a real dossier) but didn't build it in that run; Dosije points at `dossier.md`. Ready to build as-is - cheaper than a fresh `candidate` since the expensive step is already paid for.
- `skipped-<reason>` - `restaurant-site` researched it and passed (already has a decent site, closed, no usable photo material, etc.). Keep the row - it's a record that money was spent and why the answer was no - unless the reason is permanent and Milan says to drop it. `skipped-dobar-sajt` can also come from this skill's skor gate (§3): old site scored > 70.

Row removed once the restaurant shows up in `PIPELINE.md` (built) or Milan permanently passes on it - same hygiene rule the old BACKLOG.md used ("kad se kandidat izgradi ili trajno otpiše, ukloniti red"). The build-time removal is `restaurant-site`'s job: its build agent deletes the row in the same step that appends the `PIPELINE.md` row (§9.6 - built demos leave CANDIDATES for PIPELINE); this skill only cleans up stragglers. Never write dossier-quality claims (verified hours, menu prices, design DNA) into a `candidate` row yourself - that's `restaurant-site`'s job, and doing it here would misrepresent a cheap guess as paid research.

## Flow

### 1. Reconcile + build the exclude set

Read `PIPELINE.md` (every built Ime + demo-URL slug), `CANDIDATES.md` (existing rows), and `ls ~/work/projekti/restorani` (client repo folder names). Union all of it, name-normalized, into an exclude set - nobody already built or already sitting in the pool should resurface as a "new" find.

While reading CANDIDATES.md: any row - whatever its status - whose name now appears in `PIPELINE.md` is built; `restaurant-site` should have deleted it at build time, so it's a straggler - remove it (mirrors the reconciliation `restaurant-site` BATCH mode does for PIPELINE.md itself). A `queued` row still absent from PIPELINE.md is still in flight - leave it, but mention it in your summary so Milan understands why it isn't being re-offered as a fresh pick. `dossier-ready` rows are genuinely useful fresh picks (cheaper to build) - surface them, don't exclude them.

### 2. Research fan-out (subagents)

The built fleet is concentrated in Novi Beograd/Zemun (see PIPELINE.md) - counter that by splitting the search across opštine instead of letting every subagent independently rediscover the same five famous places. A reasonable split: {Vračar, Zvezdara}, {Stari Grad, Dorćol, Savski Venac}, {Voždovac, Čukarica, Rakovica}, {Novi Beograd, Zemun - lowest priority, already saturated}. Hand every subagent the exclude set up front so search budget isn't wasted re-finding Kesten or Dren.

If Milan passed a type (§Invocation), every subagent additionally filters for that segment - a "fine dining" run should come back with fine dining across all four slices, not a mixed bag.

Each subagent looks for restaurants that are BOTH:
- **Popular** - strong Google Maps rating and review count, TripAdvisor presence, food press/blog mentions, an active delivery-platform listing (Wolt/Glovo/Donesi).
- **Underserved on the web** - no website, a dead or expired-cert site, Facebook/Instagram-only presence, an image-only PDF menu, not mobile-friendly, or an ancient Flash/WordPress build. A restaurant with a solid modern site is not a lead no matter how popular - the website gap is the entire opportunity this skill hunts for.

Keep this a lightweight discovery sweep, not a dossier - no menu scraping, no photo tiering, no design DNA (that's `restaurant-site` BUILD §1, and duplicating it here would waste the real research effort restaurant-site is about to spend). Each subagent returns roughly 8-12 raw candidates: name, opština, segment/type, one-line popularity evidence, one-line website-gap evidence, rough sources.

### 3. Merge, dedupe, rank

Combine all shortlists, dedupe by name, drop anyone in the exclude set who slipped through anyway, and rank by popularity × website-gap. Bias toward opština diversity when candidates are close in quality - the fleet doesn't need a tenth Novi Beograd kafana if a Vračar or Zvezdara lead is nearly as strong; diversity is itself worth something here since it's untested ground. Skip this diversity bias on a type-scoped run if it would mean dropping a clearly-better candidate just to hit a different opština - segment quality matters more than geography once Milan has asked for something specific.

**Skor gate (pravilo, 2026-08-20):** before ranking, score every merged candidate whose `Sajt danas` is a real website (not a platform profile/linktree): `node ~/work/projekti/sajt-analiza/scripts/score-url.mjs <url>`. Skor > 70 → skip UNLESS the dizajn pogled below says `loš` (an ugly-but-technically-fine site is still a lead - the design IS the pitch). Skipped rows go in as `skipped-dobar-sajt` with `skor NN` in Napomena, never surfaced in the top 9. Skor ≤ 70 or a dead site → lead; record `skor NN` (or `sajt mrtav`) in Napomena. Candidates without any site skip the gate.

**Dizajn pogled (pravilo, 2026-08-20):** every candidate with a live real site also gets its design LOOKED at - the score measures tech/SEO, not looks. Screenshot the old site via the chrome-devtools-axi CLI (Bash; never the in-app browser tool on a tuđ domen - that's what kills unattended runs), Read the image, judge: `loš` only for objectively dated or broken looks (layout se raspada, 2000s template, sitne/mutne fotografije, neupotrebljivo na telefonu) - not taste. Record `dizajn: loš - <beleška>` or `dizajn: ok` in Napomena. For every `loš`, ALSO add the entry to `~/work/projekti/sajt-analiza/input/dizajn.json` as `"<Ime>": {"ocena": "los", "beleska": "<...>"}` - the Viber pitch quotes the beleška verbatim, so write it as half a sentence, lowercase, no trailing period, describing the site (e.g. `deluje kao da je pravljen pre petnaest godina, a na telefonu se raspored raspada`).

### 4. Update CANDIDATES.md

Append newly found leads as `candidate` rows with Tip filled in (skip anyone already in the file). Treat this as a growing pool across runs, not a one-shot list - a second scout run should turn up fresh names layered on top of whatever's still sitting unbuilt from the first, so the pool only gets deeper over time.

### 5. Present the top 9

Pull the 9 best rows - prioritize `dossier-ready` (already paid for) over plain `candidate`, then rank by popularity × website-gap - filtered to the requested type if one was given. Present ranked, in the same terse Serbian voice as PIPELINE.md:

| # | Ime | Opština | Tip | Zašto popularan | Sajt danas | Status |
|---|-----|---------|-----|------------------|------------|--------|

### 6. Kickoff gate

Ask once, naming the actual top 3: **"Želiš li da počnem da pravim demoe za prva 3 (<Ime1>, <Ime2>, <Ime3>)?"**

- **Yes:** mark those 3 rows `queued` in CANDIDATES.md, then invoke `restaurant-site` with the 3 names as a plain list (its own mode detection reads "here is a list of restaurants, build demos for these" as BATCH mode). `restaurant-site` owns everything from there - its own research, dossier, build, deploy, registry merge, and its own end-of-batch restaurant-pitch handoff question. Don't pre-research these 3 yourself and don't pre-empt restaurant-site's own pitch handoff - hand off the names and stop.
- **No / not now:** stop. Rows stay as-is in CANDIDATES.md for next time.

### 7. Done - don't self-chain

This skill does not queue up batches 2 and 3 on its own. Milan decides when to come back for the next 3, either by re-running `restaurant-scout` (which will reconcile what got built, top the pool back up to 9, and ask again) or by naming rows straight to `restaurant-site` himself. Discovery is unproven until Milan has seen the results of a first group - that's exactly why this skill has one explicit gate where `restaurant-site` itself has none.
