#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: codex-goal-launcher.sh --goal <goal>

Launch Codex, skip the Codex update prompt when it appears, wait for the
interactive TUI, and send the generated /goal.

Environment:
  CODEX_BIN    Codex executable to launch. Default: codex
  CODEX_ARGS   Extra arguments passed to Codex before the generated /goal.
  CODEX_GOAL_KEY_DELAY_MS
               Delay between generated /goal keystrokes. Default: 15.
EOF
}

goal=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --goal)
      if [ "$#" -lt 2 ]; then
        echo "error: --goal requires a value" >&2
        exit 2
      fi
      goal="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown option: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -z "$goal" ]; then
  echo "error: --goal is required" >&2
  usage >&2
  exit 2
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

key_delay_ms="${CODEX_GOAL_KEY_DELAY_MS:-15}"
if ! [[ "$key_delay_ms" =~ ^[0-9]+$ ]]; then
  echo "error: CODEX_GOAL_KEY_DELAY_MS must be a non-negative integer." >&2
  exit 2
fi

export CASINO_CODEX_GOAL="$goal"
export CASINO_CODEX_GOAL_KEY_DELAY_MS="$key_delay_ms"

expect_script="$(mktemp "${TMPDIR:-/tmp}/casino-codex-goal.XXXXXX")"
cleanup() {
  rm -f "$expect_script"
}
trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

cat >"$expect_script" <<'EXPECT'
set timeout 60
set goal $env(CASINO_CODEX_GOAL)
set key_delay_ms $env(CASINO_CODEX_GOAL_KEY_DELAY_MS)
set ready 0
set seen_main 0

proc make_goal_tui_safe {goal} {
  regsub -all {\$(casino-[[:alnum:]_-]+)} $goal {the \1 skill} safe_goal
  return $safe_goal
}

proc goal_objective_from_command {goal_command} {
  if {[string match "/goal *" $goal_command]} {
    return [string range $goal_command [string length "/goal "] end]
  }

  return $goal_command
}

proc normalize_visible_text {text} {
  regsub -all {\033\[[0-9;?]*[ -/]*[@-~]} $text "" without_ansi
  regsub -all {[[:space:]]+} $without_ansi { } normalized
  return [string trim $normalized]
}

proc goal_confirmation_matches {confirmation expected_objective} {
  set visible_confirmation [normalize_visible_text $confirmation]
  set visible_objective [normalize_visible_text $expected_objective]
  return [expr {[string first $visible_objective $visible_confirmation] >= 0}]
}

proc send_goal_text {goal delay_ms} {
  foreach character [split $goal ""] {
    send -- $character

    if {$delay_ms > 0} {
      after $delay_ms
    }
  }
}

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
    -re {OpenAI Codex} {
      set seen_main 1
      exp_continue
    }
    -re {·[^\r\n]*(~|/)} {
      if {$seen_main} {
        set ready 1
      } else {
        exp_continue
      }
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
set goal_command [make_goal_tui_safe $goal]
set expected_objective [goal_objective_from_command $goal_command]
send_goal_text $goal_command $key_delay_ms
after 100
send -- "\r"
set timeout 10
set seen_goal_active 0
set confirmation_tail ""
while {1} {
  expect {
    -re {Goal active[^\r\n]*} {
      set seen_goal_active 1
      append confirmation_tail $expect_out(0,string)

      if {[goal_confirmation_matches $confirmation_tail $expected_objective]} {
        break
      }

      exp_continue
    }
    -re {.+} {
      if {$seen_goal_active} {
        append confirmation_tail $expect_out(0,string)

        if {[goal_confirmation_matches $confirmation_tail $expected_objective]} {
          break
        }
      }

      exp_continue
    }
    timeout {
      if {$seen_goal_active} {
        puts stderr "error: Codex confirmed a /goal but did not expose the complete generated objective. Refusing to continue because the active goal may be truncated."
      } else {
        puts stderr "error: Codex did not confirm that the generated /goal is active."
      }
      exit 1
    }
    eof {
      if {$seen_goal_active} {
        puts stderr "error: Codex exited before exposing the complete generated /goal objective."
      } else {
        puts stderr "error: Codex exited before confirming that the generated /goal is active."
      }
      exit 1
    }
  }
}
after 750
interact
EXPECT

if [ "${#codex_args[@]}" -gt 0 ]; then
  expect "$expect_script" -- "$codex_bin" "${codex_args[@]}"
else
  expect "$expect_script" -- "$codex_bin"
fi
