# Contributing

Thanks for helping improve Casino Warehouse.

Casino Warehouse accepts changes through pull requests only. The `main` branch is protected, direct commits are blocked, and pull requests are merged with squash commits.

## Before You Start

- Read the [README](README.md) for local setup.
- Read the [license](LICENSE). Commercial use is not permitted.
- Check existing issues and pull requests before opening duplicates.
- Keep changes focused. Separate unrelated fixes into separate pull requests.

## Pull Request Rules

- Open a pull request from a branch or fork.
- Use the pull request template and fill in every required section.
- Use a conventional pull request title: `type(scope): summary`. Supported types are `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`, `revert`, `security`, and `deps`.
- Add at least one `type:*` label and one `area:*` label.
- Include tests or a clear reason tests are not needed.
- Keep generated build output out of commits.
- Wait for CI and maintainer review.
- Do not commit directly to `main`; maintainers merge pull requests with squash commits.

## Local Checks

Run the relevant checks before requesting review:

```bash
npm install
npm run format
npm run lint
npm test
npm run build
npm run build:server
```

For visual or browser workflow changes, also run:

```bash
npm run visual
```

## Reporting Issues

Use the bug report or feature request templates. Include reproduction steps, expected behaviour, actual behaviour, browser/device details, and screenshots when they help.

## Contributor Credit

You may add yourself to [CONTRIBUTORS.md](CONTRIBUTORS.md) in your first accepted pull request.
