# Antigravity-Specific Instructions

> Added for this collection (not part of Anthropic's original skill) — see `../../../NOTICE.md`.

On Antigravity (IDE, 2.0 or the `agy` CLI) the core loop is the same — draft → test → review →
improve — with these differences:

- **Where skills live.** Write the skill to `<workspace>/.agents/skills/<name>/` for one project,
  `~/.gemini/config/skills/<name>/` for every project, or a plugin's `skills/<name>/`. Only
  `description` is required in the frontmatter; `name` defaults to the folder name, so keep the two
  identical, lowercase and hyphenated. A skill inside a plugin is invoked as
  `/<plugin>:<skill>`; a standalone one as `/<skill>`.
- **Running test cases.** Subagents exist (`invoke_subagent`), so the parallel with-skill /
  baseline runs work. Spawn one subagent per test case with the skill path in its prompt, and save
  outputs into the iteration directories exactly as above.
- **Reviewing results.** There is usually a browser, but no guarantee the eval server's port is
  reachable from it; generate the viewer with `--static <output_path>` and open the HTML file.
- **Description optimization and benchmarking need `claude -p`,** which does not exist on
  Antigravity. Skip `run_loop.py`, `run_eval.py` and `improve_description.py`. Tune the description
  by hand instead: write 8–10 should-trigger and should-not-trigger prompts, try each in a fresh
  session, and adjust the trigger words that misfired.
- **Validation and packaging work unchanged** — `scripts/quick_validate.py` and
  `scripts/package_skill.py` only need Python. On Windows the interpreter is usually `py -3` or
  `python`, not `python3`.
- **Workflows vs skills.** A workflow file under `.agents/workflows/` is capped at 12,000
  characters; a skill is not. If you wrap a skill as a workflow, keep the workflow a thin pointer.
