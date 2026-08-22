---
name: biz-kokpit
description: Prikaži funnel kokpit preko svih 13 vertikala (kandidati → napravljeno → ponuđeno → ishod), akcione liste (dossier-ready, napravljeni-neponuđeni, bez-polisha), follow-up lestvicu i zdravlje autopilota; hosted dashboard na kokpit.sajt-analiza.pages.dev. Read-only nad funnelom. Use za "kokpit", "prikaži funnel", "gde smo sa demoima", "šta da radim sledeće", "osveži dashboard".
---

# biz-kokpit

Tanak omotač oko `~/work/projekti/funnel` CLI-ja. Read-only pogled na stanje celog fleeta.

- **TOON pregled (default):** `node ~/work/projekti/funnel/bin/funnel.mjs`
- **HTML board:** `node ~/work/projekti/funnel/bin/funnel.mjs --html --open`
- **Jedna vertikala:** `node ~/work/projekti/funnel/bin/funnel.mjs --vertical <dir>`

Pokreni CLI, prenesi izlaz Milanu. Za "šta sledeće" istakni akcione liste: dossier-ready
(jeftino za build), napravljeni-ali-neponuđeni (imaju kanal), bez-polisha (rizik pre slanja).
Ne parsiraj markdown fajlove ručno - CLI je jedini put do stanja funnela.

## Hosted dashboard

Živi na https://kokpit.sajt-analiza.pages.dev/ (branch `kokpit` na sajt-analiza Pages
projektu, isti javno-po-obskurnosti režim kao poruke tabla). Posle SVAKE `--html`
regeneracije u sesiji osveži i hosted stranu:

1. **Roster:** preko scheduled-tasks MCP-a izlistaj zakazane taskove (samo `biz-*` i
   `infra-janitor-monthly` - ostali nisu deo ovog biznisa) i upiši
   `~/work/projekti/funnel/roster.json`:
   `{"generatedAt":"<ISO>","tasks":[{"name":"...","schedule":"...","enabled":true|false},...]}`.
   MCP nedostupan → preskoči, dashboard prikazuje "nepoznato".
2. `node ~/work/projekti/funnel/bin/funnel.mjs --html`
3. `~/work/projekti/funnel/deploy-kokpit.sh`

Dashboard sekcija "Autopilot" čita pause flag, lock (stale posle 12h), poslednji
AUTOPILOT.md unos (mašinski ```rezime blok) i roster.json - sve fajlovi, ništa ne izmišljaj.
