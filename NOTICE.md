# Third-party components

This repository is MIT licensed (see `LICENSE`), **except** for the components below, which carry
their own terms. Anyone redistributing or publishing this bundle needs to keep this file with it —
declaring the whole thing MIT would misstate the license on the vendored parts.

## `skills/skill-creator/` — Apache License 2.0

Vendored from Anthropic's skill-creator skill. The full license text ships alongside it at
`skills/skill-creator/LICENSE.txt` and must stay there.

**Modified:** `skills/skill-creator/SKILL.md` — added a short "Antigravity-Specific
Instructions" section pointing to the new file `skills/skill-creator/references/antigravity.md`.
No other file in that folder was changed. Apache-2.0 requires that the license and
any attribution notices travel with the code, and that modified files are marked as changed.

Note that some agent hosts ship their own `skill-creator`. Two skills with the same name and
overlapping descriptions compete for the same triggers, so if your host already provides one,
either drop this copy or rename the folder and its `name` field before installing.

## `skills/problem-solving/` — derived from Microsoft Amplifier (MIT)

The six problem-solving techniques were adapted from agent patterns in
[microsoft/amplifier](https://github.com/microsoft/amplifier), commit
`2adb63f858e7d760e188197c8e8d4c1ef721e2a6` (2025-10-10). Amplifier is MIT licensed. Attribution
and a description of what was adapted are in `skills/problem-solving/ABOUT.md`. The techniques now
live in `skills/problem-solving/references/` as plain Markdown (frontmatter removed).

## `skills/scenario/` and `skills/sumup/` — adapted from AgentKit (MIT)

Rewritten from AgentKit's `ak-scenario` and `ak-sumup` skills, with the AgentKit CLI and
cross-skill dependencies removed. `ak-scenario` is itself adapted from `/autoresearch:scenario`
in [uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch) (MIT). Keep this
attribution when redistributing; confirm the AgentKit kit's own license text before publishing.

## Everything else

`SKILL.md` at the root, `skills/brainstorm`, `spec`, `plan`, `cook`, `fix`, `cicd` (with its
`references/`),
`frontend-mindset`, `design-taste-frontend`, `minimalist-ui`, plus `agents/`, `hooks/` and
`references/` — MIT, per `LICENSE`.

Design systems, fonts and product names mentioned inside the frontend skills belong to their
respective owners; those skills reference them, they do not redistribute them.
