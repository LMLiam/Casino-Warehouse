#!/usr/bin/env bash
set -euo pipefail

if [ ! -f AGENTS.md ] || [ ! -f start-codex.sh ]; then
  echo "error: run this script from the Casino Warehouse repository root." >&2
  exit 1
fi

exec "${BASH:-bash}" ./start-codex.sh multiplayer-check "$@"
