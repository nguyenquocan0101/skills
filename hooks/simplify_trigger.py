#!/usr/bin/env python3
"""Simplify trigger — the hook behind `cook` Step 3.S.

Accumulates how much code the agent has edited during a run and, once the change gets big
enough to be worth a second look, drops a trigger file that `cook` reads before code review.

Wired as an Antigravity hook (see hooks.json). The event name is NOT in the payload, so it
arrives as argv[1]:

    simplify_trigger.py post_tool_use     <- accumulate edited files
    simplify_trigger.py post_invocation   <- evaluate thresholds, write trigger
    simplify_trigger.py stop              <- clear state for the next run

Contract with the host: read JSON on stdin, write JSON on stdout, exit 0. Anything else can
stall the agent loop, so every failure path here still prints valid JSON.
"""
import json, os, sys, pathlib

STATE_DIR = ".skills"
STATE_FILE = "simplify-state.json"
TRIGGER_FILE = "simplify-trigger.json"
DEFAULTS = {"totalLoc": 400, "fileCount": 8, "singleFileLoc": 200}
CODE_EXT = {".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java", ".cs",
            ".rb", ".php", ".kt", ".swift", ".c", ".h", ".cc", ".cpp", ".vue", ".svelte"}


def emit(obj=None):
    json.dump(obj or {}, sys.stdout)
    sys.stdout.write("\n")
    sys.exit(0)


def workspace(payload):
    paths = payload.get("workspacePaths") or []
    return pathlib.Path(paths[0]) if paths else pathlib.Path.cwd()


def thresholds(root):
    """`.skills.json` wins; `.bbskills.json` and `.ck.json` are legacy aliases. Missing keys keep defaults."""
    values = dict(DEFAULTS)
    for name in (".skills.json", ".bbskills.json", ".ck.json"):
        cfg = root / name
        if not cfg.is_file():
            continue
        try:
            values.update(json.loads(cfg.read_text(encoding="utf-8")).get("simplify") or {})
        except Exception:
            pass
        break
    return values


def load(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def save(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2), encoding="utf-8")


# Argument names that carry the edited file, compared case- and underscore-insensitively.
# Antigravity's own edit tools (write_to_file, replace_file_content, multi_replace_file_content)
# use `TargetFile`; the rest cover other hosts and older builds.
PATH_KEYS = {"targetfile", "path", "filepath", "absolutepath", "uri", "file"}


def edited_paths(tool_call):
    """Pull file paths out of a tool call without assuming one host's argument names."""
    args = (tool_call or {}).get("args") or {}
    if not isinstance(args, dict):
        return []
    found = []
    for key, value in args.items():
        norm = key.replace("_", "").lower()
        if norm in PATH_KEYS and isinstance(value, str) and value.strip():
            found.append(value[len("file://"):] if value.startswith("file://") else value)
        elif norm == "files" and isinstance(value, list):
            found += [f for f in value if isinstance(f, str) and f.strip()]
    return found


def main():
    event = (sys.argv[1] if len(sys.argv) > 1 else "").lower()
    try:
        payload = json.load(sys.stdin)
    except Exception:
        emit()

    root = workspace(payload)
    state_path = root / STATE_DIR / STATE_FILE

    if event == "stop":
        # Only Stop clears the accumulator. PreInvocation fires before *every* model call, so
        # clearing there would reset the count mid-run and the threshold would never be reached.
        try:
            state_path.unlink()
        except Exception:
            pass
        emit()

    if event == "post_tool_use":
        if payload.get("error"):
            emit()  # a failed edit changed nothing
        state = load(state_path)
        files = state.get("files") or {}
        for raw in edited_paths(payload.get("toolCall")):
            target = pathlib.Path(raw)
            if not target.is_absolute():
                target = root / target
            if target.suffix.lower() not in CODE_EXT or not target.is_file():
                continue
            try:
                loc = sum(1 for line in target.open(encoding="utf-8", errors="ignore") if line.strip())
            except Exception:
                continue
            files[str(target)] = loc
        state["files"] = files
        save(state_path, state)
        emit()

    if event == "post_invocation":
        state = load(state_path)
        files = state.get("files") or {}
        # Fire once per run. PostInvocation runs after every model call, and the accumulator only
        # resets on Stop, so without this the step would be re-injected on every call after the
        # threshold - and re-created right after cook deletes the trigger file.
        if not files or state.get("triggered"):
            emit()
        limits = thresholds(root)
        total = sum(files.values())
        biggest = max(files.items(), key=lambda kv: kv[1], default=("", 0))
        reasons = []
        if total >= limits["totalLoc"]:
            reasons.append(f"{total} LOC touched (threshold {limits['totalLoc']})")
        if len(files) >= limits["fileCount"]:
            reasons.append(f"{len(files)} files touched (threshold {limits['fileCount']})")
        if biggest[1] >= limits["singleFileLoc"]:
            reasons.append(f"{os.path.basename(biggest[0])} is {biggest[1]} LOC "
                           f"(threshold {limits['singleFileLoc']})")
        if not reasons:
            emit()
        save(root / STATE_DIR / TRIGGER_FILE, {
            "reasons": reasons,
            "files": sorted(files),
            "totalLoc": total,
            "conversationId": payload.get("conversationId", ""),
        })
        state["triggered"] = True
        save(state_path, state)
        # Each injected step must be an object: {"ephemeralMessage": ...}, {"userMessage": ...}
        # or {"toolCall": ...}. A bare string is not a valid step.
        emit({"injectSteps": [{"ephemeralMessage":
            "SIMPLIFY_TRIGGERED - this change crossed a simplify threshold ("
            + "; ".join(reasons)
            + f"). Before code review, run the simplify pass described in cook Step 3.S over the "
              f"files listed in {STATE_DIR}/{TRIGGER_FILE}, then delete that file."
        }]})

    emit()


if __name__ == "__main__":
    main()
