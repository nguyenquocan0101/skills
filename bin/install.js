#!/usr/bin/env node
/**
 * skills installer.
 *
 * Default mode drops the collection in as an Antigravity **plugin** — one folder at
 * `.agents/plugins/skills/`, which is exactly the layout of this repo. That matters
 * for two reasons: Antigravity discovers a plugin's `skills/`, `agents/` and `hooks.json`
 * automatically, and every relative link inside the workflows (`../../references/...`)
 * resolves unchanged, because the folder structure is identical to the source.
 *
 * It also means the install touches nothing you already have: no merging into your
 * `.agents/hooks.json`, no mixing skills' eleven skills into `.agents/skills/`
 * beside your own. Uninstall is `rm -rf .agents/plugins/skills`.
 *
 *   npx skills install
 *   npx skills install --global
 *   npx skills install --flat --host claude
 *   npx skills install --dry-run
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const SRC = path.resolve(__dirname, "..");
const PLUGIN_NAME = "skills";
const ALL_SKILLS = fs
  .readdirSync(path.join(SRC, "skills"), { withFileTypes: true })
  .filter((e) => e.isDirectory())
  .map((e) => e.name)
  .sort();

// ---------------------------------------------------------------- arguments

function parseArgs(argv) {
  const opts = {
    command: "install",
    host: null,
    global: false,
    target: null,
    skills: null,
    layout: null, // "plugin" | "flat"
    dryRun: false,
    force: false,
    hooks: true,
    python: null,
  };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "install" || a === "uninstall" || a === "list" || a === "help") opts.command = a;
    else if (a === "--host") opts.host = argv[++i];
    else if (a === "--target") opts.target = argv[++i];
    else if (a === "--skills") opts.skills = argv[++i].split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--plugin") opts.layout = "plugin";
    else if (a === "--flat") opts.layout = "flat";
    else if (a === "--global" || a === "-g") opts.global = true;
    else if (a === "--dry-run" || a === "-n") opts.dryRun = true;
    else if (a === "--force" || a === "-f") opts.force = true;
    else if (a === "--no-hooks") opts.hooks = false;
    else if (a === "--python") opts.python = argv[++i];
    else if (a === "--help" || a === "-h") opts.command = "help";
    else rest.push(a);
  }
  if (rest.length) fail(`unknown argument: ${rest[0]} (try --help)`);
  return opts;
}

const fail = (msg) => {
  console.error(`skills: ${msg}`);
  process.exit(1);
};

// ------------------------------------------------------------ host + layout

/**
 * Antigravity reads `.agents/` and still honours the older `.agent/` and `_agents/`
 * spellings. Reuse whichever the project already has rather than creating a second one
 * next to it — two customization roots is a confusing thing to leave behind.
 */
function agentsDir(cwd) {
  for (const name of [".agents", ".agent", "_agents"]) {
    if (fs.existsSync(path.join(cwd, name))) return path.join(cwd, name);
  }
  return path.join(cwd, ".agents");
}

function detectHost(cwd) {
  for (const name of [".agents", ".agent", "_agents"]) {
    if (fs.existsSync(path.join(cwd, name))) return "antigravity";
  }
  if (fs.existsSync(path.join(cwd, ".claude"))) return "claude";
  if (fs.existsSync(path.join(os.homedir(), ".gemini"))) return "antigravity";
  return "antigravity";
}

function resolveDest(host, opts, cwd) {
  const home = os.homedir();
  const layout = opts.layout || (host === "antigravity" ? "plugin" : "flat");

  if (opts.target) {
    const root = path.resolve(opts.target);
    return { layout, root, hooksAtRoot: layout === "plugin" };
  }

  if (host === "antigravity") {
    const base = opts.global ? path.join(home, ".gemini", "config") : agentsDir(cwd);
    return layout === "plugin"
      ? { layout, root: path.join(base, "plugins", PLUGIN_NAME), hooksAtRoot: true }
      : { layout, root: base, hooksAtRoot: false };
  }
  if (host === "claude") {
    const base = opts.global ? path.join(home, ".claude") : path.join(cwd, ".claude");
    return { layout: "flat", root: base, hooksAtRoot: false, noHooks: true };
  }
  if (host === "codex") {
    return { layout: "flat", root: agentsDir(cwd), hooksAtRoot: false, noHooks: true };
  }
  fail(`unknown host "${host}" — expected antigravity, claude or codex`);
}

// ----------------------------------------------------------------- copying

function collect(from, to, plan) {
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const src = path.join(from, entry.name);
    const dst = path.join(to, entry.name);
    if (entry.isDirectory()) collect(src, dst, plan);
    else if (entry.isFile()) plan.push([src, dst]);
  }
}

function apply(plan, opts) {
  let written = 0;
  let skipped = 0;
  for (const [src, dst] of plan) {
    if (fs.existsSync(dst) && !opts.force) {
      skipped++;
      continue;
    }
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.copyFileSync(src, dst);
    }
    written++;
  }
  return { written, skipped };
}

// -------------------------------------------------------------------- hooks

/**
 * Find an interpreter that actually exists on this machine. `python3` is the Linux and
 * macOS spelling; a default Windows install gives you `python` and the `py` launcher and
 * no `python3` at all, so a hook hardcoding `python3` fails silently there — the agent
 * loop swallows it and the simplify pass just never happens.
 */
function detectPython(explicit) {
  const candidates = explicit
    ? [explicit]
    : process.platform === "win32"
    ? ["py -3", "python", "python3"]
    : ["python3", "python"];
  for (const cand of candidates) {
    const parts = cand.split(" ");
    const r = spawnSync(parts[0], parts.slice(1).concat("--version"), {
      stdio: "ignore",
      shell: process.platform === "win32",
    });
    if (r.status === 0) return { cmd: cand, found: true };
  }
  return { cmd: candidates[0], found: false };
}

/** Rewrite the hook command so it points at the script this install actually placed. */
function hookConfig(dest, cwd, workspaceRelativeScript, python) {
  const cfg = JSON.parse(fs.readFileSync(path.join(SRC, "hooks", "hooks.json"), "utf8"));
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object") {
      if (typeof node.command === "string") {
        node.command = node.command.replace(
          /python3 \S*simplify_trigger\.py/,
          `${python} ${workspaceRelativeScript}`
        );
      }
      Object.values(node).forEach(walk);
    }
  };
  walk(cfg);
  return cfg;
}

function writeHooks(dest, opts, cwd) {
  if (dest.noHooks || !opts.hooks) return null;
  const python = detectPython(opts.python);

  const scriptAbs = path.join(dest.root, "hooks", "simplify_trigger.py");
  // Inside a workspace, a relative path keeps the config portable across machines.
  const rel = path.relative(cwd, scriptAbs).split(path.sep).join("/");
  const scriptRef = !rel.startsWith("..") && !path.isAbsolute(rel) ? rel : `"${scriptAbs}"`;
  const incoming = hookConfig(dest, cwd, scriptRef, python.cmd);

  // Plugin layout: the plugin owns its own hooks.json, so nothing of yours is touched.
  const target = dest.hooksAtRoot
    ? path.join(dest.root, "hooks.json")
    : path.join(dest.root, "hooks.json");

  let current = {};
  const existed = fs.existsSync(target);
  if (existed && !dest.hooksAtRoot) {
    try {
      current = JSON.parse(fs.readFileSync(target, "utf8"));
    } catch (e) {
      return { status: "unparseable", target };
    }
    for (const key of Object.keys(incoming)) {
      if (current[key] && !opts.force) return { status: "already-present", target, key };
    }
  }
  if (!opts.dryRun) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(Object.assign(current, incoming), null, 2) + "\n", "utf8");
  }
  return { status: existed && !dest.hooksAtRoot ? "merged" : "written", target, python };
}

// ---------------------------------------------------------------- commands

function help() {
  console.log(`skills — install agent workflows into your project

  npx skills install [options]
  npx skills uninstall
  npx skills list

Options
  --host <name>     antigravity | claude | codex   (default: auto-detect)
  --global, -g      install for every project instead of this one
  --plugin          install as one plugin folder      (default on Antigravity)
  --flat            spread into skills/ agents/ references/ instead
  --target <dir>    explicit install root, overriding --host/--global
  --skills a,b,c    only these workflows (default: all)
  --no-hooks        skip the simplify hook
  --python <cmd>    interpreter for the hook (default: detected)
  --force, -f       overwrite files that already exist
  --dry-run, -n     print what would happen, change nothing

Default install (Antigravity, this project)

  .agents/plugins/skills/
    plugin.json      skills/       agents/
    hooks.json       hooks/        references/

  One folder. Antigravity discovers the skills, subagents and hook inside a plugin
  automatically, nothing of yours is modified, and uninstalling is deleting it.
`);
}

function uninstall(opts, cwd) {
  const host = opts.host || detectHost(cwd);
  const dest = resolveDest(host, opts, cwd);
  if (dest.layout !== "plugin") {
    fail("uninstall only handles the plugin layout — remove the copied files by hand for --flat");
  }
  if (!fs.existsSync(dest.root)) {
    console.log(`skills: nothing installed at ${dest.root}`);
    return;
  }
  if (!opts.dryRun) fs.rmSync(dest.root, { recursive: true, force: true });
  console.log(`skills: ${opts.dryRun ? "would remove" : "removed"} ${dest.root}`);
}

function install(opts, cwd) {
  const host = opts.host || detectHost(cwd);
  const dest = resolveDest(host, opts, cwd);
  const skills = opts.skills || ALL_SKILLS;
  for (const s of skills) {
    if (!ALL_SKILLS.includes(s)) fail(`no such workflow "${s}" — run \`npx skills list\``);
  }

  const plan = [];
  for (const s of skills) collect(path.join(SRC, "skills", s), path.join(dest.root, "skills", s), plan);
  collect(path.join(SRC, "references"), path.join(dest.root, "references"), plan);
  collect(path.join(SRC, "agents"), path.join(dest.root, "agents"), plan);
  if (!dest.noHooks && opts.hooks) {
    collect(path.join(SRC, "hooks"), path.join(dest.root, "hooks"), plan);
  }
  if (dest.layout === "plugin") {
    plan.push([path.join(SRC, "plugin.json"), path.join(dest.root, "plugin.json")]);
    plan.push([path.join(SRC, "SKILL.md"), path.join(dest.root, "SKILL.md")]);
    plan.push([path.join(SRC, "README.md"), path.join(dest.root, "README.md")]);
    plan.push([path.join(SRC, "LICENSE"), path.join(dest.root, "LICENSE")]);
    plan.push([path.join(SRC, "NOTICE.md"), path.join(dest.root, "NOTICE.md")]);
  }

  const { written, skipped } = apply(plan, opts);
  const hooks = writeHooks(dest, opts, cwd);

  const verb = opts.dryRun ? "would install" : "installed";
  console.log(`skills: ${verb} ${skills.length} workflow(s) -> ${dest.root}`);
  console.log(`  host ${host}, ${dest.layout} layout`);
  console.log(
    `  ${written} file(s) ${opts.dryRun ? "to write" : "written"}` +
      (skipped ? `, ${skipped} left alone (already there — --force to overwrite)` : "")
  );

  if (hooks) {
    if (hooks.status === "already-present") console.log(`  hooks.json: "${hooks.key}" already configured, left alone`);
    else if (hooks.status === "unparseable") console.log(`  hooks.json: your existing file is not valid JSON — not touched`);
    else console.log(`  hooks.json: ${hooks.status} at ${hooks.target}`);
    if (hooks.python) {
      if (hooks.python.found) console.log(`  python: "${hooks.python.cmd}" (detected)`);
      else
        console.log(
          `  python: none found on PATH — hook commands left as "${hooks.python.cmd}". ` +
            `Install Python or rerun with --python <command>, or the simplify hook will never fire.`
        );
    }
    console.log(`  verify the PostToolUse matcher against your build's edit-tool names (hooks/README.md)`);
  } else if (host === "claude") {
    console.log(`  hooks: skipped — Claude Code has no PostInvocation event (hooks/README.md has the Stop-based wiring)`);
  }

  if (!opts.dryRun) {
    console.log(`\nStart a new agent session so the host re-scans its customizations.`);
    if (dest.layout === "plugin") console.log("Uninstall with: skills uninstall (or rerun this installer with the uninstall command)");
  }
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cwd = process.cwd();
  if (opts.command === "help") return help();
  if (opts.command === "list") return console.log(ALL_SKILLS.join("\n"));
  if (opts.command === "uninstall") return uninstall(opts, cwd);
  return install(opts, cwd);
}

main();
