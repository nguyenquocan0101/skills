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

**Tools.** `scout`, `plan-reviewer` and `code-reviewer` declare
`tools: [view_file, grep_search, run_command]` — the exact allowlist of the read-only auditor in
Antigravity's subagent docs — so they can read, search and run commands (`git diff`, the failing
test) but have no file-editing tool. `run_command` can still change files from a shell, so the
prompt rule stays as the second line of defence. The other seven roles declare no `tools` and get
the host default: tool names differ between Antigravity surfaces (the SDK, for one, calls them
`list_directory`/`edit_file`), and a wrong name is worse than the default. `researcher` stays
prompt-only read-only because it also needs the web tools, whose names vary the most.

**Check it once on your build.** Ask the agent to spawn `scout` with "list the files under
`skills/` and grep for `TargetFile`". If it reports nothing or says it has no tools, your build
treats an omitted or short `tools` list differently — add the editing tools your build names
(`write_to_file`, `replace_file_content`, `multi_replace_file_content`) to the roles that write,
or remove the allowlists.

**Sandbox.** Subagents default to `commandExecutionPolicy: sandbox`, which on the Default
permission preset has no network access beyond the domains you allowed for `read_url`. If
`tester` needs `npm ci`, a database or a test container, either allow those domains or add
`commandExecutionPolicy: auto` to `agents/tester.md`.

**No subagent support** — nothing breaks. Run each role inline, in the order the workflow gives,
and keep its report section. You lose the fresh-context independence, which matters most for
`plan-reviewer` and `code-reviewer`; treat their findings with that in mind.

## The roles

| Agent | Used by | Does |
|---|---|---|
| `researcher` | plan Step 1 | Investigates one approach, reports options and costs |
| `planner` | plan Step 2 | Writes `plan.md` and the phase files to disk |
| `plan-reviewer` | plan Step 3 | Red-teams the plan before implementation starts |
| `scout` | fix Step 1 | Gathers bug evidence and reproduces it, without theorising |
| `debugger` | fix Step 2, cook Step 3 | Hypothesis → confirm → minimal root-cause fix |
| `tester` | cook Step 3, fix Step 3 | Writes tests (and the bug's regression test), runs the full suite, reports files created |
| `code-reviewer` | cook Step 4, fix Step 4 | Scored review against `../references/review-rubric.md` |
| `project-manager` | cook Step 5, fix Step 5 | Makes plan files match what was actually built |
| `docs-manager` | cook Step 5, fix Step 5 | Updates docs only where a contract moved |
| `git-manager` | cook, fix, cicd | Conventional commit, asks before pushing |

`researcher`, `scout`, `plan-reviewer` and `code-reviewer` report rather than edit. That separation
is the point: a reviewer that fixes what it finds is a reviewer whose findings never reach you.
Three of them enforce it with a `tools` allowlist on Antigravity (see above); `researcher`, and
every role on hosts that ignore `tools`, relies on the instruction alone.
