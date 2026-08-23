#!/usr/bin/env bash
#
# install.sh — install selected parts of this Claude Code setup into ~/.claude.
#
# Design goals:
#   - Never clobber. settings.json and CLAUDE.md are backed up, then *merged*.
#   - Idempotent. Re-running installs the same thing without duplicating entries.
#   - Honest. --dry-run shows every action; nothing touches disk until you say so.
#   - Safe by default. machine.settings.json carries no permission allowlist —
#     only hook/statusline/plugin wiring (plus plansDirectory) is merged.
#   - Portable. Plain POSIX-ish bash; works on stock macOS bash 3.2.
#
# Usage:
#   ./install.sh                 # interactive checklist
#   ./install.sh --all           # install everything, no prompts
#   ./install.sh --hooks --statusline
#   ./install.sh --all --no-plugins
#   ./install.sh --all --dry-run
#
# Components: claude-md  hooks  statusline  skills  memory  axi  plugins
set -euo pipefail

# ---------------------------------------------------------------------------
# Paths & constants
# ---------------------------------------------------------------------------
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="${CLAUDE_HOME:-$HOME/.claude}"
SETTINGS="$CLAUDE_DIR/settings.json"
MACHINE_SETTINGS="$SRC/settings/machine.settings.json"
MARKER_START="# >>> claude-code-setup >>>"
MARKER_END="# <<< claude-code-setup <<<"
TS="$(date +%Y%m%d%H%M%S)"

ALL_COMPONENTS="claude-md hooks statusline skills memory axi plugins"
DEFAULT_COMPONENTS="claude-md hooks statusline skills memory plugins"  # axi is opt-in (needs the axi CLIs, and blocks raw gh)
SELECTED=""
DRY_RUN=0
NON_INTERACTIVE=0

# Claude Code memory is project-scoped: ~/.claude/projects/<slugified-cwd>/memory/.
# --memory installs into the project you run the installer from; override with
# MEMORY_PROJECT=/path/to/repo ./install.sh --memory
MEMORY_PROJECT="${MEMORY_PROJECT:-$PWD}"

# ---------------------------------------------------------------------------
# Output helpers
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
  BOLD=$'\033[1m'; DIM=$'\033[2m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; RED=$'\033[31m'; RESET=$'\033[0m'
else
  BOLD=""; DIM=""; GREEN=""; YELLOW=""; RED=""; RESET=""
fi
info() { printf '%s\n' "$*"; }
step() { printf '%s•%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$YELLOW" "$RESET" "$*" >&2; }
die()  { printf '%s✗ %s%s\n' "$RED" "$*" "$RESET" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Selection set (string-based — no associative arrays, for bash 3.2)
# ---------------------------------------------------------------------------
is_selected() { case " $SELECTED " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }
sel_add()     { is_selected "$1" || SELECTED="${SELECTED:+$SELECTED }$1"; }
sel_remove()  { SELECTED="$(printf '%s' " $SELECTED " | sed "s/ $1 / /g; s/^ *//; s/ *$//")"; }
sel_toggle()  { if is_selected "$1"; then sel_remove "$1"; else sel_add "$1"; fi; }

label_for() {
  case "$1" in
    claude-md)  echo "global CLAUDE.md     → ~/.claude/CLAUDE.md (under a marker)" ;;
    hooks)      echo "hooks + settings wiring → ts-typecheck, precompact, rename-plan, env-guard" ;;
    statusline) echo "statusline           → context / cost monitor" ;;
    skills)     echo "bundled skills       → ~/.claude/skills" ;;
    memory)     echo "example memories     → this project's memory dir (project-scoped)" ;;
    axi)        echo "axi CLI wiring       → prefer-gh-axi guard + SessionStart briefings" ;;
    plugins)    echo "plugins I use        → merged into enabledPlugins" ;;
  esac
}

usage() {
  cat <<EOF
install.sh — install parts of this Claude Code setup into \$CLAUDE_HOME (default ~/.claude)

  ./install.sh                  interactive checklist
  ./install.sh --all            install everything
  ./install.sh --hooks --statusline
  ./install.sh --all --no-plugins
  ./install.sh --memory          copy the example memories into THIS project
  ./install.sh --all --dry-run   show actions, change nothing

Components: claude-md  hooks  statusline  skills  memory  axi  plugins
  memory is project-scoped — it installs into the project you run it from.
    Override with MEMORY_PROJECT=/path/to/repo.
  axi wires the gh-axi guard (which BLOCKS raw \`gh\`) and the SessionStart
    briefings. It needs the axi CLIs from MANIFEST.md, so it is opt-in:
    included by --all, off by default in the interactive menu.
Flags:      --<component>  --no-<component>  --all  -y/--yes  --dry-run  -h/--help
EOF
  exit 0
}

# ---------------------------------------------------------------------------
# Arg parsing
# ---------------------------------------------------------------------------
parse_args() {
  for arg in "$@"; do
    case "$arg" in
      --all|-y|--yes) SELECTED="$ALL_COMPONENTS"; NON_INTERACTIVE=1 ;;
      --claude-md)    sel_add claude-md;  NON_INTERACTIVE=1 ;;
      --hooks)        sel_add hooks;      NON_INTERACTIVE=1 ;;
      --statusline)   sel_add statusline; NON_INTERACTIVE=1 ;;
      --skills)       sel_add skills;     NON_INTERACTIVE=1 ;;
      --memory)       sel_add memory;     NON_INTERACTIVE=1 ;;
      --axi)          sel_add axi;        NON_INTERACTIVE=1 ;;
      --plugins)      sel_add plugins;    NON_INTERACTIVE=1 ;;
      --no-claude-md)  sel_remove claude-md ;;
      --no-hooks)      sel_remove hooks ;;
      --no-statusline) sel_remove statusline ;;
      --no-skills)     sel_remove skills ;;
      --no-memory)     sel_remove memory ;;
      --no-axi)        sel_remove axi ;;
      --no-plugins)    sel_remove plugins ;;
      --dry-run)      DRY_RUN=1 ;;
      -h|--help)      usage ;;
      *) die "unknown option: $arg (try --help)" ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Interactive checklist
# ---------------------------------------------------------------------------
interactive_menu() {
  SELECTED="$DEFAULT_COMPONENTS"   # local components on; axi off until toggled
  while true; do
    printf '\n%sSelect what to install%s  (type a number to toggle)\n' "$BOLD" "$RESET"
    i=1
    for c in $ALL_COMPONENTS; do
      mark="[ ]"; is_selected "$c" && mark="[${GREEN}x${RESET}]"
      printf '  %s%d%s %s %s\n' "$BOLD" "$i" "$RESET" "$mark" "$(label_for "$c")"
      i=$((i+1))
    done
    printf '  %sa%s all   %sn%s none   %sEnter%s install   %sq%s quit\n' \
      "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET" "$BOLD" "$RESET"
    read -r -p "> " choice </dev/tty || choice="q"
    case "$choice" in
      "")  return 0 ;;
      q|Q) info "Aborted."; exit 0 ;;
      a|A) SELECTED="$ALL_COMPONENTS" ;;
      n|N) SELECTED="" ;;
      [1-9])
        idx=1
        for c in $ALL_COMPONENTS; do
          [ "$idx" = "$choice" ] && sel_toggle "$c"
          idx=$((idx+1))
        done ;;
      *) warn "didn't understand '$choice'" ;;
    esac
  done
}

# ---------------------------------------------------------------------------
# Backups & settings merge
# ---------------------------------------------------------------------------
backup() {
  f="$1"; [ -f "$f" ] || return 0
  # Back up the pristine file once per run — later merges must not overwrite it.
  [ "$DRY_RUN" = 1 ] || [ ! -f "$f.bak.$TS" ] || return 0
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s[dry-run]%s back up %s → %s.bak.%s\n' "$DIM" "$RESET" "$(basename "$f")" "$(basename "$f")" "$TS"
  else
    cp "$f" "$f.bak.$TS"
    step "backed up $(basename "$f") → $(basename "$f").bak.$TS"
  fi
}

ensure_settings_file() {
  [ -f "$SETTINGS" ] && return 0
  mkdir -p "$CLAUDE_DIR"
  printf '{}\n' > "$SETTINGS"
}

# Merge a jq filter into the user's settings. The source machine settings are
# exposed to the filter as $src. Backs up first; idempotent where the filter
# dedupes. Only the keys the filter names are touched — nothing else moves.
merge_settings() {
  filter="$1"
  command -v jq >/dev/null 2>&1 || die "jq is required for settings merge. Install jq and re-run."
  full="(\$srcarr[0]) as \$src | $filter"
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s[dry-run]%s merge keys into %s:\n' "$DIM" "$RESET" "$SETTINGS"
    base='{}'; [ -f "$SETTINGS" ] && base="$(cat "$SETTINGS")"
    printf '%s' "$base" | jq --slurpfile srcarr "$MACHINE_SETTINGS" "$full" | sed 's/^/    /'
    return 0
  fi
  ensure_settings_file
  backup "$SETTINGS"
  tmp="$(mktemp)"
  jq --slurpfile srcarr "$MACHINE_SETTINGS" "$full" "$SETTINGS" > "$tmp"
  mv "$tmp" "$SETTINGS"
}

# ---------------------------------------------------------------------------
# Component installers
# ---------------------------------------------------------------------------
copy_file() {
  # copy_file SRC DST [chmod]
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s[dry-run]%s cp %s → %s\n' "$DIM" "$RESET" "$1" "$2"
    return 0
  fi
  mkdir -p "$(dirname "$2")"
  cp -R "$1" "$2"
  [ "${3:-}" = "x" ] && chmod +x "$2" || true
}

install_claude_md() {
  step "installing global CLAUDE.md → ~/.claude/CLAUDE.md"
  target="$CLAUDE_DIR/CLAUDE.md"
  glob="$SRC/claude-md/global.md"
  if [ "$DRY_RUN" = 1 ]; then
    if [ -f "$target" ]; then
      printf '%s[dry-run]%s back up %s, then replace/append the managed block\n' "$DIM" "$RESET" "$target"
    else
      printf '%s[dry-run]%s create %s with the managed block\n' "$DIM" "$RESET" "$target"
    fi
    return 0
  fi
  mkdir -p "$CLAUDE_DIR"
  tmp="$(mktemp)"
  if [ -f "$target" ]; then
    backup "$target"
    # Drop any prior managed block (markers contain no regex metacharacters).
    sed "\|^${MARKER_START}\$|,\|^${MARKER_END}\$|d" "$target" > "$tmp"
  else
    : > "$tmp"
  fi
  {
    cat "$tmp"
    [ -s "$tmp" ] && printf '\n'
    printf '%s\n' "$MARKER_START"
    cat "$glob"
    printf '%s\n' "$MARKER_END"
  } > "$target"
  rm -f "$tmp"
}

install_hooks() {
  step "installing hooks + settings wiring"
  copy_file "$SRC/hooks/ts-typecheck.sh" "$CLAUDE_DIR/hooks/ts-typecheck.sh" x
  copy_file "$SRC/hooks/precompact.py"   "$CLAUDE_DIR/hooks/precompact.py"
  copy_file "$SRC/hooks/rename-plan.py"  "$CLAUDE_DIR/hooks/rename-plan.py" x
  # Merge .hooks from machine settings, deduped per event by serialized group.
  # Also set plansDirectory (rename-plan looks there) unless the user has one.
  merge_settings '
    reduce ($src.hooks | keys[]) as $ev (
      .;
      .hooks[$ev] = (((.hooks[$ev]) // []) + ($src.hooks[$ev] // []) | unique_by(tojson))
    )
    | .plansDirectory = (.plansDirectory // $src.plansDirectory)'
}

install_statusline() {
  step "installing statusline"
  copy_file "$SRC/scripts/context-monitor.py"   "$CLAUDE_DIR/scripts/context-monitor.py"
  copy_file "$SRC/scripts/statusline-command.sh" "$CLAUDE_DIR/scripts/statusline-command.sh" x
  merge_settings '.statusLine = $src.statusLine'
}

install_skills() {
  step "installing bundled skills"
  for dir in "$SRC"/skills/*/; do
    [ -f "$dir/SKILL.md" ] || continue
    name="$(basename "$dir")"
    # Replace, don't merge: `cp -R src dst` nests when dst already exists, so a
    # second run would produce skills/<name>/<name>/. Clear the target first.
    if [ "$DRY_RUN" = 0 ]; then rm -rf "$CLAUDE_DIR/skills/$name"; fi
    copy_file "${dir%/}" "$CLAUDE_DIR/skills/$name"
  done
}

install_plugins() {
  step "enabling plugins"
  # User's existing choices win over ours on conflict.
  merge_settings '
    .enabledPlugins = (($src.enabledPlugins // {}) + (.enabledPlugins // {}))
    | .extraKnownMarketplaces = (($src.extraKnownMarketplaces // {}) + (.extraKnownMarketplaces // {}))'
  warn "plugins come from the official marketplace — Claude Code installs them on next start."
}

install_memory() {
  step "installing example memories → this project's memory dir"
  # Claude Code keys memory by working directory: every "/" in the absolute
  # path becomes "-", so /Users/me/work/app → -Users-me-work-app.
  slug="$(printf '%s' "$MEMORY_PROJECT" | sed 's|/|-|g')"
  dest="$CLAUDE_DIR/projects/$slug/memory"

  if [ "$DRY_RUN" = 1 ]; then
    printf '%s[dry-run]%s memory dir for %s → %s\n' "$DIM" "$RESET" "$MEMORY_PROJECT" "$dest"
  else
    mkdir -p "$dest"
  fi

  # Never clobber a memory the user already wrote under the same name.
  for f in "$SRC"/memory/*.md; do
    base="$(basename "$f")"
    [ "$base" = "MEMORY.md" ] && continue
    if [ -f "$dest/$base" ]; then
      warn "kept existing $base (not overwritten)"
      continue
    fi
    copy_file "$f" "$dest/$base"
  done

  # MEMORY.md is the index and is usually already populated — append our entries
  # under a marker we can replace on the next run, same as CLAUDE.md.
  idx="$dest/MEMORY.md"
  if [ "$DRY_RUN" = 1 ]; then
    printf '%s[dry-run]%s add the managed block to %s\n' "$DIM" "$RESET" "$idx"
    return 0
  fi
  tmp="$(mktemp)"
  if [ -f "$idx" ]; then
    backup "$idx"
    sed "\|^${MARKER_START}\$|,\|^${MARKER_END}\$|d" "$idx" > "$tmp"
  else
    printf '# Memory\n' > "$tmp"
  fi
  {
    cat "$tmp"
    printf '\n%s\n' "$MARKER_START"
    sed -n '/^## /,$p' "$SRC/memory/MEMORY.md"
    printf '%s\n' "$MARKER_END"
  } > "$idx"
  rm -f "$tmp"
  step "memory installed → $dest"
}

install_axi() {
  step "wiring the axi CLIs (gh-axi guard + SessionStart briefings)"
  copy_file "$SRC/hooks/prefer-gh-axi.py" "$CLAUDE_DIR/hooks/prefer-gh-axi.py" x
  merge_settings '
    reduce ($src.axiHooks | keys[]) as $ev (
      .;
      .hooks[$ev] = (((.hooks[$ev]) // []) + ($src.axiHooks[$ev] // []) | unique_by(tojson))
    )'
  warn "the gh-axi guard BLOCKS raw \`gh\` calls — install the axi CLIs first (see MANIFEST.md)."
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  parse_args "$@"

  if [ "$NON_INTERACTIVE" = 0 ]; then
    if [ -t 0 ]; then
      interactive_menu
    else
      die "no components selected and not a TTY. Pass --all or specific flags (see --help)."
    fi
  fi

  [ -n "$SELECTED" ] || { info "Nothing selected."; exit 0; }

  printf '\n%sInstalling into%s %s%s%s\n' "$BOLD" "$RESET" "$BOLD" "$CLAUDE_DIR" "$RESET"
  [ "$DRY_RUN" = 1 ] && warn "dry-run: no files will be changed"
  printf '%sComponents:%s %s\n\n' "$DIM" "$RESET" "$SELECTED"

  for c in $ALL_COMPONENTS; do
    is_selected "$c" || continue
    case "$c" in
      claude-md)  install_claude_md ;;
      hooks)      install_hooks ;;
      statusline) install_statusline ;;
      skills)     install_skills ;;
      memory)     install_memory ;;
      axi)        install_axi ;;
      plugins)    install_plugins ;;
    esac
  done

  printf '\n%s✓ done.%s ' "$GREEN" "$RESET"
  if [ "$DRY_RUN" = 1 ]; then
    info "That was a dry run — re-run without --dry-run to apply."
  else
    info "Restart Claude Code to pick up settings / hooks / statusline changes."
    info "Backups (if any) sit alongside the originals as *.bak.$TS"
  fi
}

main "$@"
