#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-create-issue.sh [--print] [issue-topic...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse
issue-creation /goal for the requested topic.

Options:
  --print      Print the generated /goal and exit without launching Codex.
  --dry-run    Alias for --print.
  -h, --help   Show this help.

Environment:
  CODEX_BIN    Codex executable to launch. Default: codex
  CODEX_ARGS   Extra arguments passed to Codex before the generated /goal.
EOF
}

if [ ! -f AGENTS.md ] ||
  [ ! -f .agents/scripts/codex-goal-launcher.sh ] ||
  [ ! -f .agents/skills/casino-issue-creation/SKILL.md ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

print_only="false"
topic_parts=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --print|--dry-run)
      print_only="true"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      topic_parts+=("$1")
      shift
      ;;
  esac
done

issue_topic="${topic_parts[*]}"

if [ -z "$issue_topic" ]; then
  if [ -t 0 ]; then
    printf "Issue topic: "
  fi
  if ! read -r issue_topic; then
    echo "error: issue topic is required" >&2
    exit 2
  fi
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if [ -z "$issue_topic" ]; then
  echo "error: issue topic is required" >&2
  exit 2
fi

goal="/goal Create a researched GitHub issue for Casino Warehouse using \$casino-issue-creation + AGENTS.md: ${issue_topic}. Inspect relevant repository context, search existing issues and pull requests for duplicates, choose compliant title/labels/status/milestone, create the issue through GitHub, verify the created issue, and report the evidence summary."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
