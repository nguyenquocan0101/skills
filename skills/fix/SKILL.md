---
name: fix
description: "Fix a bug using Scout → Diagnose → Fix → Verify → Review → Finalize, with a root-cause gate before any edit and a regression test after it. Use when the user pastes an error message, stack trace, or test failure, or says \"fix this bug\", \"something's broken\", \"tests are failing\", \"I'm getting an error\". Modes (pick one): --fast (trivial errors — lint, type, build — skip scout, regression test and review), --hard (mandatory review, no auto-approve)."
---

# fix — Structured Bug-Fix Pipeline

Modes — mutually exclusive, pick one (default = Standard: auto-approve if score ≥ 9.5 with 0 CRITICAL):
- **`--fast`** — trivial issues (lint, type errors, build errors); skip scout, regression test, review, docs
- **`--hard`** — mandatory review, no auto-approve

The rule the whole workflow exists to enforce: **no edit until the root cause is stated with
evidence, and no "done" until something that failed before the fix passes after it.** A fix that
makes the error disappear without an explanation is a fix that gets reopened.

---

### Step 0 — Prerequisites + Scope

If no error message, stack trace, or concrete description provided:
→ "Paste the error message or stack trace." Wait before continuing.

```
# Scope:
#   Description: {what the user said}
#   Quick?      → {yes/no — reason}
#   Mode:       {Standard | Fast | Hard}
```

If `--fast` or clearly a build/compiler/lint error: skip Step 1 → go directly to Step 2.

---

### Step 1 — Scout + Reproduce

Spawn **`scout`** with the bug description:
- Greps for error patterns in logs and stack traces
- Reads affected source files and maps dependencies
- Checks recent git changes for related commits
- **Reproduces** the failure: runs the failing test, command or request and captures the output
  verbatim

```
// Evidence:
//   Error pattern: NullReferenceException at auth.ts:45
//   Affected files: auth.ts, session.ts
//   Recent change: commit a3f2b1 modified auth.ts (2h ago)
//   Repro: npm test -- auth.spec.ts  → 1 failed (verbatim output attached)
```

If it cannot be reproduced, say so and ask for the missing piece (input, environment, logs)
before diagnosing. A fix for a failure you never saw cannot be verified.

---

### Step 2 — Diagnose + Root-Cause Gate

Spawn **`debugger`** with the scout evidence. It forms 2–3 hypotheses and confirms or rejects each
by observation, not by reasoning alone.

**Gate — before any edit**, state each of these in one concrete line:

```
# Root cause gate:
#   Symptom:     {exact error / failing assertion, verbatim}
#   Repro:       {minimal command or steps}
#   Expected:    {what should happen}   Actual: {what happens}
#   Root cause:  {the defect, with file:line — not the symptom}
#   Why now:     {commit, data shape, dependency or env change that exposed it}
#   Blast radius:{other callers or sites sharing the cause, or none}
```

If any line is a guess ("probably", "something with…"), the gate fails: go back to Step 1 for more
evidence or ask the user — never edit on a guess. `--fast` still fills the gate, usually in one
line, since a lint or type error states its own cause.

Then the debugger applies the **minimal** fix at the root cause, plus every blast-radius site that
shares it.

```
// Hypothesis A: null check missing in auth.ts:45 → CONFIRMED ✓ (req.user undefined on expired session)
// Hypothesis B: race condition in session init   → REJECTED ✗ (fails single-threaded too)
//
// Fix applied: auth.ts:45 | Severity: HIGH | Scope: 1 file
```

---

### Step 3 — Verify

**`--fast`**: rerun the exact command from the gate (build, lint, type-check). Green → Step 5.

**Standard / `--hard`**: spawn **`tester`** to
1. write a **regression test** that reproduces the bug — it must fail on the pre-fix code
   (stash only the fixed source files — `git stash push -- <fixed files>` — run the test,
   confirm red, `git stash pop`). A test that never failed proves nothing.
2. run it and the full suite against the fix → 100% pass.

If the project has no test setup, rerun the Step 1 reproduction instead and say plainly that no
regression test exists.

Still failing → back to Step 2 with the new evidence. Each retry uses a **different** hypothesis or
approach; on the 4th failure stop and escalate:

```
[ESCALATION] Fix not converging
Symptom:  {verbatim}
Tried:    {approach 1} | {approach 2} | {approach 3}
Question: {what you need from the user — often whether the design itself is the bug}
```

---

### Step 4 — Review

**`--fast`**: skip → Step 5.

Spawn **`code-reviewer`**: correctness, security, regressions, code quality — with the gate
block and the regression test as context, so it reviews the fix against the stated cause.

**Standard**: auto-approve if score ≥ 9.5 with 0 CRITICAL — scale and severity definitions in
`../../references/review-rubric.md`. Up to 3 fix/re-review cycles (different approach each), then escalate.
**`--hard`**: no auto-approve — human must explicitly approve before Step 5.

---

### Step 5 — Finalize (MANDATORY)

**`project-manager`** (skip `--fast`): sync plan progress if bug was tracked.
**`docs-manager`** (skip `--fast`): update docs if fix changes a public contract.
**`sumup`** (skip `--fast`): short recap — cause, fix, regression test, anything left open.
**`git-manager`** (always): conventional commit + ask to push.

```
// git-manager → fix(auth): add null guard on req.user before validate
//            → Push to remote? [y/N]
```

---

## Agents

| Agent / Skill     | Step | Modes |
|-------------------|------|-------|
| `scout`           | 1    | Standard, `--hard` (skip if `--fast`) |
| `debugger`        | 2    | All |
| `tester`          | 3    | Standard, `--hard` (`--fast` reruns the failing command instead) |
| `code-reviewer`   | 4    | Standard, `--hard` (skip for `--fast`) |
| `project-manager` | 5    | Standard, `--hard` (skip for `--fast`) |
| `docs-manager`    | 5    | Standard, `--hard` (skip for `--fast`) |
| `sumup` skill     | 5    | Standard, `--hard` (skip for `--fast`) |
| `git-manager`     | 5    | Always (mandatory) |

Definitions for these roles ship in `../../agents/` — copy them to `.agents/agents/`
(Antigravity) or `.claude/agents/` (Claude Code). Without subagent support, run each role inline
in the same order and keep its report section.

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
