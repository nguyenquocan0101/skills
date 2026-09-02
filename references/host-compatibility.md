# Host compatibility

These workflows are Markdown-first on purpose: the reasoning is the product, and the host-specific
machinery (subagents, hooks, task lists, slash commands) is an integration point, not a
prerequisite. When something named here isn't available, do the equivalent step inline, keep the
same artifacts, tests and gates, and say in one line which fallback you used. Silently skipping a
verification gate is the one failure mode that matters.

## What the workflows ask for, and where it lives per host

| Workflow asks for | Antigravity | Claude Code | Codex / plain CLI |
|---|---|---|---|
| A skill (`SKILL.md`) | `<workspace>/.agents/skills/<name>/`, `~/.gemini/config/skills/<name>/`, or `<plugin>/skills/<name>/` | `.claude/skills/<name>/` | read the file directly |
| A named subagent (`researcher`, `tester`, ...) | `.agents/agents/<name>.md`, `~/.gemini/config/agents/<name>.md`, or `<plugin>/agents/`, spawned with `invoke_subagent` | `.claude/agents/<name>.md`, spawned with the Task tool | no subagents — run the role inline in sequence |
| A lifecycle hook | `.agents/hooks.json`, or a plugin's own `hooks.json` (see below) | `.claude/settings.json` `hooks` | none — do the check inline |
| A whole bundle | `.agents/plugins/<name>/` with `plugin.json` + `skills/`, `agents/`, `hooks.json`, `rules/` | — | — |
| A task / todo list | the agent's own plan + task artifacts | `TodoWrite` | a `- [ ]` checklist written into `plan.md` |
| A slash command | a workflow markdown file under `.agents/`, invoked as `/name` | `.claude/commands/<name>.md` | just name the skill in the prompt |
| Ask the user a question | ask in the chat turn and wait | `AskUserQuestion` | ask in the chat turn and wait |

Subagent definitions for the ten roles these workflows reference ship in `../agents/`. Copy that
folder to `.agents/agents/` (Antigravity) or `.claude/agents/` (Claude Code). Without them, the
roles still work — run each one inline, in the same order, and keep its output section.

## Antigravity: hooks

Antigravity supports exactly **five** hook events. There is no `PostEdit`, `SessionStart`,
`UserPromptSubmit`, `SubagentStop` or `PreCompact` — if you have ported a config from another
agent, those entries are inert.

| Event | Fires | Matcher | Useful output |
|---|---|---|---|
| `PreToolUse` | before a tool runs | regex on tool name | `decision`: `allow` / `deny` / `ask` / `force_ask` / `deny_unless_prior_grant`, plus `reason`, `permissionOverrides` |
| `PostToolUse` | after a tool completes | regex on tool name | `{}` — side effects only |
| `PreInvocation` | before the model is called | ignored | `injectSteps` |
| `PostInvocation` | after each model invocation | ignored | `injectSteps`, `terminationBehavior`: `force_continue` / `terminate` |
| `Stop` | when execution terminates | ignored | `decision`: `continue`, plus `reason` |

Config file, workspace first then global:

- `<workspace>/.agents/hooks.json`
- `~/.gemini/config/hooks.json`
- plugin hooks: `.agents/plugins/<plugin>/hooks.json`, `~/.gemini/config/plugins/<plugin>/hooks.json`

The plugin path is the one this collection uses when installed normally, because a plugin's
`hooks.json` is read as its own file — your workspace config is never merged into or overwritten.

Shape — note that `PreToolUse` / `PostToolUse` wrap their handlers in a `matcher` object while the
other three take handler entries directly:

```json
{
  "my-hooks": {
    "enabled": true,
    "PreToolUse":  [{ "matcher": "run_command", "hooks": [{ "type": "command", "command": "./h.sh", "timeout": 30 }] }],
    "PostToolUse": [{ "matcher": "edit_file|write_file", "hooks": [{ "type": "command", "command": "./h.sh" }] }],
    "PreInvocation":  [{ "type": "command", "command": "./h.sh" }],
    "PostInvocation": [{ "type": "command", "command": "./h.sh" }],
    "Stop":           [{ "type": "command", "command": "./h.sh" }]
  }
}
```

Every hook receives JSON on stdin carrying `conversationId`, `workspacePaths`, `transcriptPath`,
`artifactDirectoryPath` and `modelName`, plus event-specific fields (`toolCall` and `stepIdx` for
tool events, `invocationNum` for invocation events, `terminationReason` and `fullyIdle` for
`Stop`). Three things to design around:

- **The event name is not in the payload.** Pass it yourself as a command-line argument if one
  script serves several events.
- **Hooks run synchronously inside the agent loop.** A slow hook is felt as a slow agent. Default
  timeout is 30 seconds; keep handlers well under it.
- **Only `command` handlers exist.** There is no inline-script or HTTP handler type.

`../hooks/` in this collection ships a working example: the simplify trigger `cook` Step 3.S reads.

## Antigravity: everything else worth knowing here

- Skills are discovered at `<workspace>/.agents/skills/` and `~/.gemini/config/skills/`; the older
  `.agent/` and `_agents/` spellings of the customization root still resolve. `description` is the
  trigger and is required; `name` is optional and defaults to the folder name, so keep folder and
  `name` identical.
- **Plugins are the cleanest unit of distribution.** A folder under `.agents/plugins/<name>/` (or
  `~/.gemini/config/plugins/<name>/`) with a `plugin.json` is scanned for `skills/`, `agents/`,
  `rules/`, `hooks.json` and `mcp_config.json`. Everything stays in one directory that doesn't mix
  with the user's own customizations, and removing it removes the whole bundle.
- Subagent frontmatter: `name` and `description` are required; `tools`, `mainAgent`, `subagent`,
  `model`, `commandExecutionPolicy` (default `sandbox`), `mcpServers` and `skills`/`plugins` are
  optional. `tools` takes an array of the host's tool names — leave it out rather than guess, since
  an unrecognised name is worse than the default.
- Nested skill folders (a `SKILL.md` inside another skill's directory) are not a documented
  discovery path. `problem-solving`'s techniques are therefore addressed as reference files by
  relative path from its own `SKILL.md`, not as separately discovered skills.
- Rules live in `.agents/rules/` and `~/.gemini/GEMINI.md`, and workflow markdown files are capped
  at **12,000 characters each**. Skills have no documented cap, but a workflow that wraps one of
  these skills has to stay under it — another reason the long skills here push detail into
  `references/`.
- `/plan`, `/boost`, `/goal`, `/learn`, `/schedule`, `/browser`, `/btw`, `/grill-me` and
  `/teamwork-preview` are built-in slash commands. Don't define a workflow that collides with one.
