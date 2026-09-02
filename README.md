# skills

Reusable agent workflows — brainstorm, spec, plan, implement, debug, CI/CD, frontend design,
problem solving — bundled as one portable skill collection, together with the subagent definitions
and the hook they depend on.

Written for [Antigravity](https://antigravity.google), and portable to Claude Code, Codex and
plain CLI agents. Nothing here needs a particular host to be useful: the reasoning is the product,
and the host-specific machinery is an integration point each workflow tells you how to replace.

```bash
npx github:nguyenquocan0101/skills install
```

That's it for a project already using Antigravity. It lands as a plugin — one folder at
`.agents/plugins/skills/` — and Antigravity picks up the skills, subagents and hook inside it on
your next session. Nothing you already have is modified.

---

## Install

### The short version

```bash
npx github:nguyenquocan0101/skills install      # this project
npx github:nguyenquocan0101/skills install -g   # every project
npx github:nguyenquocan0101/skills uninstall    # remove it again
```

Once published to npm:

```bash
npx @nguyenquocan0101/skills install
npm i -g @nguyenquocan0101/skills && skills install
```

The package is scoped because the bare name `skills` is already taken on npm by an unrelated
package — `npx skills` would fetch **that** one, so don't use it. The command the package installs
is still just `skills`.

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
  --force, -f       overwrite files that already exist
  --dry-run, -n     print what would happen, change nothing

skills uninstall  remove the plugin folder
skills list       print the available workflow names
```

Re-running is safe: existing files are left alone unless you pass `--force`.

### Other hosts

| Host | Layout | Lands in |
|---|---|---|
| Antigravity | plugin | `.agents/plugins/skills/` — or `~/.gemini/config/plugins/skills/` with `-g` |
| Antigravity, `--flat` | flat | `.agents/skills/`, `.agents/agents/`, `.agents/references/`, merged `.agents/hooks.json` |
| Claude Code | flat | `.claude/skills/`, `.claude/agents/`, `.claude/references/` — hook skipped, see `hooks/README.md` |
| Codex / plain CLI | flat | `.agents/skills/`, `.agents/agents/`, `.agents/references/` |

### By hand

```bash
git clone https://github.com/nguyenquocan0101/skills.git
cp -r skills .agents/plugins/skills
```

The repo layout *is* the plugin layout, so a plain copy works. Or skip installing altogether and
point your agent at `SKILL.md` in the repo root — it is a dispatcher that routes to the right
workflow, which is the natural way to use this with Codex or any agent you hand a directory to.

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
bin/install.js      the installer
```

### The workflows

| Workflow | Use it for |
|---|---|
| `brainstorm` | Explore alternatives before committing, then write a spec and a report |
| `spec` | Write the spec directly — the direction is already decided |
| `plan` | Research, split into phases, red-team the plan, hand off to `cook` |
| `cook` | Implement a plan phase by phase, with test and review gates |
| `fix` | Scout → diagnose → fix → review → finalize, for a specific bug |
| `cicd` | Scaffold or audit a Docker → registry → deploy pipeline; resolves the track, then defers |
| `cicd-dokploy` | The GitHub Actions → DockerHub → Dokploy/VPS standard |
| `cicd-azure-k8s` | The Azure DevOps → registry → Kubernetes standard |
| `frontend-mindset` | Product UI: app screens, dashboards, tables, forms — and reviewing them |
| `design-taste-frontend` | Marketing surfaces: landing pages, portfolios, campaign sites, redesigns |
| `minimalist-ui` | One specific look: warm monochrome, editorial, flat bento, document-style |
| `problem-solving` | The work is stuck and you need a different way to think about it |
| `skill-creator` | Create, validate, evaluate or improve a skill |

Typical chains: `brainstorm → plan → cook` for something novel, `spec → cook` when the direction
is settled, `fix` on its own for a bug. `problem-solving` cuts in whenever a workflow stalls.

### The subagents

`researcher`, `planner`, `plan-reviewer`, `scout`, `debugger`, `tester`, `code-reviewer`,
`project-manager`, `docs-manager`, `git-manager`. Splitting the work this way is the point: a
fresh context that only has to review is much harder to talk out of a finding than the same
context that just wrote the code. The four review-shaped roles are declared read-only so they
report rather than quietly fix.

Without subagent support nothing breaks — each workflow says to run the role inline instead.

### The shared contracts

| File | Covers |
|---|---|
| `references/artifact-layout.md` | Where `spec.md`, `plan.md`, phase files and `feature_list.json` live; project-root resolution; the `.skills.json` config |
| `references/review-rubric.md` | What the reviewer score means — severity levels, the arithmetic, the auto-approve gate |
| `references/host-compatibility.md` | Antigravity / Claude Code / Codex mapping for subagents, hooks, task lists and slash commands |

---

## Host support

`references/host-compatibility.md` has the full table. The parts worth knowing before you wire
anything:

**Antigravity supports exactly five hook events** — `PreToolUse`, `PostToolUse`, `PreInvocation`,
`PostInvocation`, `Stop` — configured in `.agents/hooks.json` (workspace) or
`~/.gemini/config/hooks.json` (global). There is no `PostEdit`, `SessionStart`,
`UserPromptSubmit`, `SubagentStop` or `PreCompact`, so a config ported from another agent will
carry entries that never fire and never warn. Only `matcher` on the two tool events does anything;
the other three ignore it. Hooks run synchronously inside the agent loop, so a slow hook is felt
as a slow agent.

The shipped hook uses `PostToolUse` to count what the agent edited and `PostInvocation` to trip a
threshold, which is what `cook` Step 3.S reads before code review. **Check the `PostToolUse`
matcher against your build's actual edit-tool names** before trusting it — see `hooks/README.md`.

Antigravity discovers skills at `.agents/skills/` and `~/.gemini/config/skills/`, subagents at
`.agents/agents/<name>.md` (spawned with `invoke_subagent`), rules at `.agents/rules/`, and all
four of those again inside any plugin under `.agents/plugins/<name>/` — which is why installing as
a plugin needs no merging into your own config.
Workflow markdown files are capped at 12,000 characters each — relevant if you wrap one of these
skills as a `/command`. Avoid colliding with the built-ins: `/plan`, `/boost`, `/goal`, `/learn`,
`/schedule`, `/browser`, `/btw`, `/grill-me`, `/teamwork-preview`.

---

## Development

```bash
node bin/install.js install --dry-run          # see the plan without writing
node bin/install.js install --target /tmp/x    # install into a scratch dir
node bin/install.js list                       # workflow names
python3 skills/skill-creator/scripts/quick_validate.py skills/plan
```

The repo root doubles as the plugin root, so `cp -r . <somewhere>/.agents/plugins/skills` is a
valid install and the installer is a convenience, not a build step. Keep it that way: anything
that only works after running the installer is a layout the plugin can't express.

Line endings are normalised to LF via `.gitattributes`; if you're on Windows, run
`git add --renormalize .` once after cloning rather than committing CRLF churn.

Every `SKILL.md` stays under 500 lines. When one grows past that, push the detail into its own
`references/` folder and leave a table in `SKILL.md` saying which file to read when — that is what
keeps a workflow from filling the context with rules for a task you aren't doing.

## License

MIT (see `LICENSE`), **except**:

- `skills/skill-creator/` — Apache-2.0, vendored from Anthropic, license text ships with it
- `skills/problem-solving/` — derived from [microsoft/amplifier](https://github.com/microsoft/amplifier), MIT

Read `NOTICE.md` before redistributing or publishing. Note that some hosts ship their own
`skill-creator`; two skills with the same name compete for the same triggers, so drop or rename
this copy if yours already has one.
