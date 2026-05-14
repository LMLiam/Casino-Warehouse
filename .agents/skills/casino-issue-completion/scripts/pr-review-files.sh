#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-origin/main}"

echo "== Changed files requiring inspection =="
echo

git diff --name-only "$TARGET"...HEAD | while read -r file; do
  [ -z "$file" ] && continue

  if [ ! -f "$file" ]; then
    echo "- $file [deleted or moved]"
    continue
  fi

  case "$file" in
    .agents/skills/*)
      echo "- $file [agent skill/workflow]"
      ;;
    .agents/scripts/*|start-codex-*.sh)
      echo "- $file [agent launcher/tooling]"
      ;;
    scripts/*.mjs|scripts/**/*.mjs|scripts/*.js|scripts/**/*.js)
      echo "- $file [tooling script: check CLI behavior and subprocess/file safety]"
      ;;
    package.json|package-lock.json)
      echo "- $file [dependency/runtime script surface]"
      ;;
    .npmrc|.node-version|.nvmrc|.editorconfig|.prettierrc|.prettierrc.*|.prettierignore|tsconfig.json|tsconfig.*.json|vite.config.*|vitest.config.*|playwright.config.*|eslint.config.*|prettier.config.*|tailwind.config.*|postcss.config.*)
      echo "- $file [tooling/config]"
      ;;
    .github/workflows/*)
      echo "- $file [workflow: check action pinning and required checks]"
      ;;
    .github/ISSUE_TEMPLATE/*)
      echo "- $file [issue template/triage config]"
      ;;
    .github/PULL_REQUEST_TEMPLATE.md)
      echo "- $file [pull request template/metadata]"
      ;;
    .github/dependabot.yml)
      echo "- $file [dependabot/dependency automation]"
      ;;
    .github/*)
      echo "- $file [GitHub repository config]"
      ;;
    src/assets/*|src/assets/**/*|public/assets/*|public/assets/**/*|*.png|*.jpg|*.jpeg|*.webp|*.gif|*.svg|*.ico|*.mp3|*.wav)
      echo "- $file [asset manifest/static asset: check provenance and paths]"
      ;;
    src/styles/*.css|src/styles/**/*.css|*.css)
      echo "- $file [UI styles: check layout, responsiveness, and accessibility]"
      ;;
    *.sh)
      echo "- $file [shell script]"
      ;;
    *.ts|*.tsx|src/*.ts|src/**/*.ts|src/*.tsx|src/**/*.tsx|tests/*.ts|tests/**/*.ts|tests/*.tsx|tests/**/*.tsx|tests/*.mjs|tests/**/*.mjs|server/*.ts|server/**/*.ts|server/*.tsx|server/**/*.tsx)
      echo "- $file [code/test]"
      ;;
    *.js|*.mjs|*.cjs)
      echo "- $file [root tooling/script]"
      ;;
    docs/*|docs/**/*|README.md|CONTRIBUTING.md|GOVERNANCE.md|AGENTS.md|LICENSE|CONTRIBUTORS.md)
      echo "- $file [documentation/process]"
      ;;
    *)
      echo "- $file [inspect if relevant]"
      ;;
  esac
done

echo
echo "== Suggested review command =="
echo "git diff $TARGET...HEAD -- <file>"
echo "Classifications are a prioritization aid; inspect every changed file even when a category looks low-risk."

echo
echo "== Required review lenses =="
echo "- Purpose: what each changed file does and whether it matches the issue or PR intent"
echo "- Correctness: bugs, edge cases, breaking changes, and API compatibility"
echo "- Security: injection, auth/authz, sensitive data, secrets, input validation, CSRF/XSS, dependency risk, security headers/config"
echo "- Performance: complexity, nested loops, resource leaks, large allocations, I/O, blocking calls, caching, concurrency"
echo "- Architecture: domain boundaries, ownership, SOLID/design patterns, coupling, circular dependencies, duplication, missing abstractions"
echo "- Maintainability: readability, complexity, naming, and fit with existing project patterns"
echo "- Tests/docs: coverage gaps, deterministic fixtures, updated docs, and PR template completeness"

echo
echo "== Finding format =="
echo "- Location: file path and line number where possible"
echo "- Severity: critical / high / medium / low / info"
echo "- Category: bug / security / performance / maintainability / architecture / test / documentation"
echo "- Description: what is wrong and why it matters"
echo "- Suggestion: concrete remediation, with a code example when useful"
echo "- Blocking: yes for required changes, no for suggestions or questions"

echo
echo "== Review verdicts =="
echo "- APPROVE: no unresolved blocking findings"
echo "- REQUEST_CHANGES: one or more blocking findings must be fixed"
echo "- NEEDS_DISCUSSION: correctness or product intent is unclear enough to require maintainer input"

echo
echo "== Current-info verification =="
echo "Web-verify before claiming latest versions, deprecations, CVEs/security advisories, current best practices, or feature availability by release."
echo "If no review claim depends on current external facts, state that no web/current-info verification was needed."
