# Project Instructions

This repository is a Pi package. Keep it installable through npm, git, and local paths.

## Structure

- `extensions/`: TypeScript Pi extensions loaded directly by Pi.
- `skills/`: Agent Skills; each skill directory contains `SKILL.md`.
- `prompts/`: Non-recursive Markdown prompt templates.
- `themes/`: Pi theme JSON files with every required color token.
- `scripts/validate-package.mjs`: Local resource validation.

## Development rules

- Follow the Pi documentation matching the installed package version.
- Keep Pi-provided runtime imports in `peerDependencies` with a `"*"` range.
- Put third-party runtime imports in `dependencies`.
- Do not add a build step unless published extensions are changed to point at build output.
- Add tests for reusable extension logic.
- Run `npm run check` and `npm run pack:check` before finishing.
- Update `README.md` and `CHANGELOG.md` for user-facing changes.
