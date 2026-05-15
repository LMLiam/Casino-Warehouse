#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-triage-issue.sh [--print] [issue-number]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse
issue-triage /goal for the given issue number.

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
  [ ! -f .agents/skills/casino-issue-triage/SKILL.md ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

issue_number=""
print_only="false"

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
      if [ -n "$issue_number" ]; then
        echo "error: issue number was provided more than once" >&2
        exit 2
      fi
      issue_number="$1"
      shift
      ;;
  esac
done

if [ -z "$issue_number" ]; then
  printf "Issue number: "
  read -r issue_number
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if ! [[ "$issue_number" =~ ^[0-9]+$ ]]; then
  echo "error: issue number must be numeric" >&2
  exit 2
fi

goal="/goal Triage issue #${issue_number} using \$casino-issue-triage + AGENTS.md: inspect the issue, search existing issues and pull requests for duplicates or related work, inspect repository context, update issue metadata or body only when evidence supports it, verify the updated issue, and report the before/after triage evidence."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
