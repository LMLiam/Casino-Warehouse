---
name: cw-pr
description: Create, update, validate, and monitor Casino Warehouse pull requests. Use when the user asks to open a pull request, prepare work for review, update PR metadata, or investigate PR CI.
---

# Casino Warehouse Pull Requests

Use this skill when work is ready for review or when a pull request needs
maintenance. Keep the pull request useful to any maintainer who reads it.
Do not include private chat context, personal worktree details, temporary
debugging notes, or unrelated local files.

## Before Creating A Pull Request

1. Read `CONTRIBUTING.md` and the relevant project documentation.
2. Confirm the current branch is not `main`.
3. Inspect the complete diff, recent commits, and worktree status.
4. Keep unrelated user changes untouched.
5. Keep generated build output out of the change.
6. Confirm the change has a focused scope.
7. Run the narrowest relevant checks. For broad changes, run the full checks
   required by `CONTRIBUTING.md`.

Use a conventional title and commit message:

```text
type(scope): summary
```

Use one of these types:
`feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`, `security`, or `deps`.

## Pull Request Metadata

Add at least one `type:*` label and one `area:*` label. Use the repository's
existing labels where possible.

Use all required sections in the pull request body:

````markdown
## Summary

<Describe the change and why it is needed.>

## Type

- [ ] Bug fix
- [ ] Feature
- [ ] Documentation
- [ ] Refactor
- [ ] Test or tooling

## Checks

- [ ] I read `CONTRIBUTING.md`.
- [ ] I kept generated build output out of this pull request.
- [ ] I added or updated tests, or explained why tests are not needed.
- [ ] I ran the relevant local checks.

## Testing

Commands run:

```text
<non-empty list of commands>
```
````

## Notes

<Relevant information for reviewers, or `No additional notes.`>

````

Before submitting the body, ensure that:

- `Summary` has a specific change and reason.
- At least one `Type` checkbox is selected.
- All four required `Checks` items are selected.
- `Testing` contains a non-empty fenced `Commands run:` block.
- `Notes` contains only information useful to reviewers.
- No template placeholder remains.
- The body does not claim that a command passed unless it was run.

The repository validates these requirements with
`scripts/validate-pr-standards.mjs` in the `Pull Request Checks` workflow.

## Create Or Update

If a pull request already exists for the branch, update it instead of creating
a duplicate. Otherwise, push the branch and create one with `gh pr create`.
Set the conventional title, body, base branch, and required labels.

Inspect the resulting pull request with `gh pr view` and confirm that the
title, labels, sections, checkboxes, and commands match the local validator.
Inspect the live `labels` field. Confirm that it contains at least one
`type:*` label and one `area:*` label. Do not infer labels from the create
command or from the pull request body.

## CI Monitoring

After pushing or editing a pull request, inspect its checks with:

```bash
gh pr checks <number>
````

Monitor required checks when the user asks for CI monitoring or when the task
requires a verified pull request. Use `gh run list` to identify the workflow
run, then use `gh run watch <run-id> --compact --exit-status`.

If a check fails:

1. Read the complete failed step log with `gh run view <run-id> --log-failed`.
2. Classify the failure as metadata, code, infrastructure, or an external
   service failure.
3. Reproduce code failures locally before editing source.
4. Fix the root cause with the smallest focused change.
5. Re-run the relevant local checks.
6. Push the fix and monitor the new run.

For a metadata failure, compare the live PR body with the exact validator
requirements. Update the PR body rather than changing the validator unless
the repository contract itself has changed.

Do not report the pull request as passing while a required check is failed,
queued, or unknown. Report unresolved external failures separately from code
failures.

## Completion Report

Report:

- the pull request URL;
- the branch and commit identifiers;
- the local commands that passed;
- the current required CI status; and
- any remaining failure, queue, or review state.

Use factual statements. Do not include private worktree notes or context that
only the current chat can explain.
