# hooks — the simplify trigger, wired for Antigravity

`cook` Step 3.S asks whether the change it just made is big enough to deserve a simplification
pass before code review. Something has to answer that question, and asking the model to
self-assess mid-flow is exactly the moment it is least objective. A hook counts instead.

## What it does

`simplify_trigger.py` accumulates the code files the agent edits during a run. After each model
invocation it compares the running total against three thresholds and, if any is crossed, writes
`.skills/simplify-trigger.json` at the workspace root and injects a step telling the agent to
run the simplify pass. `cook` Step 3.S reads that file, does the pass, and deletes it.

Defaults, overridable via the `simplify` block in `.skills.json` (see
`../references/artifact-layout.md`):

| Threshold | Default | Crossed when |
|---|---|---|
| `totalLoc` | 400 | total non-blank lines across all edited code files |
| `fileCount` | 8 | number of distinct code files edited |
| `singleFileLoc` | 200 | any single edited file is this long |

## Install (Antigravity)

If you installed skills as a plugin, this is already done: a plugin's own `hooks.json` at
`.agents/plugins/skills/hooks.json` is one of the places Antigravity reads hooks from, so the
hook is live and your workspace `hooks.json` was never touched.

Standalone:

```bash
mkdir -p .agents/hooks
cp hooks/simplify_trigger.py .agents/hooks/
```

then merge `hooks.json` into `<workspace>/.agents/hooks.json` (or `~/.gemini/config/hooks.json`
for every workspace), adjusting the script path to match. Workspace config takes precedence over
global, and plugin hooks load alongside both.

**Check the matcher.** `PostToolUse` matchers are regexes over *tool names*, and the exact names
of the file-editing tools differ between Antigravity releases and surfaces. The shipped matcher
covers the common spellings; confirm against the tool names in your own `transcript.jsonl`
(its path arrives in every hook payload as `transcriptPath`) and widen it to `".*"` if you would
rather filter inside the script.

## Install (other hosts)

- **Claude Code** — same script, wired through `hooks` in `.claude/settings.json`: `PostToolUse`
  matching `Edit|Write|MultiEdit`, and `Stop` for cleanup. Claude Code has no `PostInvocation`,
  so evaluate thresholds on `Stop` instead, or call `simplify_trigger.py post_invocation` from
  the `PostToolUse` handler and accept that it evaluates more often.
- **No hook support at all** — `cook` Step 3.S degrades cleanly: with no trigger file present it
  skips silently, which is the same behaviour as a run that never crossed a threshold. If you
  want the check anyway, run `git diff --numstat` at the end of a phase and judge by eye.

## Contract notes

Antigravity runs hooks **synchronously inside the agent loop**, so a slow hook is felt as a slow
agent. This one only stats and line-counts files that were just written, and it exits early on
every failure path — a hook that crashes or hangs is worse than a hook that does nothing. It
always prints valid JSON on stdout and exits 0.

The event name is not part of the hook payload, so it is passed as the first command-line
argument. Keep that argument if you rewire the commands.
