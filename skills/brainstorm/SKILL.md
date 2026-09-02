---
name: brainstorm
description: "Explore and debate solutions before writing code. Use when the user poses a design question, asks \"how should I approach X\", wants to think through options before committing, or says anything like \"let's brainstorm\", \"what's the best way to...\", \"I'm not sure how to tackle this\", or \"should I use X or Y\". Always runs before `plan` for novel or ambiguous features. No code is written — only: explore → clarify → spec → report."
---

# brainstorm — Surface Ideas, Then Decide

**Hard gate: zero implementation code.** Only explore → expand → spec → report.
Implementation happens later via `plan` → `cook`.

---

### Step 0 — Listen First

Do NOT scout the codebase yet. Do NOT present options yet.

Ask one open question to understand the user's existing thinking:

> "What directions are you already leaning toward — even loosely?"

Wait for their answer. Understand their mental model before adding yours.

```
// Listen before scouting.
// The user's intuition is the starting point, not a blank slate.
```

---

### Step 1 — Draw Out Ideas

Use `ask the user directly` to surface the user's thinking. Ask 1–2 questions per turn — never all at once.

Focus on **generative** questions:

- What approaches have you considered, even ones you've dismissed?
- What would the ideal outcome look like if there were no constraints?
- Is there a simpler version that would still solve the core problem?
- What's the one thing you're most uncertain about?

Add your own perspective after the user speaks — suggest angles they haven't mentioned, framed as possibilities, not recommendations.

Loop until the idea space feels explored and the user has expressed a preference or direction.

```
// User ideas first → Claude expands → iterate
// Aim for breadth (4–6 directions sketched lightly), not depth on one
```

---

### Step 2 — Scout (Only If Needed)

If a specific question from Step 1 requires codebase context, spawn 1–2 targeted **`Explore` sub-agents** inline.

```
// Scout is optional and reactive, not automatic.
// Only spawn if "I need to check X before we can evaluate Y."
```

---

### Step 3 — Narrow Together

Once the user signals interest in 1–2 directions, briefly compare them:

- What each does well for **this** project
- What it costs or risks
- Any hard incompatibilities with the existing codebase

Be direct. If one option is over-engineered or a poor fit, say so. The user drives the final call.

```
// Option A: [name] — [one-liner]
//   ✓ [specific upside]
//   ✗ [real cost]
//
// Option B: [name] — [one-liner]
//   ✓ ...
//   ✗ ...
```

---

### Step 4 — Clarification Gate

Before writing artifacts, scan the narrowed direction for ambiguity:

- Flag at most **3 items** with `[NEEDS CLARIFICATION: <what's missing>]`
- Ask **1–2 targeted questions per turn** — stop when resolved or user signals "close enough"
- Red flags: no measurable success criteria, vague scale ("fast", "many users"), missing priority signal (MVP vs. nice-to-have)

Don't block on minor uncertainty. Mark it and move on.

```
// Clarification is cheap here; ambiguity in planning is expensive.
// Max 3 flags, max 5 questions total across the session.
```

---

### Step 5 — Write Artifacts

Write **two files**:

**A. Brainstorm report** → `plans/reports/YYMMDD-{slug}-brainstorm.md`

```markdown
# Brainstorm: {challenge}

**Date:** YYYY-MM-DD

## Ideas Explored
{All directions considered — even ones dismissed. 1–2 lines each.}

## User's Direction
{What the user leaned toward and why — in their words where possible}

## Open Questions
{Unresolved items that `plan` must address}

## Risks
{Top 2–3 risks worth watching}
```

**B. Spec file** → `plans/{slug}/spec.md` (from `references/spec-template.md`)

Fill in the template with what was established during Steps 0–4:
- Populate user stories with P1/P2/P3 from the narrowed direction
- Set measurable success criteria (numbers, not adjectives)
- Leave `[NEEDS CLARIFICATION]` for any unresolved flags

```
// spec.md is the living artifact — plan and cook will reference it.
// The brainstorm report is exploration narrative — context only.
```

Also write `plans/.current-brainstorm.md` with:
```
slug: {slug}
spec: plans/{slug}/spec.md
report: plans/reports/YYMMDD-{slug}-brainstorm.md
date: {YYYY-MM-DD}
```
This is the pointer file later steps read to locate the most recent brainstorm without relying on
in-context memory. See `../../references/artifact-layout.md` for the full artifact contract.

---

### Step 6 — Handoff

Ask via `ask the user directly`:

**"Spec written at `plans/{slug}/spec.md`. What next?"**
- `→ `plan` plans/{slug}/spec.md` — proceed to planning
- `Archive it` — keep the spec on disk, no plan yet
- `Keep exploring` — return to Step 1 or Step 3

When handing off to `plan`, note that the planning step must return a detailed summary of
every generated phase (`phase-*.md`) in the chat, including its objective, tasks, affected
files/modules, dependencies, tests or acceptance criteria, and risks. The brainstorm skill itself
still ends after writing the spec and does not generate implementation phases.

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
