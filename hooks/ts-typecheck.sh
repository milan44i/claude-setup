#!/bin/bash
# PostToolUse hook: check TypeScript errors in changed files across any project.
# Detects whether to use vue-tsc or tsc based on what's available.
# Filters errors to only files changed vs the main branch.

set -euo pipefail

# Parse the file path from hook stdin
INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // .tool_response.filePath // empty')

# Skip if no file path or not a TS/Vue file
if [ -z "$FILE_PATH" ]; then
  exit 0
fi
case "$FILE_PATH" in
  *.ts|*.tsx|*.vue) ;;
  *) exit 0 ;;
esac

# Find the git repo root
REPO_ROOT=$(git -C "$(dirname "$FILE_PATH")" rev-parse --show-toplevel 2>/dev/null || true)
if [ -z "$REPO_ROOT" ]; then
  exit 0
fi

# Find the nearest tsconfig.json at or above the edited file
find_tsconfig() {
  local dir="$1"
  while [ "$dir" != "/" ] && [ "$dir" != "$REPO_ROOT" ]; do
    if [ -f "$dir/tsconfig.json" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  # Check repo root too
  if [ -f "$REPO_ROOT/tsconfig.json" ]; then
    echo "$REPO_ROOT"
  fi
}

PROJECT_DIR=$(find_tsconfig "$(dirname "$FILE_PATH")")
if [ -z "$PROJECT_DIR" ]; then
  exit 0
fi

# Get relative path from repo root to project dir
# Pass paths via env, never interpolated into Python source (injection-safe).
REL_PROJECT=$(P="$PROJECT_DIR" R="$REPO_ROOT" python3 -c 'import os, os.path; print(os.path.relpath(os.environ["P"], os.environ["R"]))')

# Derive the project-relative path of the just-edited file for filtering
if [ "$REL_PROJECT" = "." ]; then
  EDITED_RELATIVE=$(F="$FILE_PATH" R="$REPO_ROOT" python3 -c 'import os, os.path; print(os.path.relpath(os.environ["F"], os.environ["R"]))')
else
  EDITED_RELATIVE=$(F="$FILE_PATH" P="$PROJECT_DIR" python3 -c 'import os, os.path; print(os.path.relpath(os.environ["F"], os.environ["P"]))')
fi

# Pick the right type checker. --build only fits composite/project-references
# setups; plain projects type-check with --noEmit.
cd "$PROJECT_DIR"
if [ -f "node_modules/.bin/vue-tsc" ]; then
  if grep -q '"references"' tsconfig.json 2>/dev/null; then
    TSC_CMD="npx vue-tsc --build"
  else
    TSC_CMD="npx vue-tsc --noEmit"
  fi
elif [ -f "node_modules/.bin/tsc" ]; then
  TSC_CMD="npx tsc --noEmit"
else
  # No local type checker found
  exit 0
fi

# Run type checker (heap size overridable for very large projects)
TSC_OUTPUT=$(NODE_OPTIONS="${TS_TYPECHECK_NODE_OPTIONS:---max-old-space-size=8192}" $TSC_CMD 2>&1 || true)

if [ -z "$TSC_OUTPUT" ]; then
  exit 0
fi

# Filter errors to only the file that was just edited
FILTERED=$(echo "$TSC_OUTPUT" | grep "^${EDITED_RELATIVE}" || true)

FILTERED=$(echo "$FILTERED" | sed '/^$/d')

if [ -z "$FILTERED" ]; then
  exit 0
fi

# asyncRewake: exit 2 means "wake the model with this output"
ERROR_COUNT=$(echo "$FILTERED" | wc -l | tr -d ' ')
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PostToolUse",
    "additionalContext": "TypeScript errors detected in ${ERROR_COUNT} location(s) in your changed files. Fix these before continuing:\n\n${FILTERED//$'\n'/\\n}"
  }
}
EOF
exit 2
