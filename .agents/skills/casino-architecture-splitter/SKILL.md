---
name: casino-architecture-splitter
description: Plan and execute Casino Warehouse architecture cleanup and file-splitting work. Use when Codex needs to split large source files, reduce module-scope top-level elements, move code between domain owners, fix architecture-check failures, or refactor source organization while preserving behavior, authority boundaries, tests, and direct imports.
---

# Casino Architecture Splitter

Use this skill for structural cleanup in Casino Warehouse. If the work completes an issue or updates a pull request, also use `.agents/skills/casino-issue-completion/SKILL.md` for PR, review, CI, and readiness evidence.

## Core Rules

- Preserve behavior unless the user explicitly asks for a behavior change.
- Prefer the existing codebase patterns over new abstractions.
- Keep changes focused on the target file, subsystem, issue, or architecture-check failure.
- Do not move authoritative game, payout, bankroll, persistence, or realtime rules into UI renderers.
- Do not add barrel files. Import focused module files directly.
- Do not create vague split targets such as `utils`, `helpers`, `misc`, or `manager`.
- Keep every new source module focused on one module-scope top-level element.
- Treat passing checks as evidence only after confirming they cover the changed surface.

## Required Context

Before proposing or editing a split, read:

- `AGENTS.md`
- `docs/code-quality.md`
- the target file or files
- imports used by the target
- modules, tests, and views that import or call the target
- relevant unit, server/client, or e2e tests for the affected behavior

When changing source imports, also inspect:

- `scripts/architecture-check.mjs`
- `scripts/top-level-elements-check.mjs`
- current `npm run architecture:check` output before editing

Use focused commands such as:

```bash
rg "from ['\"]|import\\(" src tests
rg "TargetName|target-file-name" src tests
npm run architecture:check
```

## Domain Owner Map

Choose the narrowest owner:

- `src/game/`: pure game engines, card/RNG primitives, payout and settlement rules, slot themes, and catalog data.
- `src/multiplayer/`: realtime protocol, server entrypoint, room authority, heartbeat handling, and room/session coordination.
- `src/state/`: server data persistence, persisted profile/session schemas, and flow state machines.
- `src/schemas/`: Zod schemas for runtime boundaries and persisted envelopes.
- `src/assets/`: asset manifest and asset path helpers.
- `src/audio/`: audio settings and playback service.
- `src/ui/`: rendering primitives, Pixi table, Radix chrome, layout data, and visual-only helpers.
- `src/app/shell/`: browser application coordinator and DOM event binder.
- `src/app/dom/`: shell template and typed element collection.
- `src/app/views/`: DOM view renderers and view-local controllers.
- `src/app/state/`: app snapshots and player construction for rendering server-owned data.
- `src/app/input/`: DOM input parsing and table hit testing.
- `src/app/format/`: display-only formatting and HTML list rendering.
- `src/app/rooms/`: room defaults and room-specific app constants.
- `tests/unit/<domain>/`: Vitest coverage grouped by source domain.
- `tests/e2e/`: Playwright browser workflows.

Respect these dependency directions:

- Game modules must stay independent of UI, app, and multiplayer modules.
- Multiplayer and state modules must stay independent of UI and app modules.
- UI primitives must not import the app shell.
- App modules must live in an approved `src/app/<role>/` folder.

## Split Plan

For large files, complex modules, or broad cleanup, produce a small staged plan before editing:

1. Name the current owner, the target owner, and why that owner is narrowest.
2. List the exact top-level element or cohesive block to extract in each stage.
3. Name the new files and why each filename describes a domain concept.
4. Show the import/dependent surface and circular dependency risk.
5. State which authoritative rules stay in game, multiplayer, state, or schemas.
6. Name the tests or checks that will prove behavior is unchanged.

Keep each stage independently reviewable. When a split would require behavior changes, stop and call that out before editing.

## Implementation

- Extract one cohesive element at a time.
- Preserve public APIs where possible; update imports directly at call sites.
- Keep file-local details nested inside the element they support unless extraction improves clarity.
- Avoid mixed modules that collect unrelated constants, types, and functions.
- Keep deterministic RNG, deck, reel, profile, and server fixtures in tests where gameplay or multiplayer behavior is involved.
- Preserve profile-token, admin-token, WebSocket-origin, and server-authority boundaries when splitting multiplayer or persistence code.

## Verification

Run checks that match the changed surface and record pass/fail status:

- `npm run architecture:check` before and after source import or file-shape changes.
- Focused unit or e2e tests for behavior touched by the split.
- `npm run lint` when source imports or TypeScript files changed.
- `npm run format` when Markdown, YAML, scripts, source, or tests changed.
- `bash -n <launcher>` when editing shell launchers.

If the change is documentation, skill, or launcher-only, say why behavior tests are not needed. If the split is intended to preserve behavior, state the evidence for unchanged behavior rather than relying on intent.

## Report

When handing off architecture cleanup, include:

- target files or subsystem
- files inspected
- split plan or reason no split plan was needed
- files changed
- behavior-change status
- commands run and results
- architecture, circular-dependency, security, performance, test, and documentation risks checked
- residual risks or follow-up work
