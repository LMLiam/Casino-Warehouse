#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-issue-dependencies.sh [--print] [audit-scope...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse
issue-dependency-audit /goal for the open issue backlog.

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
  [ ! -f .agents/skills/casino-issue-dependency-audit/SKILL.md ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

print_only="false"
scope_parts=()

while [ "$#" -gt 0 ]; do
  if [ "${#scope_parts[@]}" -gt 0 ]; then
    scope_parts+=("$1")
    shift
    continue
  fi

  case "$1" in
    --)
      shift
      scope_parts+=("$@")
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
      scope_parts+=("$1")
      shift
      ;;
  esac
done

audit_scope=""
if [ "${#scope_parts[@]}" -gt 0 ]; then
  audit_scope="${scope_parts[*]}"
fi

goal="/goal Audit Casino Warehouse issue dependencies using \$casino-issue-dependency-audit + AGENTS.md: "

if [ -n "$audit_scope" ]; then
  goal+="focus on ${audit_scope} while still reviewing every open issue for dependency or sequencing relationships; "
else
  goal+="review every open issue for dependency or sequencing relationships; "
fi

goal+="list open issues by milestone, label, and status; inspect issue bodies, comments, linked pull requests, reverse references, and repository guidance; "
goal+="distinguish hard blockers from preferred order using milestone context and evidence; update issue labels, bodies, or canonical dependency comments only when evidence supports it; "
goal+="avoid closing, deprioritizing, or re-scoping issues unless a maintainer explicitly asks; verify any updates; "
goal+="and report a maintainer-readable dependency map listing each blocker relationship in both directions plus preferred sequencing, stale relationships, unresolved clarification needs, commands used, skipped checks, and residual risk."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
