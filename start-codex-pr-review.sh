#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-pr-review.sh [--print] [pr-number]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse full PR
review /goal for the given pull request number.

Options:
  --print      Print the generated /goal and exit without launching Codex.
  -h, --help   Show this help.

Environment:
  CODEX_BIN    Codex executable to launch. Default: codex
  CODEX_ARGS   Extra arguments passed to Codex before the generated /goal.
EOF
}

if [ ! -f AGENTS.md ] ||
  [ ! -f .agents/scripts/codex-goal-launcher.sh ] ||
  [ ! -f .agents/skills/casino-issue-completion/SKILL.md ] ||
  [ ! -f .agents/skills/casino-pr-full-review/SKILL.md ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

pr_number=""
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
      if [ -n "$pr_number" ]; then
        echo "error: pull request number was provided more than once" >&2
        exit 2
      fi
      pr_number="$1"
      shift
      ;;
  esac
done

if [ -z "$pr_number" ]; then
  printf "Pull request number: "
  read -r pr_number
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if ! [[ "$pr_number" =~ ^[0-9]+$ ]]; then
  echo "error: pull request number must be numeric" >&2
  exit 2
fi

goal="/goal Review pull request #${pr_number} in full using \$casino-pr-full-review, "
goal+="\$casino-issue-completion, and AGENTS.md: use a separate worktree when local checkout is needed, "
goal+="inspect the full PR diff and related context, check prior comments/base freshness/CI, "
goal+="run relevant evidence checks, leave inline GitHub review comments for every finding or record exact comment failure, "
goal+="use the issue-completion evidence and status rules for any readiness claim, "
goal+="and report an evidence-backed verdict."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
