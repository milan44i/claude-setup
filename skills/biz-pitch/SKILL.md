---
name: biz-pitch
description: Draft the ready-to-go pitch for demos across the 12 biz verticals (fizioterapeuti i maseri/masaža, pet frizeri i veterinari/ambulanta, auto škole, vulkanizeri, auto servisi/mehaničari, stomatolozi i ordinacije, vinarije/salaš/etno selo, knjigovođe/knjigovodstvene agencije, stolarija/PVC/renoviranje, škole jezika, igraonice/rođendaonice, beauty saloni/kozmetički saloni/nail studiji/lash & brow) - paste-ready Viber message when the lead has a phone, IG DM otherwise; NO email (odluka 2026-08-16) - and maintain every vertical's PIPELINE.md tracker. Reads demo URL + contacts from the vertical's PIPELINE.md, builds the fixed message from its pitch-template.md (segment variants supported), and records sends and outcomes (prihvatili/odbili) across ALL verticals. Use for "pošalji/draftuj ponudu za <biznis>", "napravi pitch za vulkanizera / stomatologa / auto školu / salon", "koje ponude čekaju", "prihvatili su / odbili su". For restorane use restaurant-pitch - not biz-*.
---

# biz-pitch

Outreach + tracking for Milan's small-business-website service across the twelve generic
verticals. Sibling of `biz-site`: `biz-site` builds and deploys a demo; `biz-pitch` prepares
the owner outreach and records whether the offer was sent and how it landed.

**Sources of truth (per vertical, resolved through the registry):** each vertical's
`~/work/projekti/<dir>/PIPELINE.md` - one Markdown table, every built demo of that vertical - and
its `~/work/projekti/<dir>/pitch-template.md` (the canonical message). The vertical -> `<dir>`
mapping lives in `~/work/projekti/VERTICALS.md`; cross-vertical commands iterate over every biz
row of that registry. Restorani are standalone there - hand those to `restaurant-pitch`.

**Resolving a target:** slugs are fleet-unique (CF Pages project names are global), so a
bare `<slug|ime>` is safe to look up across ALL vertical PIPELINE.md files - match
case-insensitively on Ime or the demo-URL slug. A vertical named in the request just narrows
the search. Ambiguous or no match -> stop and ask, do not guess.

**Channel policy (Milanova odluka 2026-08-16): NO EMAIL - Viber first, IG DM fallback,
brat ide od vrata do vrata.** Never create a Gmail draft and never send email, even if the
row has an address. Output is always a **paste-ready message block** Milan sends himself:
Viber when the row has a phone number (Telefon column or Napomena), otherwise IG DM (no
automation ever touches his Viber/IG accounts). No phone AND no IG handle -> report "nema
kanala" and note it as a door-to-door kandidat for the brother. The message text is the
same pitch-template - subject line is dropped (Viber/DM have no subject). No dry-run prompt
and no confirm gate: print all given targets straight through, To (broj/handle) + body per
target.

**The board is the sending surface:** Milan actually sends from his phone off the outreach
tabla `https://poruke.sajt-analiza.pages.dev/` ("Kopiraj" dugme po lead-u). When drafting
for a demo, check it is on the board; if missing, refresh the board from
`~/work/projekti/sajt-analiza` (collect -> `build-phone.mjs` -> deploy branch `poruke`) before
reporting the pitch ready.

## Invocation

- `biz-pitch <slug|ime> [more...]` - draft the pitch for one or several named businesses;
  targets may span verticals.
- `biz-pitch --pending [vertikala]` - draft for every tracker row (across all biz verticals,
  or just the named one) that has an email or IG handle AND whose "Ponuda poslata?" is `-`.
  Because a draft leaves the row `-`, re-running `--pending` re-drafts the same rows; prefer
  naming targets explicitly when re-running.
- `biz-pitch --list [vertikala]` - print the tracker(s) as-is (no sending), grouped by
  vertical when unscoped. Optionally render a `lavish` HTML table for a nicer view.
- `biz-pitch --mark <slug> <prihvatili|odbili|bez-odgovora> [napomena]` - record an outcome
  (row found across all verticals).
- `biz-pitch --followup [slug|ime ...]` / "draftuj follow-upove" - draft reminder messages
  for due pending offers (see Follow-up flow below).

## Follow-up flow (--followup)

Detection is deterministic: with no targets named, run
`node ~/work/projekti/funnel/bin/funnel.mjs --due` (7/14/21 ladder over every vertical's
PIPELINE) and take its `fu1` + `fu2` rows; named targets are validated against that same
output. `otpis_predlog` rows are NEVER drafted - list them at the end as suggestions for
`--mark bez-odgovora` (Milan confirms each; the ladder never auto-marks).

Per target, same channel policy and draft discipline as the initial pitch, except the
message comes from the vertical's `~/work/projekti/<dir>/pitch-template.md`
**`## Varijanta: follow-up`** section (subject `Re: Novi website za <Ime>`; verbatim body,
only the two URL substitutions; htmlBody `<a>` link rule applies). If that vertical has no
follow-up variant yet, generate one modeled on `restorani/pitch-template.md`'s follow-up
variant (same structure and brevity, the vertical's pitch noun from VERTICAL.md), SAVE it
into that `pitch-template.md`, and flag it in the report: "nova follow-up varijanta -
pregledaj pre slanja". A draft (or printed DM) does NOT touch the tracker. When Milan
confirms a follow-up went out, append `follow-up poslat YYYY-MM-DD` to that row's
Napomena - that exact format is what the `--due` ladder parses (it also tolerates the
older freeform mentions).

## Draft flow

1. **Resolve** each target from its PIPELINE.md: vertical + demo base URL + recipient email
   + IG handle + segment (recorded in Napomena at deploy) + polish status.
   - No demo URL (`-`): stop and ask (nothing to link to).
   - Email present: Gmail-draft path (steps 2-4).
   - No email, IG handle present: DM path - print the message (variant-picked and
     URL-substituted, verbatim otherwise) in a copy-paste block addressed to that handle,
     and remind Milan the send is manual. Do not touch the tracker (a printed DM is not a
     sent offer).
   - Neither: report "nema kanala" for that business, leave its row unchanged.
   - `Polish?` still `-`: the demo never had a design-polish pass (build QA covers only two
     pages). Recommend a polish pass before this offer goes out, but do NOT block - draft
     anyway and flag it in the report.
2. **Build** the email per target:
   - **To:** the recipient email.
   - **From:** Milan's Gmail (`<your-gmail>`) - the connector's authenticated account.
   - **Subject:** `Novi website za <Ime>`.
   - **Body:** the fixed template from that vertical's `~/work/projekti/<dir>/pitch-template.md`
     (variant-picked per below), with BOTH template URLs replaced by this target's demo base
     URL (the second gets `/ponuda/` appended). Verbatim otherwise - no rewording, no price
     in the body, proper Serbian diacritics (č/ć/š/ž/đ) preserved.
   - **Links:** always send as `htmlBody` with the two demo URLs as explicit
     `<a href="...">...</a>` tags (paragraphs/`<br>` for line breaks) - never as a plain-text
     `body` with bare URLs. The connector's `create_draft`/send tools rewrite bare URLs in a
     plain body into a Gmail click-tracking redirect baked into the stored message. This bit
     Milan once (2026-07-06, restaurant fleet) - do not repeat it.
3. **Print** To / Subject / full body for every target before drafting (for the record, not
   as a prompt). For `--pending`, also list the businesses skipped for having no channel.
4. **Draft** each via the Gmail connector's `create_draft` (see below), in Milan's account.
   No confirmation wait; draft all given targets in one pass.
5. **Tracker:** a draft (or a printed DM) is not a sent offer, so do NOT change "Ponuda
   poslata?"/"Ishod" - leave every row as-is. Report per-target draft-created / DM-printed /
   failure, and where any draft landed so Milan can find it in Gmail. When Milan later says
   he sent a DM (or asks for send-now email), set "Ponuda poslata?" = date (YYYY-MM-DD) and
   "Ishod" = `pending` in that vertical's PIPELINE.md.

Send email directly instead of drafting only when Milan explicitly asks ("pošalji odmah" /
"send now") AND a send tool is available; then call the send tool per target and, on each
success, mark that row - "Ponuda poslata?" = today's date, "Ishod" = `pending`.

### The pitch message

**Read the canonical template from the target vertical's `~/work/projekti/<dir>/pitch-template.md`**
- the single source of truth shared with `biz-site` 8b; never restate it from memory, and
never borrow another vertical's template. The template may contain **named segment variants**
(headed e.g. `## Varijanta: ambulanta`) matching VERTICAL.md's Pitch mapping - pick by the
target's segment (from the PIPELINE row's Napomena, falling back to the dossier). A template
without variants is used whole; if variants exist and the segment can't be determined, ask -
don't guess. Within the chosen variant the text is verbatim; the only per-target substitution
is the demo URL (both occurrences: base URL, and base + `/ponuda/`). The same text is used
for email body and IG DM.

## Drafting via the Gmail connector

Drafting uses the Claude Gmail connector (`gmail.mcp.claude.com`). Its tool schemas are not in
the base tool list - discover them at runtime, then call the draft tool:

1. `ToolSearch` with query like `gmail draft` (and `gmail send email` only for the explicit
   send-now case).
2. If no Gmail tools at all are found, the connector is not connected in this session. STOP
   before drafting, tell Milan it needs authorizing (claude.ai -> Connectors), and offer to
   still print the emails for the record and update nothing. DM-path targets are unaffected -
   print those regardless.
3. **Draft (default):** call `create_draft` once per target with To / Subject / `htmlBody`
   (per the link rule above). Do NOT update the tracker. There is no draft-edit/delete tool;
   if a draft comes out wrong, recreate it correctly and tell Milan to manually delete the
   bad one.
4. **Send (only when Milan explicitly asked):** if a send tool is exposed, call it once per
   target, then update the tracker per the send note above. If only `create_draft` exists,
   draft instead and tell Milan send scope isn't authorized yet.

The connector runs only in interactive sessions and may be absent in headless/cron runs -
never assume it is available; always discover-or-stop.

## PIPELINE.md format

Same columns in every vertical: `Ime | Kraj | Demo URL | Email | Instagram | Ponuda
poslata? | Ishod | Polish? | Napomena`. Edit rows in place; append new rows at the bottom of
the table. Keep the header and the legend above it intact. When `biz-site` deploys a new demo
it appends the row (segment noted in Napomena); this skill fills in the send date, outcome,
and (if discovered) the email/IG; a design-polish pass stamps the `Polish?` date.

## --list and --mark

- `--list [vertikala]`: read the PIPELINE.md of every biz vertical in the registry (or just
  the named one) and print them grouped by vertical, flagging rows with a send date but no
  outcome. Offer a `lavish` table for a visual pass.
- `--mark <slug> <outcome> [napomena]`: locate the row across all vertical trackers, set its
  "Ishod" (and append the note to "Napomena" if given). Valid outcomes: `prihvatili`,
  `odbili`, `bez-odgovora`. Refuse to mark a row whose "Ponuda poslata?" is still `-` (can't
  have an outcome before an offer) unless Milan overrides. On `odbili`, after marking, MOVE the whole row to that vertical's `PIPELINE-ARHIVA.md` (create it with the same table header if missing) - closed rows leave the active tracker; `funnel` still counts them.
