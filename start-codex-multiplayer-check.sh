#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-multiplayer-check.sh [--print] [target...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse multiplayer
regression review /goal for the requested pull request, branch, issue,
subsystem, directory, or file list.

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
  [ ! -f .agents/skills/casino-multiplayer-regression/SKILL.md ]; then
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

target=""
if [ "${#target_parts[@]}" -gt 0 ]; then
  target="${target_parts[*]}"
fi

if [ -z "$target" ]; then
  if [ -t 0 ]; then
    printf "Multiplayer regression target: "
  fi
  if ! read -r target; then
    echo "error: multiplayer regression target is required" >&2
    exit 2
  fi
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if [ -z "$target" ] || [[ ! "$target" =~ [^[:space:]] ]]; then
  echo "error: multiplayer regression target is required" >&2
  exit 2
fi

goal="/goal Run a Casino Warehouse multiplayer regression review for ${target} using \$casino-multiplayer-regression + AGENTS.md: "
goal+="inspect changed files and related protocol schemas, server authority, client realtime URL behavior, public tunnel scripts, persistence boundaries, and relevant tests; "
goal+="cover room lifecycle, host/join flows, seat claims, spectators, reconnect/reload behavior, heartbeat handling, WebSocket origin checks, public invite URLs, profile ownership, admin permissions, room snapshots, settlements, and persistence reconciliation; "
goal+="map changed surfaces to targeted unit, state, and Playwright checks including multiplayer flow and public tunnel smoke when relevant; "
goal+="require deterministic fixtures for game/state assertions, avoid UI recomputation of payouts or settlement logic, "
goal+="record when live public tunnel smoke cannot be run with the exact command and environment needed, "
goal+="and report target, changed files or subsystem reviewed, commands run, multiplayer risks checked, findings with location/severity/failure mode/evidence/suggested fix/blocking status, residual risk, and unresolved assumptions."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
