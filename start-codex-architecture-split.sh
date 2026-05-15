#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-architecture-split.sh [--print] [target...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse architecture
cleanup /goal for the requested file, directory, subsystem, issue, or check
failure.

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
  [ ! -f .agents/skills/casino-architecture-splitter/SKILL.md ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

print_only="false"
target_parts=()

while [ "$#" -gt 0 ]; do
  if [ "${#target_parts[@]}" -gt 0 ]; then
    target_parts+=("$1")
    shift
    continue
  fi

  case "$1" in
    --)
      shift
      target_parts+=("$@")
      break
      ;;
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
      target_parts+=("$1")
      shift
      ;;
  esac
done

target="${target_parts[*]}"

if [ -z "$target" ]; then
  if [ -t 0 ]; then
    printf "Architecture cleanup target: "
  fi
  if ! read -r target; then
    echo "error: architecture cleanup target is required" >&2
    exit 2
  fi
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if [ -z "$target" ]; then
  echo "error: architecture cleanup target is required" >&2
  exit 2
fi

goal="/goal Plan and execute Casino Warehouse architecture cleanup for ${target} using \$casino-architecture-splitter + AGENTS.md: "
goal+="read docs/code-quality.md, the target files, imports, dependents, related tests, and architecture-check rules; "
goal+="produce a small staged split plan before editing when the change is large or complex; "
goal+="preserve behavior, domain ownership, one-top-level-element file shape, direct imports, no vague utility files, no barrels, and game/multiplayer/state authority boundaries; "
goal+="check circular dependency risk and run architecture checks before and after source import changes; "
goal+="run tests appropriate to the changed surface and report files inspected, commands run, behavior-change status, residual risk, and follow-up work."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
