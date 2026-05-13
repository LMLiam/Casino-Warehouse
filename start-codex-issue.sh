#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: start-codex-issue.sh [--print] [issue-number]

Launch Codex from the repository root, skip the Codex update prompt when it
appears, wait for the interactive TUI, and set a Casino Warehouse
issue-completion /goal for the given issue number.

Options:
  --print      Print the generated /goal and exit without launching Codex.
  -h, --help   Show this help.

Environment:
  CODEX_BIN    Codex executable to launch. Default: codex
  CODEX_ARGS   Extra arguments passed to Codex before the generated /goal.
EOF
}

if [ ! -f AGENTS.md ] || [ ! -f .agents/skills/casino-issue-completion/SKILL.md ]; then
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

goal="/goal Complete issue #${issue_number} in a separate worktree using \$casino-issue-completion + AGENTS.md: complete correct implementation, open/update PR, evidence review, current main, green checks, readiness report."

if [ "$print_only" = "true" ]; then
  printf "%s\n" "$goal"
  exit 0
fi

codex_bin="${CODEX_BIN:-codex}"
if ! command -v "$codex_bin" >/dev/null 2>&1; then
  echo "error: Codex executable not found: $codex_bin" >&2
  exit 1
fi

if ! command -v expect >/dev/null 2>&1; then
  echo "error: expect is required to drive the interactive Codex /goal command." >&2
  exit 1
fi

codex_args=()
if [ -n "${CODEX_ARGS:-}" ]; then
  # shellcheck disable=SC2206
  codex_args=(${CODEX_ARGS})
fi

export CASINO_ISSUE_GOAL="$goal"

expect_script="$(mktemp "${TMPDIR:-/tmp}/start-codex-issue.XXXXXX")"
cleanup() {
  rm -f "$expect_script"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

cat >"$expect_script" <<'EXPECT'
set timeout 60
set goal $env(CASINO_ISSUE_GOAL)
set ready 0
set seen_main 0

spawn {*}$argv

while {!$ready} {
  expect {
    -re {Update available!} {
      exp_continue
    }
    -re {Press enter to continue} {
      send -- "2\r"
      exp_continue
    }
    -re {·[^\r\n]*~/} {
      if {$seen_main} {
        set ready 1
      } else {
        exp_continue
      }
    }
    -re {OpenAI Codex} {
      set seen_main 1
      exp_continue
    }
    timeout {
      puts stderr "error: timed out waiting for the Codex TUI to become ready."
      exit 1
    }
    eof {
      puts stderr "error: Codex exited before the TUI became ready."
      exit 1
    }
  }
}

set timeout 2
while {1} {
  expect {
    -re {.+} {
      exp_continue
    }
    timeout {
      break
    }
    eof {
      puts stderr "error: Codex exited before the TUI became idle."
      exit 1
    }
  }
}

after 200
set send_slow {1 .002}
send -s -- "$goal"
after 100
send -- "\r"
set timeout 10
expect {
  -re {Goal active} {
  }
  timeout {
    puts stderr "error: Codex did not confirm that the generated /goal is active."
    exit 1
  }
  eof {
    puts stderr "error: Codex exited before confirming that the generated /goal is active."
    exit 1
  }
}
after 750
interact
EXPECT

expect "$expect_script" -- "$codex_bin" "${codex_args[@]}"
