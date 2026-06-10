#!/usr/bin/env python3
"""
PreCompact hook: saves meaningful context before compaction.

Mechanical extraction (fast):
  - Branch + ticket id
  - Modified files (git status)
  - Test commands run + pass/fail result
  - Active todos

AI analysis via `claude -p` (smart):
  - Problem / task description
  - What was tried and didn't work
  - Key findings about the codebase
  - Key error messages / stack traces
  - Next steps to try

Output: {"additionalContext": "..."} injected into the compaction prompt.
"""

import json
import os
import re
import subprocess
import sys


# ---------------------------------------------------------------------------
# Git info
# ---------------------------------------------------------------------------

def get_git_info(cwd):
    parts = []
    try:
        branch = subprocess.check_output(
            ['git', '-C', cwd, 'branch', '--show-current'],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        ticket_m = re.search(r'[a-z]+-\d+', branch, re.IGNORECASE)
        ticket = ticket_m.group().upper() if ticket_m else 'none'
        parts.append(f"Branch: {branch}\nTicket: {ticket}")
    except Exception:
        parts.append("Branch: unknown")

    try:
        status = subprocess.check_output(
            ['git', '-C', cwd, 'status', '--short'],
            stderr=subprocess.DEVNULL
        ).decode().strip()
        parts.append(f"Modified Files:\n{status or '(none)'}")
    except Exception:
        parts.append("Modified Files: (could not retrieve)")

    return parts


# ---------------------------------------------------------------------------
# Transcript parsing
# ---------------------------------------------------------------------------

def parse_transcript(transcript_path):
    messages = []
    if not transcript_path or not os.path.exists(transcript_path):
        return messages
    try:
        with open(transcript_path) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        messages.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
    except Exception:
        pass
    return messages


def _extract_text(content):
    """Pull plain text out of a content field (str or list of blocks)."""
    if isinstance(content, str):
        return content.strip()
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get('type') == 'text':
                    parts.append(block.get('text', ''))
                elif block.get('type') == 'tool_result':
                    parts.append(_extract_text(block.get('content', '')))
        return ' '.join(parts).strip()
    return ''


# ---------------------------------------------------------------------------
# Mechanical extraction: test runs + todos
# ---------------------------------------------------------------------------

TEST_RE = re.compile(
    r'\b(jest|vitest|playwright test|pytest|tox|rspec|phpunit|go test|'
    r'cargo (test|nextest)|mvn (test|verify)|gradlew? test|dotnet test|'
    r'mix test|ctest|make test|(pnpm|npm|yarn|bun)( run)? test)\b',
    re.IGNORECASE,
)
PASS_FAIL_RE = re.compile(
    r'(Tests?|Suites?|PASS|FAIL|passed|failed|✓|✗|×|●)', re.IGNORECASE
)


def _summarise_test_output(text):
    """Extract a short pass/fail summary from test runner output."""
    lines = text.split('\n')
    summary = []
    for line in lines:
        stripped = line.strip()
        if stripped and PASS_FAIL_RE.search(stripped):
            summary.append(stripped)
        if len(summary) >= 4:
            break
    if summary:
        return ' | '.join(summary[:3])
    # Fallback: last few non-empty lines
    non_empty = [l.strip() for l in lines if l.strip()]
    return ' | '.join(non_empty[-2:]) if non_empty else '(no output)'


def extract_mechanical(messages):
    """
    Walk the flat transcript JSONL and pull out:
      - Bash test commands paired with their results
      - The last TodoWrite state
    """
    # Map tool_use id -> command for pending Bash test calls
    pending_bash: dict[str, str] = {}
    test_runs: list[tuple[str, str]] = []  # (command, result_summary)
    current_todos: list[dict] = []

    for msg in messages:
        msg_type = msg.get('type', '')

        # Top-level tool_use events (flat transcript format)
        if msg_type == 'tool_use':
            name = msg.get('name', '')
            inp = msg.get('input', {})
            tool_id = msg.get('id', '')
            if name == 'Bash':
                cmd = inp.get('command', '').strip()
                if TEST_RE.search(cmd):
                    pending_bash[tool_id] = cmd
            elif name == 'TodoWrite':
                current_todos = inp.get('todos', [])

        # Top-level tool_result events
        elif msg_type == 'tool_result':
            tool_use_id = msg.get('tool_use_id', '')
            if tool_use_id in pending_bash:
                cmd = pending_bash.pop(tool_use_id)
                result_text = _extract_text(msg.get('content', ''))
                test_runs.append((cmd, _summarise_test_output(result_text)))

        # Nested content blocks inside user/assistant turns
        # Claude Code JSONL nests content inside 'message', not at top level
        content = msg.get('content') or msg.get('message', {}).get('content', [])
        if isinstance(content, list):
            for block in content:
                if not isinstance(block, dict):
                    continue
                b_type = block.get('type', '')
                if b_type == 'tool_use':
                    name = block.get('name', '')
                    inp = block.get('input', {})
                    tool_id = block.get('id', '')
                    if name == 'Bash':
                        cmd = inp.get('command', '').strip()
                        if TEST_RE.search(cmd):
                            pending_bash[tool_id] = cmd
                    elif name == 'TodoWrite':
                        current_todos = inp.get('todos', [])
                elif b_type == 'tool_result':
                    tool_use_id = block.get('tool_use_id', '')
                    if tool_use_id in pending_bash:
                        cmd = pending_bash.pop(tool_use_id)
                        result_text = _extract_text(block.get('content', ''))
                        test_runs.append((cmd, _summarise_test_output(result_text)))

    # Deduplicate preserving order, keep last 8
    seen: set[str] = set()
    unique_runs: list[tuple[str, str]] = []
    for cmd, result in test_runs:
        if cmd not in seen:
            seen.add(cmd)
            unique_runs.append((cmd, result))
    return unique_runs[-8:], current_todos


# ---------------------------------------------------------------------------
# Conversation text for AI analysis
# ---------------------------------------------------------------------------

def build_conversation_text(messages):
    """
    Produce a compact human-readable transcript for AI analysis.
    Takes the first 25 messages (problem statement) + last 40 (current state).
    """
    def render(msg):
        msg_type = msg.get('type', '')
        role = msg.get('role', msg_type)
        # Claude Code JSONL nests content inside 'message', not at top level
        content = msg.get('content') or msg.get('message', {}).get('content', '')

        if msg_type in ('human', 'user') or role in ('human', 'user'):
            text = _extract_text(content)
            if text:
                return f"USER: {text[:600]}"

        elif msg_type == 'assistant' or role == 'assistant':
            text = _extract_text(content)
            if text:
                return f"ASSISTANT: {text[:600]}"

        elif msg_type == 'tool_use':
            name = msg.get('name', '')
            inp = msg.get('input', {})
            if name == 'Bash':
                return f"[Bash]: {inp.get('command', '')[:300]}"
            elif name in ('Edit', 'Write'):
                return f"[{name}]: {inp.get('file_path', '')}"

        elif msg_type == 'tool_result':
            text = _extract_text(msg.get('content', ''))
            if text and len(text) > 10:
                return f"[Result]: {text[:400]}"

        return None

    head = messages[:25]
    tail = messages[-40:] if len(messages) > 25 else []
    combined = head + (tail if tail else [])

    parts = [s for msg in combined for s in [render(msg)] if s]
    return '\n'.join(parts)


# ---------------------------------------------------------------------------
# AI analysis via claude -p
# ---------------------------------------------------------------------------

AI_PROMPT = """\
You are analysing a conversation between a developer and Claude Code.
Extract the most important context that must survive conversation compaction.
Be specific and concrete — no vague summaries.
Working directory: {cwd}

--- CONVERSATION ---
{conversation}
--- END ---

Produce exactly these sections (omit none, write "(none)" if nothing applies):

## Problem / Task Description
What the developer is trying to accomplish. One clear paragraph.

## What Was Tried & Didn't Work
Specific approaches attempted, errors hit, dead ends, things to avoid retrying.
Include key error messages or stack trace snippets if present.

## Key Findings
Important discoveries about the codebase — file paths, root causes, architecture insights.

## Next Steps
Concrete remaining tasks or hypotheses to test. Numbered list.
"""


def ai_analyse(conversation_text, cwd):
    prompt = AI_PROMPT.format(cwd=cwd, conversation=conversation_text[:7000])
    try:
        result = subprocess.run(
            ['claude', '--print', '--output-format', 'text'],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=120,
            cwd=cwd,
        )
        stdout = result.stdout.strip()
        stderr = result.stderr.strip()
        if result.returncode != 0:
            return f"(failed — exit {result.returncode}: {stderr[:300] or stdout[:300]})"
        if not stdout:
            return f"(no output — stderr: {stderr[:300]})"
        return stdout
    except subprocess.TimeoutExpired:
        return "(timed out after 120s)"
    except FileNotFoundError:
        return "(claude not found in PATH)"
    except Exception as e:
        return f"(exception: {e})"


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    hook_input = json.load(sys.stdin)
    transcript_path = hook_input.get('transcript_path', '')
    cwd = hook_input.get('cwd', os.getcwd())

    parts = []

    # 1. Git info
    parts.extend(get_git_info(cwd))

    # 2. Parse transcript
    messages = parse_transcript(transcript_path)

    # 3. Mechanical extraction
    test_runs, current_todos = extract_mechanical(messages)

    if test_runs:
        lines = [f"  - {cmd}\n    Result: {result}" for cmd, result in test_runs]
        parts.append("Test Commands & Results:\n" + '\n'.join(lines))
    else:
        parts.append("Test Commands: (none detected)")

    if current_todos:
        icons = {'completed': '✓', 'in_progress': '→', 'pending': '○'}
        todo_lines = [
            f"  {icons.get(t.get('status', ''), '?')} [{t.get('status', '')}] {t.get('content', '')}"
            for t in current_todos
        ]
        parts.append("Active Todos:\n" + '\n'.join(todo_lines))
    else:
        parts.append("Active Todos: (none)")

    # 4. AI analysis (qualitative — problem, failures, findings, next steps)
    if messages:
        conversation_text = build_conversation_text(messages)
        ai_summary = ai_analyse(conversation_text, cwd)
        parts.append("AI Analysis:\n" + (ai_summary or "(unavailable)"))

    from datetime import datetime
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M')
    trigger = hook_input.get('trigger', 'auto')

    context = "=== PRE-COMPACTION STATE ===\n\n" + "\n\n".join(parts)

    # Write summary.md into the project's .claude/compact/ folder
    claude_dir = os.path.join(cwd, '.claude')
    if os.path.isdir(claude_dir):
        compact_dir = os.path.join(claude_dir, 'compact')
        os.makedirs(compact_dir, exist_ok=True)
        summary_path = os.path.join(compact_dir, 'summary.md')
        md_parts = [f"# Session Summary\n\n_Saved: {timestamp} | trigger: {trigger}_\n"]
        md_parts.append("\n\n".join(parts))
        try:
            with open(summary_path, 'w') as f:
                f.write('\n'.join(md_parts) + '\n')
        except Exception as e:
            print(f"Warning: could not write summary.md: {e}", file=sys.stderr)

    print(json.dumps({"additionalContext": context}))


if __name__ == '__main__':
    main()
