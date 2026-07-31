#!/usr/bin/env bash
# Generates real Claude Haiku 4.5 responses for each demo prompt via the Claude CLI.
# The default system prompt is replaced so the model answers as a plain assistant
# rather than as a coding agent.
set -uo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
OUT="$DIR/responses"
mkdir -p "$OUT"

SYSTEM="You are a helpful assistant. Answer the user directly and completely. Use British English."

count=$(node -e "console.log(require('$DIR/prompts.json').length)")

for i in $(seq 0 $((count - 1))); do
  id=$(node -e "console.log(require('$DIR/prompts.json')[$i].id)")
  if [ -s "$OUT/$id.json" ]; then
    echo "skip  $id (already generated)"
    continue
  fi
  echo "run   $id ..."
  node -e "process.stdout.write(require('$DIR/prompts.json')[$i].prompt)" > "$OUT/$id.prompt.txt"
  claude -p "$(cat "$OUT/$id.prompt.txt")" \
    --model claude-haiku-4-5 \
    --system-prompt "$SYSTEM" \
    --setting-sources "" \
    --strict-mcp-config \
    --disallowedTools Bash Read Write Edit Glob Grep WebSearch WebFetch Task TodoWrite NotebookEdit \
    --output-format json > "$OUT/$id.json" 2>"$OUT/$id.err"
  if [ $? -ne 0 ] || [ ! -s "$OUT/$id.json" ]; then
    echo "FAIL  $id — see $OUT/$id.err"
  else
    echo "ok    $id"
  fi
done

echo "done"
