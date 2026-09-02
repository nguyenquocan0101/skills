# Review rubric — what "score >= 9.5 with 0 CRITICAL" actually means

`cook` and `fix` both gate on a reviewer score. A number without a rubric is just a vibe with a
decimal point, so here is the scale both skills mean when they say 9.5.

## Severity levels

Every finding gets exactly one:

| Level | Meaning | Example |
|---|---|---|
| `CRITICAL` | Ships a security hole, data loss, or a broken primary path | Unparameterised SQL from user input; migration with no rollback; auth check removed |
| `HIGH` | Correct today, wrong under a foreseeable condition | Unhandled error path; N+1 on a list that will grow; race on shared state |
| `MEDIUM` | Works, but will cost someone an hour later | Duplicated logic, missing test for a branch, unclear naming in a hot path |
| `LOW` | Taste and polish | Formatting, comment wording, minor ordering |

## Score

Start at 10 and subtract:

- `CRITICAL` — 4.0 each
- `HIGH` — 1.0 each
- `MEDIUM` — 0.3 each
- `LOW` — 0.05 each

Floor at 0. Report the arithmetic, not just the total, so the user can disagree with a specific
deduction rather than with the number:

```
Score: 9.4 = 10 - (0 x CRITICAL) - (0 x HIGH) - (2 x MEDIUM 0.3) - (0 x LOW)
  MEDIUM  auth.ts:88    duplicated token-refresh logic, also in session.ts:41
  MEDIUM  auth.test.ts  missing case for expired-but-valid-signature token
```

## Gates

- **Auto-approve** (Standard mode): score >= 9.5 **and** zero `CRITICAL`. One `HIGH` already puts
  you at 9.0, so in practice auto-approve means "nothing above MEDIUM".
- **`--hard`**: never auto-approve. The score is advisory; a human approves.
- **`--fast`**: no review runs at all, so no score exists. Don't invent one.

A single `CRITICAL` blocks regardless of the total — 4.0 is chosen so that one critical finding
cannot be outweighed by an otherwise clean diff.

## Cycles

Up to 3 fix/re-review cycles, each using a **different approach** from the previous one. Repeating
the same fix and hoping is how a session burns twenty minutes. On cycle 4, stop and escalate to the
user with the exact error and what the three approaches were.
