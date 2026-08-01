# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- Renamed the working-tree review prompt from `/review-change` to `/review`.
- Simplified the automatic TUI to a one-line project header and compact model, branch, and context footer while keeping Pi's standard editor and working indicator.
- Reformatted `/usage` and `/cost` as a compact `Session` summary with API/wall duration and code-change totals.
- Respect explicitly selected custom and light themes instead of always forcing `pi-agent`.

### Added

- Added `models.example.json` for configuring an Azure Anthropic endpoint without environment variables.
- Added a no-key `WebSearch` tool backed by Bing RSS with allowed and blocked domain filters.
- Added a `Grep` tool for searching file contents with regex, literal, glob, context, and limit options.
- Added a `Glob` tool for finding files by pattern while respecting `.gitignore`.
- Added an `AskUserQuestion` tool for interactive single-select, multi-select, and custom-text clarification.
- Added `/init` to analyze a repository and create or improve its `AGENTS.md` guidance.
- Added dark `preapexis-neon` and light `preapexis-paper` theme options.
- Initial Pi package boilerplate with an extension, skills, prompt template, and theme.
- Type checking, tests, resource validation, and package dry-run scripts.
- Vendored the primary Caveman and Ponytail skills at pinned upstream revisions, including licenses and provenance.
- Added `/usage` and `/cost` commands for current-session token, cache, context, model, and estimated cost reporting.
- Vendored Anthropic's `frontend-design` skill at a pinned upstream revision with its Apache 2.0 license and provenance.
- Vendored Matt Pocock's `grill-me` skill and its required `grilling` workflow at a pinned revision with MIT licenses and provenance.
