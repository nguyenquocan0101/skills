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

**Check the matcher.** `PostToolUse` matchers are regexes over *tool names*. Antigravity's own
file-editing tools are `write_to_file`, `replace_file_content` and `multi_replace_file_content`,
and all three carry the edited path in `args.TargetFile`; the shipped matcher lists those plus
the spellings other hosts use. If your build names them differently, read the real names from
your `transcript.jsonl` (its path arrives in every hook payload as `transcriptPath`) and widen the
matcher, or set it to `".*"` and let the script filter — it ignores anything that isn't an
existing code file.

**Verify it actually fires.** Hook failures are silent, so check once after installing: let the
agent edit any code file, then look for `.skills/simplify-state.json` at the workspace root.
Missing means the hook never ran — in order of likelihood: the interpreter name (`python3` does
not exist on a default Windows install; the installer detects `py -3`/`python`), the script path
(relative paths resolve against the directory the agent was launched from, so launch from the
workspace root or rerun the installer with an absolute `--target`), the matcher, or a build that
does not dispatch tool events (see below).

**Known limits, as of mid-2026:**

- Tool events are build-dependent. A capture on Antigravity CLI 1.2.7 saw only `PreInvocation`,
  `PostInvocation` and `Stop` fire; `PostToolUse` is confirmed firing on CLI 1.2.14. On a build
  without it the trigger file is simply never written, and `cook` Step 3.S skips — the same as a
  run that never crossed a threshold.
- Edits made **inside a subagent** (`tester`, `debugger`) do not fire the parent's tool hooks,
  so they are not counted. The trigger measures what the main agent wrote.
- The trigger fires **once per run**: after it injects its step it stays quiet until `Stop`
  clears the state, so deleting the trigger file after the simplify pass does not re-create it.

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
