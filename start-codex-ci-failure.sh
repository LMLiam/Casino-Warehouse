#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-ci-failure.sh [--print] [pr-number]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse CI failure
review /goal for the given pull request number or the current branch PR.

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
  [ ! -f .agents/skills/casino-ci-failure-review/SKILL.md ]; then
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

if [ -n "$pr_number" ] && ! [[ "$pr_number" =~ ^[0-9]+$ ]]; then
  echo "error: pull request number must be numeric" >&2
  exit 2
fi

if [ -n "$pr_number" ]; then
  target="pull request #${pr_number}"
else
  target="the pull request for the current branch"
fi

goal="/goal Inspect failing Casino Warehouse checks for ${target} using \$casino-ci-failure-review + AGENTS.md: "
goal+="fetch current PR metadata, head SHA, base branch, required check status, workflow runs, failing jobs, and relevant logs; "
goal+="distinguish required checks from informational or external checks; map visual/e2e failures to local reproduction commands; "
goal+="classify failures, avoid speculative fixes, ask before making fixes unless this active goal explicitly asks to fix CI, "
goal+="and report the evidence-backed diagnosis, proposed fix path, commands or logs used, and residual risk."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
