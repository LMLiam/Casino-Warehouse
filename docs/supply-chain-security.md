# Supply Chain Security

This repository treats CI workflow dependencies as part of the trusted build boundary. The project uses a small set of controls so the workflows remain auditable without turning routine maintenance into a stream of tiny update pull requests.

## GitHub Actions Pinning

External GitHub Actions must be pinned to a full 40-character commit SHA. A same-line version comment must remain next to the pin, for example:

```yaml
uses: actions/checkout@93cb6efe18208431cddfb8368fd83d5badbf9bfd # v5
```

This follows GitHub's [secure use guidance](https://docs.github.com/en/actions/reference/security/secure-use#using-third-party-actions) that full-length commit SHAs are the immutable form for third-party actions, while tags remain movable. The same-line comment is intentional: GitHub's [Dependabot ecosystem notes](https://docs.github.com/en/code-security/reference/supply-chain-security/supported-ecosystems-and-repositories#github-actions) document that Dependabot can update GitHub Actions references and their version documentation when that comment sits on the `uses:` line.

The current pinned workflow actions are:

| Action                             | Pinned version |
| ---------------------------------- | -------------- |
| `actions/checkout`                 | `v5`           |
| `actions/setup-node`               | `v5`           |
| `actions/upload-artifact`          | `v4`           |
| `actions/dependency-review-action` | `v4.9.0`       |
| `github/codeql-action/init`        | `v4`           |
| `github/codeql-action/analyze`     | `v4`           |

Run `npm run supply-chain:check` after editing workflows. `npm run lint` runs the same check in the normal local and CI lint gate.

## Dependabot Update Policy

Dependabot checks npm dependencies weekly with an open pull request limit of five. GitHub Actions updates are also checked weekly, using GitHub's [`github-actions` ecosystem](https://docs.github.com/en/code-security/how-tos/secure-your-supply-chain/secure-your-dependencies/keeping-your-actions-up-to-date-with-dependabot), grouped into one `github-actions` update group, and capped at two open pull requests. This keeps SHA-pinned workflows maintainable without creating a separate pull request for every action pin.

Dependabot labels both npm and GitHub Actions update pull requests with `dependencies`, `area:tooling`, and `type:maintenance`; GitHub Actions updates also carry the `security` label because they alter CI trust inputs.

## Dependency Review Policy

The Dependency Review workflow is required on pull requests to `main`. It fails when a pull request introduces a known vulnerable dependency at `moderate` severity or higher in `runtime`, `development`, or `unknown` scopes.

This keeps the policy stricter than runtime-only scanning while avoiding low-severity noise. License blocking is intentionally not configured yet because the project uses the PolyForm Noncommercial license and does not currently have a reviewed third-party license denylist. If maintainers add license enforcement later, prefer a small denylist over a broad allowlist.

## Scorecard Follow-Up

OpenSSF Scorecard is not added in this pass. Add it after issue #25 lands so code-scanning ownership, SARIF routing, and required-check expectations are clear before another security signal is introduced.

## SBOM Export

GitHub can [export the repository dependency graph as an SPDX SBOM](https://docs.github.com/en/code-security/supply-chain-security/understanding-your-software-supply-chain/exporting-a-software-bill-of-materials-for-your-repository) from the Dependency graph UI or through the SBOM REST API. That is enough for the current demo project because there is no packaged release artifact. Add an SBOM-producing workflow only when the project starts publishing downloadable releases or needs repeatable release-time provenance artifacts.
