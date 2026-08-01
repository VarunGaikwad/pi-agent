# pi-agent

A ready-to-customize [Pi](https://pi.dev) package containing all four Pi resource types:

- an automatic minimal TUI with a one-line project header, compact model/context footer, and warm theme
- TypeScript extensions with `AskUserQuestion`, `Glob`, `Grep`, `WebSearch`, `package_diagnostics`, `/package-info`, and a compact `/usage` (`/cost`) session summary
- Agent Skills for Pi package development, planning interviews, frontend design, terse communication, and minimal coding
- a `/review` prompt template
- three complete terminal themes: warm `pi-agent`, dark `preapexis-neon`, and light `preapexis-paper`
- a `models.example.json` configuration for Azure Anthropic

Pi loads the TypeScript extension directly, so this package does not need a build step.

## Requirements

- Node.js 22.19 or newer
- Pi coding agent 0.83 or newer

## Get started

```bash
npm install
npm run check
pi -e .
```

`pi -e .` loads the whole local package temporarily. In that Pi session:

- the minimal custom interface appears immediately—no `/tui` command is needed
- run `/package-info` or `/package-info verbose`
- run `/usage` (or `/cost`) to see current-session cost, API/wall time, code changes, and token usage
- ask the agent to call `AskUserQuestion` for interactive single- or multi-select clarification
- ask the agent to call `Glob` to find files by pattern
- ask the agent to call `Grep` to search file contents
- ask the agent to call `WebSearch` for current web results
- ask the agent to call `package_diagnostics`
- run `/init [optional focus]` to create or improve project-specific `AGENTS.md` guidance
- run `/review [optional focus]`
- run `/skill:pi-package-development`
- run `/skill:frontend-design` for distinctive, intentional UI design
- run `/skill:grill-me` to stress-test a plan one question at a time
- run `/skill:caveman [lite|full|ultra]` for terse technical responses
- run `/skill:ponytail [lite|full|ultra]` for minimal, YAGNI-first coding
- use `/settings` to choose `pi-agent`, `preapexis-neon`, or `preapexis-paper`

## Install the package

Use an absolute local path while developing:

```bash
pi install "$(pwd)"
```

Use `-l` to add it to the current project's `.pi/settings.json` instead of your global settings:

```bash
pi install -l "$(pwd)"
```

After publishing, users can install it from npm or git:

```bash
pi install npm:pi-agent
pi install git:github.com/OWNER/REPOSITORY@v0.1.0
```

Pi packages execute with full system access. Review every extension and skill before installing it.

## Customize this starter

1. Change `name`, `description`, `author`, and version in `package.json`.
2. Rename the exported package constants and commands in `extensions/index.ts`.
3. Replace or add resources under `extensions/`, `skills/`, `prompts/`, and `themes/`.
4. Keep the `package.json#pi` manifest synchronized with those directories.
5. Update this README, `LICENSE`, and `CHANGELOG.md`.
6. Run the checks and inspect the npm tarball before publishing.

### Extension

Create `.ts` or `.js` files under `extensions/`. A minimal extension exports a default factory:

```ts
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("hello", {
    description: "Say hello",
    handler: async (_args, ctx) => ctx.ui.notify("Hello!", "info"),
  });
}
```

Pi-provided packages belong in both:

- `peerDependencies` with a `"*"` range for consumers
- `devDependencies` at a tested version for local type checking

Third-party libraries used at runtime belong in `dependencies`.

### Azure Anthropic endpoint

Copy [`models.example.json`](models.example.json) to Pi's user configuration and replace the endpoint, API key, and model values with those shown by the Azure AI portal:

```bash
mkdir -p ~/.pi/agent
cp models.example.json ~/.pi/agent/models.json
chmod 600 ~/.pi/agent/models.json
```

If `~/.pi/agent/models.json` already exists, merge the `azure-anthropic` provider into it instead of overwriting it. Then open `/model` and choose `azure-anthropic/<model>`. Keep the base URL at the Anthropic service root rather than the full `/v1/messages` URL. Cost rates are zero because Azure pricing depends on the deployment.

### Custom TUI

Interactive sessions automatically use a minimal interface:

- one-line `pi` header with the current project
- compact footer with model, thinking level, git branch, and context usage
- package theme and a concise terminal title

Pi's standard editor and working indicator remain unchanged. No `/tui` command is required; non-interactive, JSON, and RPC modes are unaffected.

### AskUserQuestion tool

`AskUserQuestion` lets the agent ask up to four focused questions with two to four options each. It supports single-select, multi-select, custom text answers, cancellation, and both interactive TUI and RPC dialogs.

### Glob tool

`Glob` finds files using patterns such as `**/*.ts`, respects `.gitignore`, and returns paths relative to the selected search directory.

### Grep tool

`Grep` searches file contents using regex or literal patterns, with optional file globs, case-insensitive matching, surrounding context, and result limits. It delegates to Pi's built-in grep implementation and respects `.gitignore`.

### WebSearch tool

`WebSearch` queries Bing's public RSS search endpoint without an API key and returns up to ten titles, URLs, and snippets. It supports allowed/blocked domain filters and marks external result content as untrusted.

### Usage command

`/usage` displays a compact `Session` summary with estimated API spend, API/wall duration, code changes reported by edit/write tools, and input/output/cache tokens. `/cost` is an alias. Token and cost totals include the whole session—including branches, compaction summaries, and nested model calls—because those operations were billed even when they are no longer on the active branch.

The cost is calculated from usage and pricing reported through Pi. API duration is reconstructed from completed assistant calls, while wall duration starts when the current Pi runtime opens the session. Subscription allowances, provider credits, taxes, account-wide rate limits, and file changes made outside edit/write tools are not available through the extension API, so actual totals can differ.

### Skill

Add `skills/<skill-name>/SKILL.md` with valid frontmatter:

```md
---
name: skill-name
description: What the skill does and when Pi should use it.
---
```

#### Bundled third-party skills

- [`frontend-design`](https://github.com/anthropics/skills/tree/main/skills/frontend-design) guides distinctive, intentional visual design, typography, layout, motion, and interface copy.
- [`grill-me`](https://github.com/mattpocock/skills/tree/main/skills/productivity/grill-me) stress-tests plans through a one-question-at-a-time interview. Its internal `grilling` workflow is bundled as a required dependency.
- [`caveman`](https://github.com/JuliusBrussee/caveman) compresses technical responses while preserving code and accuracy.
- [`ponytail`](https://github.com/DietrichGebert/ponytail) favors the smallest correct implementation and avoids unnecessary abstractions.

The upstream `SKILL.md` files are vendored at pinned revisions with their respective licenses. Optional hooks, extensions, companion skills, and scripts are intentionally excluded. See [third-party notices](THIRD_PARTY_NOTICES.md) and each skill's `UPSTREAM.md` for provenance and checksums.

### Prompt templates

- `/init [optional focus]` analyzes the repository and creates or improves project-specific `AGENTS.md` guidance.
- `/review [optional focus]` reviews the working tree without modifying it.

Add top-level Markdown files to `prompts/`. Each filename becomes a slash command. Prompt discovery in this directory is non-recursive.

### Themes

Bundled options:

- `pi-agent` — warm charcoal and terracotta
- `preapexis-neon` — midnight navy with cyan and violet highlights
- `preapexis-paper` — low-glare light paper with ink-like colors

Choose and persist one through `/settings`. The TUI applies `pi-agent` only when Pi starts on its default dark theme, so an explicitly selected custom or light theme is respected.

Add JSON files to `themes/` with a unique `name` and every required Pi color token.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run typecheck` | Type-check extensions and tests |
| `npm test` | Run unit tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run validate` | Validate the manifest, skills, and theme tokens |
| `npm run check` | Run all required checks |
| `npm run pack:check` | Show exactly what npm would publish |

## Package layout

```text
.
├── extensions/                  # TUI, diagnostics, and usage extensions
├── skills/                      # Local and vendored Agent Skills
├── prompts/                     # Prompt templates (non-recursive)
├── themes/                      # TUI themes
├── tests/                       # Extension unit tests
├── scripts/validate-package.mjs # Resource validation
├── package.json                 # npm metadata and Pi manifest
└── tsconfig.json                # Type-check configuration
```

## Publishing

Choose a unique npm package name and add your repository metadata, then run:

```bash
npm run check
npm run pack:check
npm publish
```

For a scoped public package, set the name to `@OWNER/PACKAGE` and publish with `npm publish --access public`.

## License

Project code is [MIT](LICENSE). Vendored skill licenses and attribution are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
