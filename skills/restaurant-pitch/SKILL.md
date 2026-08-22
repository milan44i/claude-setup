---
name: restaurant-pitch
description: Produce the ready-to-send pitch for one or more restaurants as paste-ready Viber/IG DM messages (NO email - odluka 2026-08-16), and maintain the central project tracker. Reads a restaurant's demo URL + contacts from PIPELINE.md and builds the fixed 8b outreach message per restaurant for Milan to send himself. Also lists the pipeline and records offer outcomes (prihvatili/odbili).
---

# restaurant-pitch

Outreach + tracking for Milan's restaurant-website service. Sibling of `restaurant-site`:
`restaurant-site` builds and deploys a demo; `restaurant-pitch` emails the owner and records
whether the offer was sent and how it landed.

**Source of truth:** `~/work/projekti/restorani/PIPELINE.md` - one Markdown table, every built demo. This
skill reads it to resolve each restaurant and writes it back to record sends and outcomes.
The message template lives in `~/work/projekti/restorani/pitch-template.md`.

**Channel policy (Milanova odluka 2026-08-16, supersedes 2026-07-07 Gmail-draft flow): NO
EMAIL - Viber first, IG DM fallback, brat ide od vrata do vrata.** Never create a Gmail
draft and never send email. Output is always a **paste-ready message block** Milan sends
himself: Viber when the row has a phone number, otherwise IG DM (no automation ever touches
his Viber/IG accounts). No phone AND no IG handle -> report "nema kanala" and note it as a
door-to-door kandidat for the brother. Subject line is dropped (Viber/DM have no subject).
No dry-run prompt and no confirm gate: print all given targets straight through, To
(broj/handle) + body per target.

**The board is the sending surface:** Milan actually sends from his phone off the outreach
tabla `https://poruke.sajt-analiza.pages.dev/` ("Kopiraj" dugme po lead-u). When drafting
for a demo, check it is on the board; if missing, refresh the board from
`~/work/projekti/sajt-analiza` before reporting the pitch ready.

## Invocation

- `restaurant-pitch <slug|ime> [more...]` - draft the pitch for one or several named restaurants.
- `restaurant-pitch --pending` - draft the pitch for every tracker row that has an email AND
  whose "Ponuda poslata?" is `-`. Because a draft leaves the row `-`, re-running `--pending`
  re-drafts the same rows; prefer naming restaurants explicitly when re-running.
- `restaurant-pitch --list` - print the tracker as-is (no sending). Optionally render a
  `lavish` HTML table for a nicer view.
- `restaurant-pitch --mark <slug> <prihvatili|odbili|bez-odgovora> [napomena]` - record an outcome.
- `restaurant-pitch --followup [slug|ime ...]` / "draftuj follow-upove" - draft reminders for
  due pending offers. Detection: `node ~/work/projekti/funnel/bin/funnel.mjs --due` (7/14/21
  ladder); draft only `fu1`/`fu2` rows (restorani ones), from this vertical's
  `pitch-template.md` `## Varijanta: follow-up` (subject `Re: Novi website za <Ime>`,
  verbatim body, only the two URL substitutions, htmlBody `<a>` rule). `otpis_predlog` rows
  are never drafted - list them as `--mark bez-odgovora` suggestions for Milan to confirm.
  A draft does NOT touch the tracker; when Milan confirms a send, append
  `follow-up poslat YYYY-MM-DD` to that row's Napomena (the exact format the ladder parses).

Match `<slug|ime>` against PIPELINE.md rows case-insensitively on Ime or the demo-URL slug
(e.g. `kesten` -> `restoran-kesten`). Ambiguous or no match -> stop and ask, do not guess.

## Draft flow

1. **Resolve** each target from PIPELINE.md: demo base URL + recipient email + polish status.
   - No email on record (`-`): do NOT draft. Report "nema mejla" for that restaurant and leave
     its row unchanged. Email-only - no Facebook/contact-form fallback.
   - No/`-` demo URL: stop and ask (nothing to link to).
   - `Polish?` still `-`: the demo never had a `polish-design` pass (build QA covers only two
     pages). Recommend running `polish-design <slug>` before this offer goes out, but do NOT
     block - draft anyway and flag it in the report.
2. **Build** the email per target:
   - **To:** the recipient email.
   - **From:** Milan's Gmail (mln6stankovic@gmail.com) - the connector's authenticated account.
   - **Subject:** `Novi website za <Ime restorana>`.
   - **Body:** the fixed template from `~/work/projekti/restorani/pitch-template.md`, with BOTH
     `restoran-kesten.pages.dev` URLs replaced by this target's demo base URL (the second gets
     `/ponuda/` appended). Verbatim otherwise - no rewording, no price in the body, proper
     Serbian diacritics (č/ć/š/ž/đ) preserved.
   - **Links:** always send as `htmlBody` with the two demo URLs as explicit
     `<a href="...">...</a>` tags (paragraphs/`<br>` for line breaks) - never as a plain-text
     `body` with bare URLs. The connector's `create_draft`/send tools rewrite bare URLs in a
     plain body into a Gmail click-tracking redirect (`google.com/url?q=...&ust=...`) baked
     into the stored message. This bit Milan once (2026-07-06, Sent Andrea demo) - do not
     repeat it.
3. **Print** To / Subject / full body for every target before drafting (for the record, not as
   a prompt). For `--pending`, also list the restaurants skipped for missing email.
4. **Draft** each via the Gmail connector's `create_draft` (see below), in Milan's account. No
   confirmation wait; draft all given targets in one pass.
5. **Tracker:** a draft is not a sent offer, so do NOT change "Ponuda poslata?"/"Ishod" - leave
   every row as-is. Report per-restaurant draft-created / failure, and where the draft landed so
   Milan can find it in Gmail.

Send directly instead of drafting only when Milan explicitly asks ("pošalji odmah" / "send now")
AND a send tool is available (see connector notes); then call the send tool per target and, on
each success, mark that row - "Ponuda poslata?" = today's date (YYYY-MM-DD), "Ishod" = `pending`.

### The pitch message

**Read the canonical template from `~/work/projekti/restorani/pitch-template.md`** - the single
source of truth shared with `restaurant-site` 8b; never restate it from memory. Send it
verbatim; the only per-target substitution is the demo URL (both occurrences: base URL, and
base + `/ponuda/`).

## Drafting via the Gmail connector

Drafting uses the Claude Gmail connector (`gmail.mcp.claude.com`). Its tool schemas are not in
the base tool list - discover them at runtime, then call the draft tool:

1. `ToolSearch` with query like `gmail draft` (and `gmail send email` only for the explicit
   send-now case).
2. If no Gmail tools at all are found, the connector is not connected in this session. STOP
   before drafting, tell Milan it needs authorizing (claude.ai -> Connectors; the host
   `gmail.mcp.claude.com` must also be out of `blocked_hosts` in `~/.claude.json`), and offer
   to still print the emails for the record and update nothing.
3. **Draft (default):** call `create_draft` once per target with To / Subject / `htmlBody` (per
   the link rule above), in Milan's account. Do NOT update the tracker - a draft is not a sent
   offer. There is no draft-edit/delete tool; if a draft comes out wrong, recreate it correctly
   and tell Milan to manually delete the bad one in Gmail.
4. **Send (only when Milan explicitly asked to send now):** if a send tool is exposed, call it
   once per target with To / Subject / htmlBody above, then update the tracker per the send note
   in Draft flow. If only `create_draft` exists (the state as of 2026-07-06), draft instead and
   tell Milan send scope isn't authorized yet in claude.ai -> Connectors.

The connector runs only in interactive sessions and may be absent in headless/cron runs - never
assume it is available; always discover-or-stop.

## PIPELINE.md format

Columns: `Ime | Kraj | Demo URL | Email | Ponuda poslata? | Ishod | Polish? | Napomena`. Edit
rows in place; append new rows at the bottom of the table. Keep the header and the legend
above it intact. When `restaurant-site` deploys a new demo it appends the row; this skill
fills in the send date, outcome, and (if discovered) the email; `polish-design` stamps the
`Polish?` date.

## --list and --mark

- `--list`: read PIPELINE.md and print it. Offer a `lavish` table for a visual pass.
- `--mark <slug> <outcome> [napomena]`: set that row's "Ishod" (and append the note to
  "Napomena" if given). Valid outcomes: `prihvatili`, `odbili`, `bez-odgovora`. Refuse to mark
  a row whose "Ponuda poslata?" is still `-` (can't have an outcome before an offer) unless
  Milan overrides. On `odbili`, after marking, MOVE the whole row to
  `~/work/projekti/restorani/PIPELINE-ARHIVA.md` (same table header) - closed rows leave the
  active tracker; `funnel` still counts them.
