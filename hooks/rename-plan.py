import json, os, re, sys

tool_input = json.loads(os.environ.get('CLAUDE_TOOL_INPUT', '{}'))
file_path = tool_input.get('file_path', '')

if '.claude/plans/' not in file_path or not file_path.endswith('.md'):
    sys.exit(0)

if not os.path.exists(file_path):
    sys.exit(0)

with open(file_path) as f:
    content = f.read()

match = re.search(r'^#\s+(.+)', content, re.MULTILINE)
if not match:
    sys.exit(0)

title = match.group(1).strip()
slug = re.sub(r'[^a-z0-9]+', '-', title.lower()).strip('-')[:60]
new_path = os.path.join(os.path.dirname(file_path), slug + '.md')

if new_path != file_path and not os.path.exists(new_path):
    os.rename(file_path, new_path)
