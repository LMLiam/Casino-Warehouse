#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-docs-audit.sh [--print] [audit-scope...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse
documentation audit /goal for the requested scope.

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
  [ ! -f .agents/skills/casino-docs-audit/SKILL.md ]; then
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

goal="/goal Audit Casino Warehouse documentation drift using \$casino-docs-audit + AGENTS.md: "

if [ -n "$audit_scope" ]; then
  goal+="focus on ${audit_scope}; "
else
  goal+="cover README, AGENTS.md, contributor docs, workflows, npm scripts, issue and PR templates, local agent skills, launchers, and the GitHub Wiki; "
fi

goal+="compare documented claims against source-of-truth files, commands, GitHub metadata, and wiki evidence; "
goal+="record files inspected, wiki pages inspected or skipped, commands/API calls used, drift findings with evidence and severity, skipped checks, and whether each finding is docs-only or needs implementation work."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
