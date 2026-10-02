---
name: problem-solving
description: "Creative problem-solving techniques for breaking through stuck points - includes collision-zone thinking, inversion, pattern recognition, scale testing and simplification. Use when the work is stuck: the same fix keeps failing, complexity keeps growing, every option looks bad, or the user says \"we're stuck\", \"I'm going in circles\", \"there must be a simpler way\"."
---

# Problem-Solving Skills

A collection of techniques for breaking through stuck points and finding elegant solutions.

Each technique is a reference file under `references/`. This file is the entry point: it routes,
and the technique file does the work. Read only the one you need.

## Available techniques

### When Stuck (Dispatch)
**Location:** `references/when-stuck.md`

Start here when stuck. Matches your stuck-type to the right technique. Quick dispatch table for routing to the appropriate sub-skill.

### Collision-Zone Thinking
**Location:** `references/collision-zone-thinking.md`

Force unrelated concepts together to discover emergent properties. "What if we treated X like Y?" Revolutionary insights come from deliberate metaphor-mixing.

### Inversion Exercise
**Location:** `references/inversion-exercise.md`

Flip every assumption and see what still works. "What if the opposite were true?" Exposes hidden constraints and alternative approaches.

### Meta-Pattern Recognition
**Location:** `references/meta-pattern-recognition.md`

Spot patterns appearing in 3+ domains to find universal principles. Extract abstract forms that apply across domains.

### Scale Game
**Location:** `references/scale-game.md`

Test at extremes (1000x bigger/smaller) to expose fundamental truths. What breaks? What survives? Extremes reveal what normal scales hide.

### Simplification Cascades
**Location:** `references/simplification-cascades.md`

Find one insight that eliminates multiple components. "If this is true, we don't need X, Y, or Z." Look for unifying principles.

## When to Use

| How You're Stuck | Use This |
|------------------|----------|
| **Don't know which technique** | when-stuck |
| **Need breakthrough innovation** | collision-zone-thinking |
| **Forced by assumptions** | inversion-exercise |
| **Same issue in different places** | meta-pattern-recognition |
| **Unsure about production scale** | scale-game |
| **Complexity spiraling** | simplification-cascades |

## Quick Reference

```
Conventional solutions inadequate?  → collision-zone-thinking
"This must be done this way"?       → inversion-exercise
Same pattern 3+ places?             → meta-pattern-recognition
Will it work at scale?              → scale-game
Same thing implemented 5+ ways?     → simplification-cascades
```

## Core Philosophy

> "One powerful abstraction > ten clever hacks"

These techniques help you find the elegant solution that makes complexity unnecessary, rather than managing complexity through brute force.

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
