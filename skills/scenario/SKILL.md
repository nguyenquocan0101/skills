---
name: scenario
description: "Find the edge cases a feature will meet before it is built: decompose it across 12 dimensions (user types, input extremes, timing, scale, state, environment, failures, authorization, data integrity, integrations, compliance, business rules) and turn the dangerous ones into test anchors. Use before implementing anything stateful, multi-user, money- or auth-related, when the user asks \"what could go wrong\", \"what edge cases\", \"what should we test\", or when `plan` runs with --tdd or classifies a change as high-risk. Flags: --saturation (keep going until no new cases appear), --focus DIMENSION."
---

# scenario — Edge Cases Before Code

The cheapest bug is the one written down as a test before the code exists. This skill produces
that list: concrete situations, each with a severity and the behaviour that should happen, so
`plan` can put the dangerous ones in phase acceptance criteria and `tester` can write them red
first.

It reads and writes nothing but its own report. It does not implement, and it does not test.

## Input

A feature description, a `spec.md`, a `plan.md`/phase file, or source files. Read the actual
target; scenarios invented from the title alone are generic and get ignored.

## The 12 dimensions

| # | Dimension | Look for |
|---|---|---|
| 1 | User types | admin, guest, banned, brand-new, power user, bot/scraper |
| 2 | Input extremes | empty, null, max length, unicode, special chars, injection payloads |
| 3 | Timing | concurrent writes, races, timeouts, slow network, retry storms |
| 4 | Scale | 0 / 1 / 1M items, pagination boundary, cursor wrap |
| 5 | State transitions | first use, abort mid-flow, resume after crash, partial completion |
| 6 | Environment | low-end mobile, screen reader, other timezone/locale, proxy |
| 7 | Error cascades | DB down, API timeout, disk full, partial write, network partition |
| 8 | Authorization | expired token, wrong role, shared link, CSRF, privilege escalation |
| 9 | Data integrity | duplicates, orphans, encoding mismatch, migration during traffic |
| 10 | Integrations | webhook replay, API version drift, third-party outage |
| 11 | Compliance | deletion request, audit-log gap, retention, PII in logs |
| 12 | Business logic | zero/negative amounts, stacked discounts, refund after partial delivery, quota edges |

## Workflow

1. **Read the target** and name the actors, components and preconditions.
2. **Filter dimensions.** Mark which apply. Skip the rest *with the assumption behind each skip*.
   A skip whose assumption could break during this feature's life is a scenario, not a skip.
3. **Generate 3–5 concrete scenarios per kept dimension** — a specific trigger and an expected
   outcome, not a category ("two users submit the same invoice within 100 ms", not "concurrency").
4. **Rate severity** on the same scale as `../../references/review-rubric.md`:

   | Level | Meaning |
   |---|---|
   | CRITICAL | data loss, security hole, auth bypass, silent corruption |
   | HIGH | broken for a subset of users, inconsistent data |
   | MEDIUM | degraded UX, recoverable error not surfaced |
   | LOW | cosmetic, non-blocking |

5. **Mark test anchors.** Every CRITICAL and HIGH row gets a one-line test idea. Those rows are what
   the rest of the pipeline consumes.

### `--saturation`

For high-risk work where one pass isn't enough: keep generating one scenario at a time, classify
each against what you already have — **new** (different dimension and trigger), **variant** (same
dimension, different actor/data/outcome), or **duplicate** (discard). Rotate dimensions after three
in a row from the same one; when stuck, try combining two dimensions, negating an assumption, or
amplifying a quantity 1000×. Stop after two consecutive rounds with nothing new, and say how many
rounds that took.

`--focus <dimension>` puts one dimension first; the rest still get the filter pass.

## Output

Write to `plans/{slug}/scenarios.md` when a plan directory exists (path contract in
`../../references/artifact-layout.md`); otherwise reply in chat. Use the user's language.

```markdown
# Scenarios: {target}

Dimensions analysed: {list}
Skipped: {dimension — assumption}, ...

| # | Dimension | Scenario | Severity | Expected behaviour | Test anchor |
|---|---|---|---|---|---|
| 1 | Authorization | Expired JWT calls PATCH /invoices/:id | CRITICAL | 401, no write, session invalidated | request with expired token → 401 and row unchanged |
| 2 | Timing | Two users approve the same invoice within 100 ms | HIGH | exactly one approval recorded | parallel approve → one 200, one 409 |
| 3 | Input extremes | Customer name of 0 chars | MEDIUM | 400 with field error | — |

Summary: {n} CRITICAL, {n} HIGH, {n} MEDIUM, {n} LOW across {k} dimensions
```

## How the pipeline uses it

| Consumer | What it takes |
|---|---|
| `plan` (Step 1.5) | CRITICAL/HIGH rows become phase acceptance criteria; with `--tdd`, the `### Tests to Write First` section |
| `cook --tdd` / `tester` | test anchors are the red tests written before implementation |
| `plan-reviewer` | rows with no phase covering them are a finding |

## Attribution

Adapted from AgentKit's `ak-scenario`, itself derived from `/autoresearch:scenario` in
[uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch) (MIT). Rewritten without
AgentKit CLI dependencies; see `../../NOTICE.md`.
