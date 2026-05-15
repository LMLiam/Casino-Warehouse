#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex.sh [--print] [routine] [routine-input...]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse /goal for a
selected maintainer routine.

Run without a routine to choose from an interactive menu.

Options:
  --print      Print the generated /goal and exit without launching Codex.
  --dry-run    Alias for --print.
  --color MODE Use colored interactive output: auto, always, or never.
  --no-color   Disable colored interactive output.
  -h, --help   Show this help.

Routines:
  issue                  Complete an existing issue.
  pr-review              Review a pull request.
  create-issue           Research and create a new issue.
  triage-issue           Triage an existing issue.
  ci-failure             Diagnose failing pull request checks.
  docs-audit             Audit documentation drift.
  issue-dependencies     Audit issue dependency relationships.
  security-pass          Run a focused security review.
  multiplayer-check      Run a multiplayer regression review.
  architecture-split     Plan and execute architecture cleanup.

Environment:
  CODEX_BIN             Codex executable to launch. Default: codex
  CODEX_ARGS            Extra arguments passed to Codex before the generated /goal.
  CASINO_CODEX_COLOR    Colored interactive output: auto, always, or never.
  NO_COLOR              Disable auto colored output when set.
EOF
}

if [ ! -f AGENTS.md ] ||
  [ ! -f .agents/scripts/codex-goal-launcher.sh ] ||
  [ ! -f .agents/scripts/codex-routines.sh ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

# shellcheck source=.agents/scripts/codex-routines.sh
source .agents/scripts/codex-routines.sh

casino_codex_validate_root

color_mode="${CASINO_CODEX_COLOR:-auto}"

color_enabled() {
  case "$color_mode" in
    always)
      return 0
      ;;
    never)
      return 1
      ;;
    auto)
      if [ -n "${NO_COLOR:-}" ]; then
        return 1
      fi
      if [ -n "${FORCE_COLOR:-}" ] && [ "${FORCE_COLOR:-}" != "0" ]; then
        return 0
      fi
      [ -t 2 ] && [ "${TERM:-}" != "dumb" ]
      ;;
    *)
      echo "error: --color must be auto, always, or never" >&2
      exit 2
      ;;
  esac
}

ansi_code() {
  if ! color_enabled; then
    return
  fi

  case "$1" in
    reset) printf "\033[0m" ;;
    bold) printf "\033[1m" ;;
    dim) printf "\033[2m" ;;
    cyan) printf "\033[36m" ;;
    green) printf "\033[32m" ;;
    magenta) printf "\033[35m" ;;
    yellow) printf "\033[33m" ;;
    bold-cyan) printf "\033[1;36m" ;;
    bold-green) printf "\033[1;32m" ;;
    bold-magenta) printf "\033[1;35m" ;;
    *) return 1 ;;
  esac
}

style_text() {
  style="$1"
  shift
  printf "%s%s%s" "$(ansi_code "$style")" "$*" "$(ansi_code reset)"
}

print_menu() {
  printf "\n%s\n" "$(style_text bold-cyan "Casino Warehouse Codex")" >&2
  printf "%s\n\n" "$(style_text dim "Choose a maintainer routine. Preview mode prints the generated /goal without launching Codex.")" >&2
  index=1
  while IFS= read -r menu_routine; do
    title="$(casino_codex_routine_title "$menu_routine")"
    description="$(casino_codex_routine_description "$menu_routine")"
    input_summary="$(casino_codex_routine_input_summary "$menu_routine")"
    number="$(style_text bold-green "$(printf "%02d" "$index")")"
    title_text="$(style_text bold-magenta "$title")"
    input_text="$(style_text dim "input: $input_summary")"
    printf "  %s  %s\n" "$number" "$title_text" >&2
    printf "      %s\n" "$description" >&2
    printf "      %s\n" "$input_text" >&2
    index=$((index + 1))
  done <<EOF
$(casino_codex_routine_ids)
EOF
  printf "\n" >&2
}

read_prompt() {
  prompt_label="$1"
  printf "%s" "$(style_text yellow "$prompt_label")" >&2

  if ! IFS= read -r prompt_value; then
    echo "error: input is required" >&2
    exit 2
  fi

  if [ ! -t 0 ]; then
    printf "\n" >&2
  fi

  printf "%s\n" "$prompt_value"
}

join_args() {
  if [ "$#" -eq 0 ]; then
    printf "\n"
    return
  fi

  printf "%s\n" "$*"
}

require_numeric() {
  value="$1"
  label="$2"
  if ! [[ "$value" =~ ^[0-9]+$ ]]; then
    echo "error: $label must be numeric" >&2
    exit 2
  fi
}

require_non_empty() {
  value="$1"
  label="$2"
  if [ -z "$value" ] || [[ ! "$value" =~ [^[:space:]] ]]; then
    echo "error: $label is required" >&2
    exit 2
  fi
}

collect_routine_input() {
  collect_routine="$1"
  collect_from_menu="$2"
  shift 2

  case "$collect_routine" in
    issue)
      if [ "$#" -gt 1 ]; then
        echo "error: issue number was provided more than once" >&2
        exit 2
      fi
      value="${1:-}"
      if [ -z "$value" ]; then
        value="$(read_prompt "Issue number: ")"
      fi
      require_numeric "$value" "issue number"
      printf "%s\n" "$value"
      ;;
    pr-review)
      if [ "$#" -gt 1 ]; then
        echo "error: pull request number was provided more than once" >&2
        exit 2
      fi
      value="${1:-}"
      if [ -z "$value" ]; then
        value="$(read_prompt "Pull request number: ")"
      fi
      require_numeric "$value" "pull request number"
      printf "%s\n" "$value"
      ;;
    create-issue)
      value="$(join_args "$@")"
      if [ -z "$value" ]; then
        value="$(read_prompt "Issue topic: ")"
      fi
      require_non_empty "$value" "issue topic"
      printf "%s\n" "$value"
      ;;
    triage-issue)
      if [ "$#" -gt 1 ]; then
        echo "error: issue number was provided more than once" >&2
        exit 2
      fi
      value="${1:-}"
      if [ -z "$value" ]; then
        value="$(read_prompt "Issue number: ")"
      fi
      require_numeric "$value" "issue number"
      printf "%s\n" "$value"
      ;;
    ci-failure)
      if [ "$#" -gt 1 ]; then
        echo "error: pull request number was provided more than once" >&2
        exit 2
      fi
      value="${1:-}"
      if [ -z "$value" ] && [ "$collect_from_menu" = "true" ]; then
        value="$(read_prompt "Pull request number (optional; press Enter for current branch PR): ")"
      fi
      if [ -n "$value" ]; then
        require_numeric "$value" "pull request number"
      fi
      printf "%s\n" "$value"
      ;;
    docs-audit)
      value="$(join_args "$@")"
      if [ -z "$value" ] && [ "$collect_from_menu" = "true" ]; then
        value="$(read_prompt "Audit scope (optional; press Enter for full docs audit): ")"
      fi
      printf "%s\n" "$value"
      ;;
    issue-dependencies)
      value="$(join_args "$@")"
      if [ -z "$value" ] && [ "$collect_from_menu" = "true" ]; then
        value="$(read_prompt "Audit focus (optional; press Enter for every open issue): ")"
      fi
      printf "%s\n" "$value"
      ;;
    security-pass)
      value="$(join_args "$@")"
      if [ -z "$value" ]; then
        value="$(read_prompt "Security review target: ")"
      fi
      require_non_empty "$value" "security review target"
      printf "%s\n" "$value"
      ;;
    multiplayer-check)
      value="$(join_args "$@")"
      if [ -z "$value" ]; then
        value="$(read_prompt "Multiplayer regression target: ")"
      fi
      require_non_empty "$value" "multiplayer regression target"
      printf "%s\n" "$value"
      ;;
    architecture-split)
      value="$(join_args "$@")"
      if [ -z "$value" ]; then
        value="$(read_prompt "Architecture cleanup target: ")"
      fi
      require_non_empty "$value" "architecture cleanup target"
      printf "%s\n" "$value"
      ;;
    *)
      echo "error: unknown routine: $collect_routine" >&2
      exit 2
      ;;
  esac
}

print_only="false"
routine=""
selected_from_menu="false"
routine_args=()

while [ "$#" -gt 0 ]; do
  case "$1" in
    --print | --dry-run)
      print_only="true"
      shift
      ;;
    --color)
      if [ "$#" -lt 2 ]; then
        echo "error: --color requires auto, always, or never" >&2
        exit 2
      fi
      color_mode="$2"
      shift 2
      ;;
    --color=*)
      color_mode="${1#--color=}"
      shift
      ;;
    --no-color)
      color_mode="never"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    --)
      shift
      routine_args+=("$@")
      break
      ;;
    -*)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
    *)
      if [ -z "$routine" ]; then
        if ! routine="$(casino_codex_normalize_routine "$1")"; then
          echo "error: unknown routine: $1" >&2
          usage >&2
          exit 2
        fi
      else
        routine_args+=("$1")
      fi
      shift
      ;;
  esac
done

color_enabled >/dev/null || true

if [ -z "$routine" ]; then
  selected_from_menu="true"
  print_menu
  selection="$(read_prompt "Select routine by number or name: ")"
  if [[ "$selection" =~ ^[0-9]+$ ]]; then
    if ! routine="$(casino_codex_routine_by_index "$selection")"; then
      echo "error: unknown routine selection: $selection" >&2
      exit 2
    fi
  elif ! routine="$(casino_codex_normalize_routine "$selection")"; then
    echo "error: unknown routine selection: $selection" >&2
    exit 2
  fi
fi

casino_codex_validate_routine_skill "$routine"
routine_input="$(
  collect_routine_input "$routine" "$selected_from_menu" "${routine_args[@]+"${routine_args[@]}"}"
)"
goal="$(casino_codex_build_goal "$routine" "$routine_input")"

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

"${BASH:-bash}" .agents/scripts/codex-goal-launcher.sh --goal "$goal"
