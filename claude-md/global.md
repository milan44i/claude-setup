# Tool Output Discipline

Keep command output small. Before running shell commands, return the smallest useful result: `tail` logs, `rg` searches, `jq` JSON, filenames before file contents, and failure summaries before full test output. Avoid dumping thousands of lines unless I explicitly ask for full output.
