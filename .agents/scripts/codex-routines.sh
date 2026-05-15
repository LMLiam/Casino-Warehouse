#!/usr/bin/env bash

# Shared registry for Casino Warehouse Codex launch routines.

casino_codex_routine_ids() {
  printf "%s\n" \
    issue \
    pr-review \
    create-issue \
    triage-issue \
    ci-failure \
    docs-audit \
    issue-dependencies \
    security-pass \
    multiplayer-check \
    architecture-split
}

casino_codex_routine_by_index() {
  case "$1" in
    1) printf "%s\n" "issue" ;;
    2) printf "%s\n" "pr-review" ;;
    3) printf "%s\n" "create-issue" ;;
    4) printf "%s\n" "triage-issue" ;;
    5) printf "%s\n" "ci-failure" ;;
    6) printf "%s\n" "docs-audit" ;;
    7) printf "%s\n" "issue-dependencies" ;;
    8) printf "%s\n" "security-pass" ;;
    9) printf "%s\n" "multiplayer-check" ;;
    10) printf "%s\n" "architecture-split" ;;
    *) return 1 ;;
  esac
}

casino_codex_normalize_routine() {
  case "$1" in
    issue | issue-completion | complete-issue | completion | start-codex-issue.sh)
      printf "%s\n" "issue"
      ;;
    pr-review | pull-request-review | review-pr | review | start-codex-pr-review.sh)
      printf "%s\n" "pr-review"
      ;;
    create-issue | issue-creation | new-issue | start-codex-create-issue.sh)
      printf "%s\n" "create-issue"
      ;;
    triage-issue | issue-triage | triage | start-codex-triage-issue.sh)
      printf "%s\n" "triage-issue"
      ;;
    ci-failure | ci | checks | start-codex-ci-failure.sh)
      printf "%s\n" "ci-failure"
      ;;
    docs-audit | documentation-audit | docs | start-codex-docs-audit.sh)
      printf "%s\n" "docs-audit"
      ;;
    issue-dependencies | dependency-audit | issue-dependency-audit | dependencies | start-codex-issue-dependencies.sh)
      printf "%s\n" "issue-dependencies"
      ;;
    security-pass | security-review | security | start-codex-security-pass.sh)
      printf "%s\n" "security-pass"
      ;;
    multiplayer-check | multiplayer-regression | multiplayer | start-codex-multiplayer-check.sh)
      printf "%s\n" "multiplayer-check"
      ;;
    architecture-split | architecture-cleanup | architecture | start-codex-architecture-split.sh)
      printf "%s\n" "architecture-split"
      ;;
    *)
      return 1
      ;;
  esac
}

casino_codex_routine_title() {
  case "$1" in
    issue) printf "%s\n" "Issue completion" ;;
    pr-review) printf "%s\n" "Pull request review" ;;
    create-issue) printf "%s\n" "Issue creation" ;;
    triage-issue) printf "%s\n" "Issue triage" ;;
    ci-failure) printf "%s\n" "CI failure review" ;;
    docs-audit) printf "%s\n" "Documentation audit" ;;
    issue-dependencies) printf "%s\n" "Issue dependency audit" ;;
    security-pass) printf "%s\n" "Security review" ;;
    multiplayer-check) printf "%s\n" "Multiplayer regression" ;;
    architecture-split) printf "%s\n" "Architecture cleanup" ;;
    *) return 1 ;;
  esac
}

casino_codex_routine_description() {
  case "$1" in
    issue) printf "%s\n" "Complete an existing issue with PR readiness evidence." ;;
    pr-review) printf "%s\n" "Review a pull request with maintainer-style evidence." ;;
    create-issue) printf "%s\n" "Research and open a new GitHub issue." ;;
    triage-issue) printf "%s\n" "Triage and update an existing issue." ;;
    ci-failure) printf "%s\n" "Diagnose failing pull request checks." ;;
    docs-audit) printf "%s\n" "Audit documentation drift against repository evidence." ;;
    issue-dependencies) printf "%s\n" "Map dependency and sequencing relationships across open issues." ;;
    security-pass) printf "%s\n" "Run a focused security review of a target." ;;
    multiplayer-check) printf "%s\n" "Review multiplayer regression risk for a target." ;;
    architecture-split) printf "%s\n" "Plan and execute focused architecture cleanup." ;;
    *) return 1 ;;
  esac
}

casino_codex_routine_input_summary() {
  case "$1" in
    issue) printf "%s\n" "issue number" ;;
    pr-review) printf "%s\n" "pull request number" ;;
    create-issue) printf "%s\n" "issue topic" ;;
    triage-issue) printf "%s\n" "issue number" ;;
    ci-failure) printf "%s\n" "pull request number, optional" ;;
    docs-audit) printf "%s\n" "audit scope, optional" ;;
    issue-dependencies) printf "%s\n" "audit focus, optional" ;;
    security-pass) printf "%s\n" "review target" ;;
    multiplayer-check) printf "%s\n" "review target" ;;
    architecture-split) printf "%s\n" "cleanup target" ;;
    *) return 1 ;;
  esac
}

casino_codex_routine_skill_path() {
  case "$1" in
    issue) printf "%s\n" ".agents/skills/casino-issue-completion/SKILL.md" ;;
    pr-review) printf "%s\n" ".agents/skills/casino-pr-full-review/SKILL.md" ;;
    create-issue) printf "%s\n" ".agents/skills/casino-issue-creation/SKILL.md" ;;
    triage-issue) printf "%s\n" ".agents/skills/casino-issue-triage/SKILL.md" ;;
    ci-failure) printf "%s\n" ".agents/skills/casino-ci-failure-review/SKILL.md" ;;
    docs-audit) printf "%s\n" ".agents/skills/casino-docs-audit/SKILL.md" ;;
    issue-dependencies) printf "%s\n" ".agents/skills/casino-issue-dependency-audit/SKILL.md" ;;
    security-pass) printf "%s\n" ".agents/skills/casino-security-review/SKILL.md" ;;
    multiplayer-check) printf "%s\n" ".agents/skills/casino-multiplayer-regression/SKILL.md" ;;
    architecture-split) printf "%s\n" ".agents/skills/casino-architecture-splitter/SKILL.md" ;;
    *) return 1 ;;
  esac
}

casino_codex_validate_root() {
  if [ ! -f AGENTS.md ] ||
    [ ! -f .agents/scripts/codex-goal-launcher.sh ] ||
    [ ! -f .agents/scripts/codex-routines.sh ]; then
    echo "error: run this script from the Casino Warehouse repository root." >&2
    return 1
  fi
}

casino_codex_validate_routine_skill() {
  routine_skill="$(casino_codex_routine_skill_path "$1")"
  if [ ! -f "$routine_skill" ]; then
    echo "error: run this script from the Casino Warehouse repository root." >&2
    return 1
  fi
}

casino_codex_build_goal() {
  routine="$1"
  shift || true
  routine_input="$*"

  case "$routine" in
    issue)
      printf "/goal Complete issue #%s in a separate worktree using \$casino-issue-completion + AGENTS.md: complete correct implementation, open/update PR, evidence review, current main, green checks, readiness report.\n" "$routine_input"
      ;;
    pr-review)
      goal="/goal Review pull request #${routine_input} in full using \$casino-pr-full-review, "
      goal+="\$casino-issue-completion, and AGENTS.md: use a separate worktree when local checkout is needed, "
      goal+="inspect the full PR diff and related context, check prior comments/base freshness/CI, "
      goal+="run relevant evidence checks, leave inline GitHub review comments for every finding or record exact comment failure, "
      goal+="use the issue-completion evidence and status rules for any readiness claim, "
      goal+="and report an evidence-backed verdict."
      printf "%s\n" "$goal"
      ;;
    create-issue)
      printf "/goal Create a researched GitHub issue for Casino Warehouse using \$casino-issue-creation + AGENTS.md: %s. Inspect relevant repository context, search existing issues and pull requests for duplicates, choose compliant title/labels/status/milestone, create the issue through GitHub, verify the created issue, and report the evidence summary.\n" "$routine_input"
      ;;
    triage-issue)
      printf "/goal Triage issue #%s using \$casino-issue-triage + AGENTS.md: inspect the issue, search existing issues and pull requests for duplicates or related work, inspect repository context, update issue metadata or body only when evidence supports it, verify the updated issue, and report the before/after triage evidence.\n" "$routine_input"
      ;;
    ci-failure)
      if [ -n "$routine_input" ]; then
        target="pull request #${routine_input}"
      else
        target="the pull request for the current branch"
      fi
      goal="/goal Inspect failing Casino Warehouse checks for ${target} using \$casino-ci-failure-review + AGENTS.md: "
      goal+="fetch current PR metadata, head SHA, base branch, required check status, workflow runs, failing jobs, and relevant logs; "
      goal+="distinguish required checks from informational or external checks; map visual/e2e failures to local reproduction commands; "
      goal+="classify failures, avoid speculative fixes, ask before making fixes unless this active goal explicitly asks to fix CI, "
      goal+="and report the evidence-backed diagnosis, proposed fix path, commands or logs used, and residual risk."
      printf "%s\n" "$goal"
      ;;
    docs-audit)
      goal="/goal Audit Casino Warehouse documentation drift using \$casino-docs-audit + AGENTS.md: "
      if [ -n "$routine_input" ]; then
        goal+="focus on ${routine_input}; "
      else
        goal+="cover README, AGENTS.md, contributor docs, workflows, npm scripts, issue and PR templates, local agent skills, launchers, and the GitHub Wiki; "
      fi
      goal+="compare documented claims against source-of-truth files, commands, GitHub metadata, and wiki evidence; "
      goal+="record files inspected, wiki pages inspected or skipped, commands/API calls used, drift findings with evidence and severity, skipped checks, and whether each finding is docs-only or needs implementation work."
      printf "%s\n" "$goal"
      ;;
    issue-dependencies)
      goal="/goal Audit Casino Warehouse issue dependencies using \$casino-issue-dependency-audit + AGENTS.md: "
      if [ -n "$routine_input" ]; then
        goal+="focus on ${routine_input} while still reviewing every open issue for dependency or sequencing relationships; "
      else
        goal+="review every open issue for dependency or sequencing relationships; "
      fi
      goal+="list open issues by milestone, label, and status; inspect issue bodies, comments, linked pull requests, reverse references, and repository guidance; "
      goal+="distinguish hard blockers from preferred order using milestone context and evidence; update issue labels, bodies, or canonical dependency comments only when evidence supports it; "
      goal+="avoid closing, deprioritizing, or re-scoping issues unless a maintainer explicitly asks; verify any updates; "
      goal+="and report a maintainer-readable dependency map listing each blocker relationship in both directions plus preferred sequencing, stale relationships, unresolved clarification needs, commands used, skipped checks, and residual risk."
      printf "%s\n" "$goal"
      ;;
    security-pass)
      goal="/goal Run a focused Casino Warehouse security review for ${routine_input} using \$casino-security-review + AGENTS.md: "
      goal+="inspect the target and related security controls, review related tests and existing safeguards before recommending changes, "
      goal+="cover admin token, profile token, server authority, public tunnel, WebSocket origin, persistence, dependency, workflow pinning, CodeQL, and Dependency Review risks where relevant, "
      goal+="verify any current vulnerability, advisory, CVE, deprecation, version, or best-practice claim with current sources, "
      goal+="avoid weakening existing controls, and report findings with locations, severity, exploit or failure mode, evidence, suggested fixes, blocking status, residual risk, commands run, sources, and unresolved assumptions."
      printf "%s\n" "$goal"
      ;;
    multiplayer-check)
      goal="/goal Run a Casino Warehouse multiplayer regression review for ${routine_input} using \$casino-multiplayer-regression + AGENTS.md: "
      goal+="inspect changed files and related protocol schemas, server authority, client realtime URL behavior, public tunnel scripts, persistence boundaries, and relevant tests; "
      goal+="cover room lifecycle, host/join flows, seat claims, spectators, reconnect/reload behavior, heartbeat handling, WebSocket origin checks, public invite URLs, profile ownership, admin permissions, room snapshots, settlements, and persistence reconciliation; "
      goal+="map changed surfaces to targeted unit, state, and Playwright checks including multiplayer flow and public tunnel smoke when relevant; "
      goal+="require deterministic fixtures for game/state assertions, avoid UI recomputation of payouts or settlement logic, "
      goal+="record when live public tunnel smoke cannot be run with the exact command and environment needed, "
      goal+="and report target, changed files or subsystem reviewed, commands run, multiplayer risks checked, findings with location/severity/failure mode/evidence/suggested fix/blocking status, residual risk, and unresolved assumptions."
      printf "%s\n" "$goal"
      ;;
    architecture-split)
      goal="/goal Plan and execute Casino Warehouse architecture cleanup for ${routine_input} using \$casino-architecture-splitter + AGENTS.md: "
      goal+="read docs/code-quality.md, the target files, imports, dependents, related tests, and architecture-check rules; "
      goal+="produce a small staged split plan before editing when the change is large or complex; "
      goal+="preserve behavior, domain ownership, one-top-level-element file shape, direct imports, no vague utility files, no barrels, and game/multiplayer/state authority boundaries; "
      goal+="check circular dependency risk and run architecture checks before and after source import changes; "
      goal+="run tests appropriate to the changed surface and report files inspected, commands run, behavior-change status, residual risk, and follow-up work."
      printf "%s\n" "$goal"
      ;;
    *)
      return 1
      ;;
  esac
}
