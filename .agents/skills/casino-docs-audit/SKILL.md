---
name: casino-docs-audit
description: Audit Casino Warehouse documentation, agent workflows, scripts, templates, workflows, and wiki pages for evidence-backed drift from repository truth.
---

# Casino Documentation Audit

Use this skill when a user asks Codex to audit, review, compare, verify, or report documentation drift in Casino Warehouse docs, agent instructions, GitHub Wiki pages, workflows, npm scripts, issue or pull request templates, launcher scripts, or local skills.

This workflow produces evidence-backed findings. It may draft issues or patches only when the user explicitly asks for that follow-up. If the user asks to create an issue from a docs audit finding, use `.agents/skills/casino-issue-creation/SKILL.md`; if the user asks to implement a fix, use `.agents/skills/casino-issue-completion/SKILL.md`.

## Core Rules

- Do not invent policy or infer correctness from intent. Every finding must cite the documented claim and the source-of-truth evidence that proves the drift.
- Separate facts from recommendations. Mark uncertainties and skipped checks explicitly.
- Compare documentation to live repository files, commands, GitHub metadata, and wiki evidence rather than relying on memory.
- Keep Casino Warehouse in its fictional-money, noncommercial scope. Flag docs that imply deposits, withdrawals, payments, crypto, NFTs, cash-out flows, or commercial casino positioning.
- Web-verify before making current external claims about versions, deprecations, CVEs, advisories, best practices, or feature availability. If no current external claim is needed, say so in the final report.
- Do not change code, docs, workflows, labels, milestones, issues, or pull requests unless the user explicitly asks for changes after the audit.

## Required Repository Context

Read the relevant parts of these primary docs before reporting findings:

- `AGENTS.md`
- `README.md`
- `CONTRIBUTING.md`
- `GOVERNANCE.md`
- `docs/code-quality.md`
- `docs/supply-chain-security.md`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `.github/ISSUE_TEMPLATE/`

Inspect source-of-truth files and metadata relevant to the requested audit scope:

- `package.json` npm scripts and supported Node version files
- `.github/workflows/` workflow names, jobs, required context names, and action pins
- `.github/dependabot.yml`, `.github/CODEOWNERS`, and other repository metadata when referenced by docs
- root launcher scripts such as `start-codex-*.sh`
- `.agents/scripts/`
- `.agents/skills/`
- `scripts/` validation, dev server, tunnel, security, and code quality tooling
- GitHub issue labels, milestones, and repository settings when docs make metadata claims
- GitHub Wiki settings and pages when wiki support is enabled or referenced

## Audit Workflow

1. Define the audit scope:
   - If the user named files or topics, keep the audit focused on those areas and their source-of-truth dependencies.
   - For a broad docs drift audit, include setup/runtime docs, public demo flows, governance, issue/PR standards, security/supply-chain docs, agent workflows, npm scripts, workflows, templates, labels, milestones, and wiki pages.

2. Build an evidence matrix:
   - For each documented command, policy, workflow, status context, label, milestone, template expectation, skill name, launcher, or wiki claim, record the documentation location and the source-of-truth location or command used to verify it.
   - Treat missing files, renamed scripts, mismatched command names, stale status contexts, contradictory workflow guidance, and absent metadata as potential drift.

3. Verify npm scripts:
   - Compare commands documented in `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, wiki pages, and agent skills against `package.json`.
   - Record removed, renamed, undocumented, or behavior-changing scripts separately from harmless omissions.

4. Verify GitHub workflows and required checks:
   - Compare workflow files under `.github/workflows/` to documented check names in `CONTRIBUTING.md`, `AGENTS.md`, `docs/supply-chain-security.md`, and wiki pages.
   - Verify required pull request status contexts with GitHub metadata when available. If repository settings are inaccessible, record the attempted command or tool and mark the branch-protection check as skipped rather than guessing.
   - For workflow edits or claims about supply-chain controls, confirm external actions are pinned to full 40-character SHAs with same-line version comments.

5. Verify issue and pull request standards:
   - Compare `.github/PULL_REQUEST_TEMPLATE.md`, `.github/ISSUE_TEMPLATE/`, `scripts/validate-pr-standards.mjs`, `scripts/validate-issue-standards.mjs`, `CONTRIBUTING.md`, `GOVERNANCE.md`, and `AGENTS.md`.
   - Check that title, label, status, milestone, template, and testing expectations do not contradict each other.

6. Verify agent workflows:
   - Compare `AGENTS.md`, root `start-codex-*.sh` launchers, `.agents/scripts/`, and `.agents/skills/`.
   - Check stale skill names, missing skill files, missing `agents/openai.yaml` metadata, contradictory direct invocation guidance, missing launcher preconditions, missing `--print` or `--dry-run` support where promised, and inconsistent generated `/goal` text.

7. Audit the GitHub Wiki when relevant:
   - Check repository wiki support with GitHub metadata, for example `gh repo view --json hasWikiEnabled`.
   - If wiki support is enabled, inspect pages that duplicate setup, public demo, governance, issue/PR, security, or agent-workflow guidance. Prefer the wiki git remote when accessible so page filenames and content are concrete evidence.
   - Record the wiki URL, pages inspected, commands or API calls used, and findings.
   - If the wiki is disabled, empty, private, unavailable, or blocked by authentication/network limits, record an explicit skipped-check reason and the attempted command or tool.

8. Classify each finding:
   - `docs-only drift`: documentation or wiki text should be updated to match current behavior.
   - `metadata drift`: labels, milestones, required checks, templates, or repository settings differ from documented guidance.
   - `agent-workflow drift`: skill, launcher, or agent-facing instruction mismatch.
   - `implementation follow-up`: source behavior, workflow behavior, or tooling must change before the docs can be truthful.
   - `needs maintainer input`: repository setting, policy choice, or unavailable evidence prevents a safe conclusion.

9. Report results:
   - Include files inspected, wiki pages inspected or skipped, commands used, drift findings, skipped checks, and current-info verification.
   - Findings must include location, evidence, severity, suggested remediation, and whether the fix is docs-only or implementation work.
   - If there are no findings, say which surfaces were checked and name any residual evidence gaps.

## Useful Evidence Commands

Use focused commands and keep outputs tied to the report:

```bash
rg --files AGENTS.md README.md CONTRIBUTING.md GOVERNANCE.md docs .github .agents scripts
node -e 'const p=require("./package.json"); console.log(JSON.stringify(p.scripts,null,2))'
gh repo view --json hasWikiEnabled
git ls-remote https://github.com/LMLiam/Casino-Warehouse.wiki.git
```

Use repository-specific verification commands when they cover changed docs or scripts:

```bash
bash -n start-codex-docs-audit.sh
npm run format
npm run lint
```

## Report Format

Use this final report shape for audit-only work:

```txt
Scope:
Files inspected:
Wiki pages inspected:
Wiki skipped checks:
Commands/API calls used:
Current-info verification:
Findings:
Docs-only drift:
Metadata drift:
Agent-workflow drift:
Implementation follow-ups:
Skipped checks:
Residual risk:
Status:
```

`Status` must be one of:

- `Audit complete`
- `Audit complete with findings`
- `Blocked`
