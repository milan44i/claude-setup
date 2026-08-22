#!/usr/bin/env python3
"""PreToolUse(Bash) hook: redirect raw `gh` CLI calls to gh-axi.

gh-axi is the agent-ergonomic wrapper around the GitHub CLI (token-efficient
TOON output, next-step hints). `gh auth` is exempt because gh-axi delegates
authentication to the underlying gh.

Exit 2 blocks the call and feeds the message back to the agent; exit 0 allows.
"""
import json
import os
import re
import sys


def get_command():
    raw = os.environ.get("CLAUDE_TOOL_INPUT", "") or sys.stdin.read()
    try:
        data = json.loads(raw)
    except Exception:
        return ""
    if isinstance(data, dict):
        if "command" in data:
            return data["command"] or ""
        return (data.get("tool_input") or {}).get("command", "") or ""
    return ""


# `gh` invoked as a binary: at line start or after a shell separator, followed
# by whitespace, and not `gh-axi` (the `(?!-)` guard). Avoids matching `github`,
# `high`, `/path/to/gh`, or `gh` passed as a plain argument.
GH_INVOCATION = re.compile(r"(?:^|[|&;(]|\bthen\b|\bdo\b)\s*gh(?![-\w])")
GH_AUTH = re.compile(r"(?:^|[|&;(])\s*gh\s+auth\b")


def main():
    cmd = get_command()
    if not cmd or not GH_INVOCATION.search(cmd):
        sys.exit(0)
    if GH_AUTH.search(cmd):
        sys.exit(0)
    print(
        "Use gh-axi instead of raw `gh`. gh-axi wraps the GitHub CLI with "
        "token-efficient output and next-step hints "
        "(e.g. `npx gh-axi pr list`, `npx gh-axi issue view N`, `npx gh-axi run list`). "
        "Exempt: `gh auth`. Re-run through gh-axi.",
        file=sys.stderr,
    )
    sys.exit(2)


if __name__ == "__main__":
    main()
