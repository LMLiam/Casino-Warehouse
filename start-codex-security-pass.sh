#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-security-pass.sh [--print] [target...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse focused
security review /goal for the requested pull request, branch, issue,
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
  [ ! -f .agents/skills/casino-security-review/SKILL.md ]; then
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
    printf "Security review target: "
  fi
  if ! read -r target; then
    echo "error: security review target is required" >&2
    exit 2
  fi
  if [ ! -t 0 ]; then
    printf "\n"
  fi
fi

if [ -z "$target" ]; then
  echo "error: security review target is required" >&2
  exit 2
fi

goal="/goal Run a focused Casino Warehouse security review for ${target} using \$casino-security-review + AGENTS.md: "
goal+="inspect the target and related security controls, review related tests and existing safeguards before recommending changes, "
goal+="cover admin token, profile token, server authority, public tunnel, WebSocket origin, persistence, dependency, workflow pinning, CodeQL, and Dependency Review risks where relevant, "
goal+="verify any current vulnerability, advisory, CVE, deprecation, version, or best-practice claim with current sources, "
goal+="avoid weakening existing controls, and report findings with locations, severity, exploit or failure mode, evidence, suggested fixes, blocking status, residual risk, commands run, sources, and unresolved assumptions."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
