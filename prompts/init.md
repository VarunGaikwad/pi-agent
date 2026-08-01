---
description: Analyze the repository and initialize project guidance
argument-hint: "[optional focus]"
---
Analyze this repository and create or improve its `AGENTS.md` guidance for future coding agents.

Optional focus: ${ARGUMENTS:-none specified}

1. Inspect the project structure, languages, package manager, scripts, tests, and existing documentation.
2. Preserve accurate existing instructions; update them instead of replacing them blindly.
3. Document only project-specific structure, development conventions, and validation commands.
4. Keep the guidance concise and actionable. Exclude generic coding advice and facts easily inferred from filenames.
5. Add nested `AGENTS.md` files only when a subdirectory genuinely needs different instructions.
6. Run the most relevant validation command after editing, when practical.
