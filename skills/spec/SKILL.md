---
name: spec
description: "Write spec.md directly from an existing brainstorm report or a short user description, with no exploration phase. Use when the user already has a clear idea and just wants a spec written (\"write a spec for X\", \"spec this out\", \"I know what I want, just write the spec\") — not when they want to explore options first (that's brainstorm). Writes exactly one file, no plan or code."
---

# spec — Write a Spec Directly

No exploration, no options comparison — the user already knows what they want.
If they're still weighing approaches, redirect to the `brainstorm` skill instead.

---

### Step 1 — Gather Input

Accept either:
- A path to an existing brainstorm report (`plans/reports/*-brainstorm.md`) — read it for context.
- A short description from the user — use as-is.

If required template sections (User Stories, Functional Requirements, Success Criteria) can't be filled from the input, ask the user rather than inventing content. Max 2–3 targeted questions.

---

### Step 2 — Write the Spec

Fill the shared spec template. The canonical copy lives one skill over, at
`../brainstorm/references/spec-template.md` — read it if reachable, because keeping one template
means `brainstorm`, `spec` and `plan` all agree on section names.

If that file isn't reachable (skill loaded standalone, different host layout), don't stall — write
the same document from this section list, which is what the template encodes:

```
# Spec: {feature name}      (+ Date, Status: Draft | Ready | Approved)
## Problem Statement        1–2 sentences: what pain, for whom, why now
## User Stories             [P1] MVP / [P2] nice-to-have / [P3] out-of-scope,
                            each with "Accepted when: {testable condition}"
## Functional Requirements  numbered FR-01…, specific and checkable
## Non-Functional Requirements   numbers not adjectives (p95 < 500ms, not "fast")
## Success Criteria         checkbox list, each independently verifiable
## Out of Scope             explicit exclusions
## Assumptions              each one that, if wrong, changes the spec
## [NEEDS CLARIFICATION]    remove the section when empty
```

Write to `plans/{slug}/spec.md`, where `{slug}` is a short kebab-case name derived from the
feature. This is the same location `brainstorm` writes to and the same location `plan` reads
from — see `../../references/artifact-layout.md` for the full artifact contract.

Use only the input gathered — no new sections, no extra files (no plan, no report, no code).
Leave `[NEEDS CLARIFICATION]` for anything still unresolved after Step 1's questions.

---

### Step 3 — Handoff

Ask the user:

**"Spec written at `plans/{slug}/spec.md`. What next?"**
- `plan plans/{slug}/spec.md` — proceed to planning
- `Keep editing` — revise the spec further

## Host compatibility

See `../../references/host-compatibility.md`. In short: this workflow needs only file reads and
writes plus the ability to ask the user a question, so it runs unchanged on Antigravity, Claude
Code, Codex, and plain CLI agents. If a referenced sibling skill, subagent, or slash command
isn't available on the current host, do the equivalent step inline, keep the same artifact and
verification requirements, and say briefly which fallback you used.
