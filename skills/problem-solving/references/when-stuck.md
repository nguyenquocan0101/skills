# When Stuck — Problem-Solving Dispatch

## Overview

Different stuck-types need different techniques. This skill helps you quickly identify which problem-solving skill to use.

**Core principle:** Match stuck-symptom to technique.

## Stuck-Type → Technique

| How You're Stuck | Use This Skill |
|------------------|----------------|
| **Complexity spiraling** — Same thing 5+ ways, growing special cases | `simplification-cascades.md` |
| **Need innovation** — Conventional solutions inadequate, can't find fitting approach | `collision-zone-thinking.md` |
| **Recurring patterns** — Same issue different places, reinventing wheels | `meta-pattern-recognition.md` |
| **Forced by assumptions** — "Must be done this way", can't question premise | `inversion-exercise.md` |
| **Scale uncertainty** — Will it work in production? Edge cases unclear? | `scale-game.md` |
| **Multiple independent problems** — Can parallelize investigation | Use Agent tool with parallel subagents |

## Process

1. **Identify stuck-type** — What symptom matches above?
2. **Load that skill** — Read the specific technique
3. **Apply technique** — Follow its process
4. **If still stuck** — Try different technique or combine

## Combining Techniques

Some problems need multiple techniques:

- **Simplification + Meta-pattern**: Find pattern, then simplify all instances
- **Collision + Inversion**: Force metaphor, then invert its assumptions
- **Scale + Simplification**: Extremes reveal what to eliminate

## Quick Dispatch

```
Same thing implemented 5+ ways?       → simplification-cascades
Can't find fitting approach?          → collision-zone-thinking
Same issue in 3+ different places?    → meta-pattern-recognition
"This must be done this way"?         → inversion-exercise
Will this survive production scale?   → scale-game
```

## Remember

- Match symptom to technique
- One technique at a time
- Combine if first doesn't work
- Document what you tried

---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
