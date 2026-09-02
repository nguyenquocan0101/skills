# agents — the ten roles the workflows spawn

`plan`, `cook` and `fix` delegate to named roles: a researcher investigates, a planner writes the
plan files, a reviewer red-teams it, a tester drives the suite green. Splitting the work this way
is the point — a fresh context that only has to review is much harder to talk out of a finding
than the same context that just wrote the code.

Until now these names appeared in the workflows with nothing behind them. These files are the
definitions.

## Install

Installing skills as an Antigravity plugin already puts these where they belong —
`.agents/plugins/skills/agents/` is one of the three places Antigravity looks for subagent
definitions, alongside `.agents/agents/` and `~/.gemini/config/agents/`. Nothing else to do.

Standalone, without the plugin: `mkdir -p .agents/agents && cp agents/*.md .agents/agents/`.
The parent agent spawns them with `invoke_subagent`; each starts with a clean context window.

**Claude Code** — `mkdir -p .claude/agents && cp agents/*.md .claude/agents/`, spawned with the
Task tool.

Each file declares `mainAgent: false` and `subagent: true`, so these roles are delegation targets
rather than agents you pick from a menu — ten extra entries in the main-agent list would be noise.
No `tools` list is declared: tool names differ between hosts and builds, and a wrong name is worse
than the host default. If you want to hard-limit one, add `tools: [...]` with your build's actual
tool names.

**No subagent support** — nothing breaks. Run each role inline, in the order the workflow gives,
and keep its report section. You lose the fresh-context independence, which matters most for
`plan-reviewer` and `code-reviewer`; treat their findings with that in mind.

## The roles

| Agent | Used by | Does |
|---|---|---|
| `researcher` | plan Step 1 | Investigates one approach, reports options and costs |
| `planner` | plan Step 2 | Writes `plan.md` and the phase files to disk |
| `plan-reviewer` | plan Step 3 | Red-teams the plan before implementation starts |
| `scout` | fix Step 1 | Gathers bug evidence without theorising |
| `debugger` | fix Step 2, cook Step 3 | Hypothesis → confirm → minimal root-cause fix |
| `tester` | cook Step 3 | Writes tests, runs the full suite, reports files created |
| `code-reviewer` | cook Step 4, fix Step 3 | Scored review against `../references/review-rubric.md` |
| `project-manager` | cook Step 5, fix Step 4 | Makes plan files match what was actually built |
| `docs-manager` | cook Step 5, fix Step 4 | Updates docs only where a contract moved |
| `git-manager` | cook, fix, cicd | Conventional commit, asks before pushing |

`researcher`, `scout`, `plan-reviewer` and `code-reviewer` are told, in their prompts, to report
rather than edit. That separation is the point: a reviewer that fixes what it finds is a reviewer
whose findings never reach you. If your host lets you enforce it with a `tools` allowlist, do —
the instruction is the fallback, not the ideal.
