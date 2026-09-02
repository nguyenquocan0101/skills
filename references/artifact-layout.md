# Artifact layout — the contract `brainstorm`, `spec`, `plan` and `cook` share

Every workflow in this collection reads and writes the same files. When one of them invents its
own path the chain silently breaks: `plan` looks for a spec that `brainstorm` wrote somewhere
else, `cook` looks for a plan `plan` never put there. So the paths below are fixed, and any skill
that needs a new artifact adds it here rather than inventing a variant.

## Directory shape

```
<project root>/
  .skills.json          <- optional project config + root marker (see below)
  feature_list.json       <- phase-level state, written by plan, updated by cook
  plans/
    .current-brainstorm.md      <- pointer to the most recent brainstorm
    reports/
      YYMMDD-{slug}-brainstorm.md
    {slug}/
      spec.md             <- brainstorm or spec writes this
      plan.md             <- plan writes this (all modes except --two)
      plan-a.md           <- --two only, merged into plan.md after the user picks
      plan-b.md           <- --two only
      phase-01-{name}.md
      phase-02-{name}.md
      scratch-tests.json  <- cook's keep/discard ledger for generated test files
```

`{slug}` is a short kebab-case name derived from the feature — `export-csv`, `oauth-login`. It is
chosen once, by whichever skill creates the directory first, and never re-derived afterwards.
There is **no date prefix on the plan directory**; dates live inside the files and on the
brainstorm report filename, where they don't have to be guessed by a later skill.

## Resolving the project root

`feature_list.json` lives at the project root, not inside `plans/{slug}/`, because one project can
have several plans and the state is shared. Resolve the root in this order and stop at the first
hit:

1. The nearest ancestor directory containing `.skills.json`.
2. The git repository root (`git rev-parse --show-toplevel`).
3. The current working directory.

Say which rule fired the first time you resolve it (`project root: /repo (git root)`), so the user
can correct you before state gets written to the wrong place.

## `.skills.json` (optional)

You never need this file — rules 2 and 3 above cover most projects. Add it when the project root
isn't the git root (monorepo package, nested workspace) or when you want non-default thresholds:

```json
{
  "root": true,
  "simplify": { "totalLoc": 400, "fileCount": 8, "singleFileLoc": 200 }
}
```

- `root` — marks this directory as the project root for rule 1.
- `simplify` — thresholds the simplify hook uses (see `../hooks/README.md`). Omitted keys fall
  back to the values shown above.

Older projects may carry `.bbskills.json` or `.ck.json` with the same shape. Treat both as
aliases and prefer `.skills.json` when more than one is present.

## `feature_list.json`

One entry per **phase**, keyed by the phase filename without `.md` — `phase-01-auth-api`. Phase
IDs, not story IDs, are the tracking key, because a phase is the unit `cook` actually executes.

```json
[
  {
    "id": "phase-01-auth-api",
    "title": "Auth API",
    "status": "not_started",
    "evidence": "",
    "user_visible_behavior": "",
    "verification_command": "",
    "notes": "",
    "priority": "P1",
    "blocked_by": []
  }
]
```

`status` moves `not_started` -> `active` -> `passing` (or `passing-unverified` when cooked with
`--fast`). `blocked_by` is user-managed — no skill populates it automatically. `priority` is
omitted entirely when no spec was loaded.

Writes are read-modify-write: re-read the file immediately before writing, so two phases finishing
close together don't clobber each other.
