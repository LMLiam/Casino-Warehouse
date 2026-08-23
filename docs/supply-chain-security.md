# Supply Chain Security

This repository treats CI workflow dependencies as part of the trusted build boundary. The project uses a small set of controls so the workflows remain auditable without turning routine maintenance into a stream of tiny update pull requests.

## GitHub Actions Pinning

External GitHub Actions must be pinned to a full 40-character commit SHA. A same-line version comment must remain next to the pin, for example:

```yaml
uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
```

This follows GitHub's [secure use guidance](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions) that full-length commit SHAs are the immutable form for third-party actions, while tags remain movable. The same-line comment is intentional: GitHub's [Dependabot ecosystem notes](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#github-actions) document that Dependabot can update GitHub Actions references and their version documentation when that comment sits on the `uses:` line.

The current pinned workflow actions are:

| Action                              | Pinned version |
| ----------------------------------- | -------------- |
| `actions/checkout`                  | `v5`           |
| `actions/setup-node`                | `v5`           |
| `actions/upload-artifact`           | `v4`           |
| `actions/dependency-review-action`  | `v4.9.0`       |
| `github/codeql-action/init`         | `v4`           |
| `github/codeql-action/analyze`      | `v4`           |
| `github/codeql-action/upload-sarif` | `v4`           |
| `ossf/scorecard-action`             | `v2.4.3`       |

Run `npm run supply-chain:check` after editing workflows. `npm run lint` runs the same check in the normal local and CI lint gate.

## Dependabot Update Policy

Dependabot checks npm dependencies weekly with an open pull request limit of five. npm security updates are grouped into one `npm-security` security-update group for the root manifest.

GitHub Actions updates are also checked weekly using GitHub's [`github-actions` ecosystem](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/keeping-your-actions-up-to-date-with-dependabot). Version updates are grouped into one `github-actions` update group, security updates are grouped into one `github-actions-security` update group, and open pull requests are capped at two. This keeps SHA-pinned workflows maintainable without creating a separate pull request for every action pin.

Dependabot labels both npm and GitHub Actions update pull requests with `dependencies`, `area:tooling`, and `type:maintenance`; GitHub Actions updates also carry the `security` label because they alter CI trust inputs.

## Dependabot Alerting Policy

Dependabot alerts, Dependabot malware alerts, and Dependabot security updates are expected to remain enabled in the repository's GitHub security settings. Dependabot alerts surface known vulnerable dependencies from the dependency graph, while Dependabot security updates can open remediation pull requests for supported vulnerable dependencies.

Dependabot malware alerts are an additional alerting and triage signal for known malicious dependencies on the default branch. They are currently most relevant to this npm project because GitHub makes malware alerts available for packages in the `npm` ecosystem. Treat these alerts as high-priority security-health signals: triage the affected package, remove or replace the malicious dependency, and open a focused follow-up issue or pull request when remediation cannot happen immediately.

Malware alerts are not a complete malware scanner. GitHub documents that alerts cannot catch every issue, newly discovered malware can take time to appear in the GitHub Advisory Database, and only GitHub-reviewed advisories trigger alerts. Keep reviewing dependency changes, preserving the lockfile-backed dependency graph, and relying on Dependency Review for pull request-time blocking.

## Dependency Review Policy

The `Dependency Security Review / Review Dependency Changes` check is required on pull requests to `main`. It fails when a pull request introduces a known vulnerable dependency at `moderate` severity or higher in `runtime`, `development`, or `unknown` scopes.

This keeps the policy stricter than runtime-only scanning while avoiding low-severity noise. License blocking is intentionally not configured yet because the project uses the PolyForm Noncommercial license and does not currently have a reviewed third-party license denylist. If maintainers add license enforcement later, prefer a small denylist over a broad allowlist.

## OpenSSF Scorecard

OpenSSF Scorecard runs from `.github/workflows/scorecard.yml` on a weekly Tuesday schedule and through manual `workflow_dispatch`. It does not run on pull requests because Scorecard is a repository-level posture signal and the official action does not support forked repositories.

The workflow uses the official `ossf/scorecard-action`, pinned by full commit SHA with a same-line version comment. The job grants only the permissions needed for this configuration: `contents: read` for checkout/repository inspection, `id-token: write` to publish authenticated results to the Scorecard API, and `security-events: write` to upload SARIF into GitHub code scanning. Workflow-level permissions stay empty so those writes are scoped to the Scorecard job.

Results are published with `publish_results: true` so the public Scorecard API and README badge reflect this repository's own run instead of the broader weekly ecosystem scan. The workflow also uploads `scorecard.sarif` as a short-lived Actions artifact and to GitHub code scanning so maintainers can inspect individual findings from the Security tab.

Maintainers triage Scorecard findings as security-health signals, not automatic merge blockers:

- Create follow-up issues for actionable repository gaps, especially findings that affect branch protection, dependency hygiene, token permissions, release provenance, or vulnerability reporting.
- Mark findings as accepted false positives in issue or PR notes when the recommendation does not fit this source-available, noncommercial demo project.
- Prefer small, scoped follow-up issues over broad "raise the score" work.
- Do not weaken existing CodeQL, Dependency Review, branch protection, or action-pinning controls to improve a Scorecard score.

### Accepted risk: single-owner branch protection posture

OpenSSF Scorecard's `BranchProtection` check reports a less-than-maximal score because `main` requires one approving review and because the ruleset does not apply identically to administrators. This is an intentional, documented policy decision (#63), reviewed by the maintainer in August 2026:

- The repository has a single maintainer. Raising the required approval count above one would require a second reviewer that the project cannot currently provide, blocking all merges without adding real review diversity.
- The owner bypass on the `main protection with owner bypass` ruleset is deliberate: it lets the maintainer merge routine, green dependency and tooling pull requests without self-approving. Every other protection rule still applies to bypass merges — squash-only merges, required status checks (`Required Quality Gate`, CodeQL analysis, metadata validation, dependency review), stale-review dismissal, review-thread resolution, and non-fast-forward/deletion blocks.
- Revisit this decision if additional maintainers with merge rights join the project; at that point the bypass should be removed and the approval requirement re-evaluated.

## SBOM Export

GitHub can [export the repository dependency graph as an SPDX SBOM](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exporting-a-software-bill-of-materials-for-your-repository) from the Dependency graph UI or through the SBOM REST API. That is enough for the current demo project because there is no packaged release artifact. Add an SBOM-producing workflow only when the project starts publishing downloadable releases or needs repeatable release-time provenance artifacts.
