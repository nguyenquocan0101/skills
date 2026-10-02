---
name: meta-pattern-recognition
description: "Spot patterns appearing in 3+ domains to find universal principles"
---

# Meta-Pattern Recognition

## Overview

When the same pattern appears in 3+ domains, it's probably a universal principle worth extracting.

**Core principle:** Find patterns in how patterns emerge.

## Quick Reference

| Pattern Appears In | Abstract Form | Where Else? |
|-------------------|---------------|-------------|
| CPU/DB/HTTP/DNS caching | Store frequently-accessed data closer | LLM prompt caching, CDN, browser cache |
| Layering (network/storage/compute) | Separate concerns into abstraction levels | Clean architecture, OS rings |
| Queuing (message/task/request) | Decouple producer from consumer with buffer | Event systems, async processing, print queues |
| Pooling (connection/thread/object) | Reuse expensive resources | Memory management, worker pools |
| Rate limiting (API/traffic/admission) | Bound resource consumption to prevent exhaustion | LLM token budgets, DB connection limits |

## Process

1. **Spot repetition** — See same shape in 3+ places
2. **Extract abstract form** — Describe it independent of any domain
3. **Identify variations** — How does it adapt per domain?
4. **Check applicability** — Where else might this pattern help?

## Example

**Pattern spotted:** Rate limiting in API throttling, traffic shaping, circuit breakers, admission control, connection pooling

**Abstract form:** Bound resource consumption to prevent exhaustion

**Variation points:** What resource, what limit, what happens when exceeded (reject / queue / degrade)

**New application:** LLM token budgets (same pattern — prevent context window exhaustion)

## Red Flags You're Missing Meta-Patterns

- "This problem is unique" (it probably isn't)
- Multiple teams independently solving "different" problems identically
- Reinventing wheels across domains
- "Haven't we done something like this?" (yes — find it)
- Writing the same logic in 3+ different places

## Remember

- 3+ domains = likely universal principle
- Abstract form reveals new applications
- Variations show adaptation points
- Universal patterns are battle-tested across contexts

---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
