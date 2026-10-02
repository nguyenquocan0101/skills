# Collision-Zone Thinking

## Overview

Revolutionary insights come from forcing unrelated concepts to collide. Treat X like Y and see what emerges.

**Core principle:** Deliberate metaphor-mixing generates novel solutions.

## Quick Reference

| Stuck On | Try Treating As | Might Discover |
|----------|-----------------|----------------|
| Code organization | DNA/genetics | Mutation testing, evolutionary algorithms |
| Service architecture | Lego bricks | Composable microservices, plug-and-play |
| Data management | Water flow | Streaming, data lakes, flow-based systems |
| Request handling | Postal mail | Message queues, async processing |
| Error handling | Circuit breakers | Fault isolation, graceful degradation |
| Authorization | Border control | Zero-trust, least privilege, audit logs |
| Caching | Human memory | Forgetting curves, tiered memory (L1/L2/L3) |

## Process

1. **Pick two unrelated concepts** from different domains
2. **Force combination**: "What if we treated [A] like [B]?"
3. **Explore emergent properties**: What new capabilities appear?
4. **Test boundaries**: Where does the metaphor break?
5. **Extract insight**: What did we learn?

## Example Collision

**Problem:** Complex distributed system with cascading failures

**Collision:** "What if we treated services like electrical circuits?"

**Emergent properties:**
- Circuit breakers (disconnect on overload)
- Fuses (one-time failure protection)
- Ground faults (error isolation)
- Load balancing (current distribution)

**Where it works:** Preventing cascade failures
**Where it breaks:** Circuits don't have retry logic
**Insight gained:** Failure isolation patterns from electrical engineering

## Best Source Domains for Collisions

- Physics (thermodynamics, electrical, fluid dynamics)
- Biology (evolution, immune system, neural networks)
- Economics (supply/demand, markets, incentives)
- Psychology (cognitive load, memory, attention)
- Urban planning (traffic flow, zoning, infrastructure)

## Red Flags You Need This

- "I've tried everything in this domain"
- Solutions feel incremental, not breakthrough
- Stuck in conventional thinking
- Need innovation, not optimization

## Remember

- Wild combinations often yield best insights
- Test metaphor boundaries rigorously
- Document even failed collisions (they teach)
- The goal is insight extraction, not perfect metaphor

---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
