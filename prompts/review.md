---
description: Review the current working tree for correctness and release readiness
argument-hint: "[focus]"
---
Review the current repository changes end-to-end.

Additional focus: ${ARGUMENTS:-none specified}

1. Inspect the working tree and relevant surrounding code.
2. Find correctness, security, compatibility, and maintainability issues.
3. Confirm extensions use current Pi APIs and package resources are discoverable.
4. Run the most relevant checks when possible.
5. Report findings by severity with file and line references.
6. If no issues remain, state that clearly and mention any validation gaps.

Do not modify files unless I explicitly ask you to fix the findings.
