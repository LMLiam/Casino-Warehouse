#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-origin/main}"

echo "== Casino Warehouse PR readiness =="
echo

echo "Current branch:"
git branch --show-current
echo

echo "Current HEAD:"
git rev-parse HEAD
echo

echo "Target branch:"
echo "$TARGET"
echo

echo "Target commit:"
git rev-parse "$TARGET"
echo

echo "Merge base:"
git merge-base HEAD "$TARGET"
echo

echo "Is target an ancestor of HEAD?"
if git merge-base --is-ancestor "$TARGET" HEAD; then
  echo "yes"
else
  echo "no"
fi
echo

echo "Working tree status:"
git status --short
echo

echo "Changed files:"
git diff --name-only "$TARGET"...HEAD
echo

echo "Diff stat:"
git diff --stat "$TARGET"...HEAD
echo

echo "Diff check:"
git diff --check "$TARGET"...HEAD
echo

echo "Generated/build output candidates:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '(^dist/|^build/|^coverage/|^playwright-report/|^test-results/|\.tsbuildinfo$)' \
  || true
echo

echo "Workflow files changed:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '^\.github/workflows/' \
  || true
echo

echo "Package or lockfile changes:"
git diff --name-only "$TARGET"...HEAD \
  | grep -E '(^package\.json$|^package-lock\.json$)' \
  || true
echo

echo "Review evidence required before ready:"
echo "- changed files inspected with purpose, correctness, security, performance, architecture, maintainability, tests, and docs lenses"
echo "- findings recorded with location, severity, category, description, suggestion, and blocking status"
echo "- review verdict recorded as APPROVE, REQUEST_CHANGES, or NEEDS_DISCUSSION"
echo "- current external claims web-verified, or explicitly marked not needed"
echo "- PR review comments left for every finding when permissions allow, or fallback findings reported with a reason"
