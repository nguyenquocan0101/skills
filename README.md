# skills

A mini harness of agent workflows — **brainstorm → spec → plan → cook → fix**, with edge-case
discovery, recaps, CI/CD, frontend design and problem solving alongside — bundled as one portable
skill collection together with the subagents and the hook they depend on.

Written for [Antigravity](https://antigravity.google), and portable to Claude Code, Codex and
plain CLI agents. Nothing here needs a particular host to be useful: the reasoning is the product,
and the host-specific machinery is an integration point each workflow tells you how to replace.

```bash
npx github:nguyenquocan0101/skills install
```

That's it for a project already using Antigravity. It lands as a plugin — one folder at
`.agents/plugins/skills/` — and Antigravity picks up the skills, subagents and hook inside it on
your next session. Nothing you already have is modified.

```
  ███████╗██╗  ██╗██╗██╗     ██╗     ███████╗
  ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝
  agent workflows · brainstorm → plan → cook → fix  v0.5.0

  ✔ Detecting host  antigravity (auto)
  • plugin layout › .agents/plugins/skills

  Workflows (13)
  ✔ brainstorm            Explore and debate solutions before writing code
  ✔ cook                  Implement a planned feature phase by phase
  ✔ fix                   Fix a bug using Scout → Diagnose → Fix → Verify → R…
  …
  ╭─ Installed ──────────────────────────────────────────────────────────╮
  │ 13 workflows • 82 file(s) written                                    │
  │ try    /skills:brainstorm  /skills:plan  /skills:fix                 │
  ╰──────────────────────────────────────────────────────────────────────╯
```

---

## What's new in 0.5.0

- **`scenario`** — edge cases across 12 dimensions, turned into test anchors. `plan` runs it
  automatically for `--tdd` or high-risk work; `planner`, `plan-reviewer` and `tester` consume it.
- **`sumup`** — a short, evidence-first recap at the end of `cook` and `fix`.
- **`fix` has a root-cause gate** — reproduce first, state symptom / repro / root cause with
  `file:line` / why now / blast radius before any edit, then a regression test that must fail on
  the pre-fix code.
- **`cicd` is one skill** — the Dokploy and Azure-K8s standards are now its two reference files.
- **The simplify hook actually fires on Antigravity** — it reads `TargetFile`, matches
  `multi_replace_file_content`, emits valid `injectSteps`, and triggers once per run.
- **Review subagents are read-only by allowlist** (`scout`, `plan-reviewer`, `code-reviewer`).
- **Animated installer** — banner, spinners, progress bar, summary box; plain output in CI.

---

## Install

### From GitHub

```bash
npx github:nguyenquocan0101/skills install      # this project only
npx github:nguyenquocan0101/skills install -g   # every project
```

`-g` installs into `~/.gemini/config/plugins/skills/`, which Antigravity reads for every
workspace — so nothing appears inside the project, by design. Drop `-g` to get
`.agents/plugins/skills/` in the project instead. Pick one; installing both makes every skill
show up twice.

A note on `npx` and a wrong repo name: it prints **nothing at all** and exits, which reads as a
successful no-op rather than an error. If you see no banner, the repo path is wrong.

### From a local clone

Nothing to publish, nothing to fetch — and the only method that works offline. Run it **from the
project you want the skills in**:

```bash
git clone https://github.com/nguyenquocan0101/skills.git
node skills/bin/install.js install
```

Already have the repo on disk? Point at it directly — the path syntax depends on your shell:

| Shell | Command |
|---|---|
| Git Bash / MINGW64 | `node /c/src/skills/bin/install.js install` |
| cmd | `node C:\src\skills\bin\install.js install` |
| PowerShell | `node C:\src\skills\bin\install.js install` |
| macOS / Linux | `node ~/src/skills/bin/install.js install` |

### Verify the install

Four checks, about two minutes, worth doing once per machine:

1. **The plugin parses.** `agy plugin validate` reads `plugin.json` from the *current* directory,
   so change into the plugin folder first — running it from the project root fails with
   `missing plugin.json`:

   | Shell | Command |
   |---|---|
   | Git Bash | `cd .agents/plugins/skills && agy plugin validate` |
   | cmd | `cd /d .agents\plugins\skills && agy plugin validate` |
   | PowerShell | `cd .agents\plugins\skills; agy plugin validate` |

   For a global install the folder is `~/.gemini/config/plugins/skills` (cmd:
   `cd /d %USERPROFILE%\.gemini\config\plugins\skills`).
2. **The skills are listed.** In a new session, type `/skills:` — all 13 workflows should
   autocomplete.
3. **Subagents have tools.** Ask the agent to spawn `scout` to grep for something. If it reports
   it has no tools, see `agents/README.md`.
4. **The hook fires.** Let the agent edit any code file, then look for
   `.skills/simplify-state.json` at the workspace root. Missing → `hooks/README.md`.

### Uninstall

```bash
npx github:nguyenquocan0101/skills uninstall      # project install
npx github:nguyenquocan0101/skills uninstall -g   # global install
```

Pass the same `-g` you installed with, or it looks in the wrong place and reports nothing to
remove.

### Where it goes

```
.agents/plugins/skills/
├── plugin.json
├── hooks.json          the simplify hook, read from here — your hooks.json is untouched
├── skills/             the thirteen workflows
├── agents/             the ten subagent definitions
├── hooks/              the hook script
└── references/         shared contracts the workflows link to
```

Antigravity scans `.agents/plugins/` (and `~/.gemini/config/plugins/` globally) and loads a
plugin's `skills/`, `agents/`, `rules/` and `hooks.json` automatically. Installing as a plugin
rather than scattering files means three things: your own `.agents/skills/` and `.agents/hooks.json`
are never touched, the folder layout is identical to this repo so every relative link inside the
workflows keeps resolving, and uninstalling is deleting one directory.

If your project uses the older `.agent/` or `_agents/` customization root, the installer reuses
whichever one is already there instead of creating a second one beside it.

The hook is a Python script, and the installer writes whichever interpreter it finds into
`hooks.json` — `python3` on Linux and macOS, `py -3` or `python` on Windows, which is where a
hardcoded `python3` would otherwise fail silently. If no interpreter is on PATH the install still
succeeds and says so; the hook simply never fires until you install Python or rerun with
`--python <command>`.

### Options

```
skills install [options]

  --host <name>     antigravity | claude | codex   (default: auto-detect)
  --global, -g      install for every project instead of this one
  --plugin          one plugin folder               (default on Antigravity)
  --flat            spread into skills/ agents/ references/ instead
  --target <dir>    explicit install root, overriding --host/--global
  --skills a,b,c    only these workflows (default: all)
  --no-hooks        skip the simplify hook
  --python <cmd>    interpreter for the hook (default: detected)
  --force, -f       overwrite files that already exist
  --dry-run, -n     print what would happen, change nothing
  --no-anim         plain output, no animation (also SKILLS_NO_ANIM=1; NO_COLOR=1 drops colour)

skills uninstall  remove the plugin folder
skills list       print the workflows with a one-line description
```

In a terminal the installer draws a banner, a spinner per step, a live progress bar over the
workflows and a summary box with the next steps. Piped into a file, run in CI, or with
`--no-anim`, the same information comes out as plain lines — no escape codes, no delays. On an
old Windows console without Unicode support it falls back to ASCII glyphs.

Re-running is safe: existing files are left alone unless you pass `--force`.

### Other hosts

| Host | Layout | Lands in |
|---|---|---|
| Antigravity | plugin | `.agents/plugins/skills/` — or `~/.gemini/config/plugins/skills/` with `-g` |
| Antigravity, `--flat` | flat | `.agents/skills/`, `.agents/agents/`, `.agents/references/`, merged `.agents/hooks.json` |
| Claude Code | flat | `.claude/skills/`, `.claude/agents/`, `.claude/references/` — hook skipped (see `hooks/README.md`); the agents' tool allowlist is mapped to `Read, Grep, Glob, Bash` |
| Codex / plain CLI | flat | `.agents/skills/`, `.agents/agents/`, `.agents/references/` |

### By hand

```bash
git clone https://github.com/nguyenquocan0101/skills.git
cp -r skills .agents/plugins/skills
```

The repo layout *is* the plugin layout, so a plain copy works — but the hook command in
`hooks.json` says `python3`, which doesn't exist on a default Windows install; edit it to
`py -3` or use the installer. Or skip installing altogether and point your agent at `SKILL.md` in
the repo root — it is a dispatcher that routes to the right workflow, which is the natural way to
use this with Codex or any agent you hand a directory to.

---

## Using it

Skills trigger on their own from what you ask ("plan this", "fix this bug", "what edge cases
should we test?"), or explicitly. In Antigravity a plugin's skills are namespaced, so they never
collide with built-in commands or with another plugin's `fix`:

```
/skills:brainstorm   /skills:spec      /skills:scenario   /skills:plan    /skills:cook
/skills:fix          /skills:sumup     /skills:cicd       /skills:problem-solving   …
```

How the pieces chain:

```
 novel feature   brainstorm ──► spec.md ──► plan ──► cook ──► sumup
                                             │  ▲       │
                         --tdd / high-risk ──┘  │       └─ tester writes the scenario
                                     scenario ──┘          anchors red first
 settled idea    spec ──► plan ──► cook
 a bug           fix   (scout → reproduce → root-cause gate → fix → regression test → review → sumup)
 stuck anywhere  problem-solving, then back to the workflow you were in
```

Artifacts live in fixed places (`plans/{slug}/spec.md`, `scenarios.md`, `plan.md`, phase files,
`feature_list.json` at the project root) so each workflow finds what the previous one wrote —
see `references/artifact-layout.md`.

---

## What's inside

```
plugin.json         Antigravity plugin manifest
hooks.json          plugin-level hook config (the simplify trigger)
SKILL.md            dispatcher — routes to one workflow, for repo-level use
skills/             the thirteen workflows
agents/             ten subagent definitions the workflows spawn
hooks/              the simplify trigger script
references/         shared contracts every workflow agrees on
bin/install.js      the installer   (bin/ui.js: its zero-dependency terminal UI)
```

### The workflows

| Workflow | Use it for |
|---|---|
| `brainstorm` | Explore alternatives before committing, then write a spec and a report |
| `spec` | Write the spec directly — the direction is already decided |
| `scenario` | Edge cases across 12 dimensions, turned into test anchors before code is written |
| `plan` | Research, edge cases, split into phases, red-team the plan, hand off to `cook` |
| `cook` | Implement a plan phase by phase, with test, simplify and review gates |
| `fix` | Scout → reproduce → root-cause gate → fix → regression test → review, for a specific bug |
| `sumup` | Recap finished work: outcome, what was verified and what wasn't, decisions, what is left |
| `cicd` | Scaffold or audit a Docker → registry → deploy pipeline, on the Dokploy or Azure-K8s track |
| `frontend-mindset` | Product UI: app screens, dashboards, tables, forms — and reviewing them |
| `design-taste-frontend` | Marketing surfaces: landing pages, portfolios, campaign sites, redesigns |
| `minimalist-ui` | One specific look: warm monochrome, editorial, flat bento, document-style |
| `problem-solving` | The work is stuck and you need a different way to think about it |
| `skill-creator` | Create, validate, evaluate or improve a skill |

### The subagents

`researcher`, `planner`, `plan-reviewer`, `scout`, `debugger`, `tester`, `code-reviewer`,
`project-manager`, `docs-manager`, `git-manager`. Splitting the work this way is the point: a
fresh context that only has to review is much harder to talk out of a finding than the same
context that just wrote the code. `scout`, `plan-reviewer` and `code-reviewer` carry a
`tools` allowlist with no file-editing tool, so they report rather than quietly fix; `researcher`
is read-only by instruction (see `agents/README.md` for why, and a one-minute check for your build).

Subagents run in Antigravity's sandbox by default, which has no network beyond the domains you
allowed — if `tester` needs `npm ci` or a database, `agents/README.md` says what to change.
Without subagent support nothing breaks — each workflow says to run the role inline instead.

### The shared contracts

| File | Covers |
|---|---|
| `references/artifact-layout.md` | Where `spec.md`, `scenarios.md`, `plan.md`, phase files and `feature_list.json` live; project-root resolution; the `.skills.json` config |
| `references/review-rubric.md` | What the reviewer score means — severity levels, the arithmetic, the auto-approve gate |
| `references/host-compatibility.md` | Antigravity / Claude Code / Codex mapping for subagents, hooks, task lists and slash commands, plus known Antigravity limits |

---

## Host support

`references/host-compatibility.md` has the full table. The parts worth knowing before you wire
anything:

**Antigravity supports exactly five hook events** — `PreToolUse`, `PostToolUse`, `PreInvocation`,
`PostInvocation`, `Stop` — configured in `.agents/hooks.json` (workspace), `~/.gemini/config/hooks.json`
(global) or a plugin's own `hooks.json`. There is no `PostEdit`, `SessionStart`,
`UserPromptSubmit`, `SubagentStop` or `PreCompact`, so a config ported from another agent will
carry entries that never fire and never warn. Only `matcher` on the two tool events does anything;
the other three ignore it. Hooks run synchronously inside the agent loop, so a slow hook is felt
as a slow agent.

The shipped hook uses `PostToolUse` to count what the agent edited — Antigravity's edit tools are
`write_to_file`, `replace_file_content` and `multi_replace_file_content`, with the path in
`args.TargetFile` — and `PostInvocation` to trip a threshold, which `cook` Step 3.S reads before
code review. Tool events depend on the build (confirmed on CLI 1.2.14) and edits made inside a
subagent don't fire the parent's hooks; `hooks/README.md` has the details and the check.

Antigravity discovers skills at `.agents/skills/` and `~/.gemini/config/skills/`, subagents at
`.agents/agents/<name>.md` (spawned with `invoke_subagent`), rules at `.agents/rules/`, and all
of those again inside any plugin under `.agents/plugins/<name>/` — which is why installing as a
plugin needs no merging into your own config. Workflow markdown files are capped at 12,000
characters each — relevant if you wrap one of these skills as a `/command`.

---

## Development

```bash
node bin/install.js install --dry-run          # see the plan without writing
node bin/install.js install --target /tmp/x    # install into a scratch dir
node bin/install.js list                       # workflows with one-line descriptions
for s in skills/*/; do python3 skills/skill-creator/scripts/quick_validate.py "$s"; done
```

The repo root doubles as the plugin root, so `cp -r . <somewhere>/.agents/plugins/skills` is a
valid install and the installer is a convenience, not a build step. Keep it that way: anything
that only works after running the installer is a layout the plugin can't express.

Line endings are normalised to LF via `.gitattributes`; if you're on Windows, run
`git add --renormalize .` once after cloning rather than committing CRLF churn.

Every `SKILL.md` stays under 500 lines, and no skill contains another `SKILL.md`. When one grows
past that, push the detail into its own `references/` folder and leave a table in `SKILL.md`
saying which file to read when — that is what keeps a workflow from filling the context with
rules for a task you aren't doing.

## License

MIT (see `LICENSE`), **except**:

- `skills/skill-creator/` — Apache-2.0, vendored from Anthropic (with an added Antigravity
  section, marked as modified); license text ships with it
- `skills/problem-solving/` — derived from [microsoft/amplifier](https://github.com/microsoft/amplifier), MIT
- `skills/scenario/` and `skills/sumup/` — adapted from AgentKit (MIT); `scenario` traces back to
  [uditgoenka/autoresearch](https://github.com/uditgoenka/autoresearch), MIT

Read `NOTICE.md` before redistributing or publishing. Note that some hosts ship their own
`skill-creator`; two skills with the same name compete for the same triggers, so drop or rename
this copy if yours already has one.
