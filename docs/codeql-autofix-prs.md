# CodeQL Autofix PR Automation

This repository uses the GitHub Code Scanning REST Autofix endpoints for the experimental automation in `.github/workflows/codeql-autofix-prs.yml`.

The workflow does not use Copilot cloud agent assignment. It uses these supported API steps when explicitly run in create mode:

1. List open CodeQL code-scanning alerts on the default branch.
2. Request Copilot Autofix for a selected alert with `POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix`.
3. Poll `GET /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix` until GitHub reports a generated fix.
4. Create a branch from the default branch.
5. Commit the generated fix to that branch with `POST /repos/{owner}/{repo}/code-scanning/alerts/{alert_number}/autofix/commits`.
6. Open a draft pull request with repo-standard metadata.

The scheduled run is dry-run only. It writes the candidate and skip list to the workflow log and step summary, but does not request or commit fixes.

## Guardrails

- No pull request trigger is configured, so the workflow never checks out untrusted pull request code.
- The dry-run job has read-only permissions for contents, pull requests, and security events.
- Write permissions are only granted to the manual `create-draft-prs` job.
- Candidates must be open CodeQL alerts on the default branch.
- Candidates must meet the configured minimum severity, which defaults to `high`.
- A comma-separated CodeQL rule allowlist can narrow automation to known low-risk rules.
- Existing open fix PRs are detected by generated branch name, alert URL, or alert number in the PR body.
- Autofix support is confirmed by the Autofix create/status API before any fix branch is created. Unsupported alerts, API failures, and polling timeouts are logged as failed candidates without opening PRs.
- Runs are capped with `max-alerts`, defaulting to `3`, so one run cannot spam pull requests.
- Generated pull requests are always drafts.
- Generated pull requests include the alert URL, rule, severity, affected files, and GitHub's generated fix summary.

## Running

Use the `CodeQL Autofix PRs` workflow manually.

- `dry-run` previews candidates without creating branches or pull requests.
- `create-draft-prs` requests Autofix, commits successful generated fixes, and opens draft pull requests.

Useful inputs:

- `min-severity`: `critical`, `high`, `medium`, or `low`.
- `max-alerts`: maximum number of candidate alerts processed in one run.
- `allow-rules`: optional comma-separated CodeQL rule IDs, for example `js/insecure-randomness`.

## Disable Quickly

The fastest shutdown is to disable the `CodeQL Autofix PRs` workflow in GitHub Actions.

For a code-only shutdown, remove or comment out the `schedule` trigger in `.github/workflows/codeql-autofix-prs.yml`. To keep the workflow available but prevent PR creation, use only `dry-run` mode and set `max-alerts` to `0`.

## Maintainer Review

Treat every generated pull request as untrusted until reviewed. A maintainer should inspect the diff, run the relevant local checks, and only mark the PR ready when the generated fix is appropriate for the repository.
