#!/bin/bash
# Disk janitor za client repoe: briše node_modules/ i dist/ u repoima čiji je
# poslednji commit stariji od 30 dana. Sve je obnovljivo (pnpm store + pnpm build).
# Default je DRY-RUN; tek `janitor.sh --apply` stvarno briše.
# Preskače: engine repoe, repoe sa uncommitted izmenama, repoe bez .git.
set -euo pipefail

APPLY=0; [ "${1:-}" = "--apply" ] && APPLY=1
DAYS=30
NOW=$(date +%s)
ROOT="$HOME/work/projekti"
# Dir kolona iz VERTICALS.md + restorani; engine-i su izuzeti eksplicitno
VERTICALS="restorani vinarije auto-skole stomatolozi saloni vulkanizeri stolarija-renoviranje fizioterapeuti ljubimci skole-jezika igraonice knjigovodje"
SKIP_NAMES="restaurant-engine salon-engine"

total_kb=0; reclaimed=0; skipped_dirty=0
for v in $VERTICALS; do
  for repo in "$ROOT/$v"/*/; do
    [ -d "$repo" ] || continue
    name=$(basename "$repo")
    case " $SKIP_NAMES " in *" $name "*) continue;; esac
    [ -d "$repo/.git" ] || continue
    [ -d "$repo/node_modules" ] || [ -d "$repo/dist" ] || continue
    last=$(git -C "$repo" log -1 --format=%ct 2>/dev/null || echo "$NOW")
    age_days=$(( (NOW - last) / 86400 ))
    [ "$age_days" -ge "$DAYS" ] || continue
    if [ -n "$(git -C "$repo" status --porcelain)" ]; then
      echo "SKIP (dirty)   $v/$name (${age_days}d)"; skipped_dirty=$((skipped_dirty+1)); continue
    fi
    kb=0
    for d in node_modules dist; do
      [ -d "$repo/$d" ] && kb=$((kb + $(du -sk "$repo/$d" | awk '{print $1}')))
    done
    total_kb=$((total_kb + kb))
    if [ "$APPLY" = 1 ]; then
      rm -rf "$repo/node_modules" "$repo/dist"
      echo "RECLAIMED      $v/$name (${age_days}d, $((kb/1024)) MB)"
      reclaimed=$((reclaimed+1))
    else
      echo "WOULD RECLAIM  $v/$name (${age_days}d, $((kb/1024)) MB)"
    fi
  done
done
mode=$([ "$APPLY" = 1 ] && echo "obrisano" || echo "dry-run, pokreni sa --apply")
echo "---"
echo "ukupno: $((total_kb/1024)) MB ($mode); preskočeno zbog dirty stabla: $skipped_dirty"
