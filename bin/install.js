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
 * `.agents/hooks.json`, no mixing the thirteen skills into `.agents/skills/`
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
const ui = require("./ui");

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
    anim: true,
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
    else if (a === "--no-anim") opts.anim = false;
    else if (a === "--help" || a === "-h") opts.command = "help";
    else rest.push(a);
  }
  if (rest.length) fail(`unknown argument: ${rest[0]} (try --help)`);
  return opts;
}

const fail = (msg) => {
  ui.showCursor();
  console.error(`\n  ${ui.c.red(ui.G.fail)} skills: ${msg}\n`);
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
    return { layout, root, hooksAtRoot: layout === "plugin", noHooks: host !== "antigravity" };
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

function apply(plan, opts, transform) {
  let written = 0;
  let skipped = 0;
  for (const [src, dst] of plan) {
    if (fs.existsSync(dst) && !opts.force) {
      skipped++;
      continue;
    }
    if (!opts.dryRun) {
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      const changed = transform && transform(src, fs.readFileSync(src, "utf8"));
      if (typeof changed === "string") fs.writeFileSync(dst, changed, "utf8");
      else fs.copyFileSync(src, dst);
    }
    written++;
  }
  return { written, skipped };
}

/**
 * The agents declare Antigravity tool names (`view_file`, `grep_search`, `run_command`). Claude
 * Code reads `tools` too, and an allowlist of names it doesn't know leaves the agent with no tools
 * at all — so on that host the list is rewritten to Claude Code's read-only equivalents.
 */
function agentTransformFor(host) {
  if (host !== "claude") return null;
  return (src, text) =>
    src.endsWith(".md") ? text.replace(/^tools:\n(?:[ \t]+-[^\n]*\n)+/m, "tools: Read, Grep, Glob, Bash\n") : null;
}

/** First clause of a skill's description, for the one-line catalogue. */
function tagline(skill) {
  try {
    const text = fs.readFileSync(path.join(SRC, "skills", skill, "SKILL.md"), "utf8");
    const m = text.match(/^description:\s*"?(.*?)"?\s*$/m);
    if (!m) return "";
    // Shortest leading clause: stop at the first sentence end, colon, comma, dash or parenthesis.
    return m[1].replace(/\\"/g, '"').split(/(?<=[a-z)])\. |: |, | — | - | \(/)[0].replace(/\.$/, "");
  } catch (e) {
    return "";
  }
}

/** Inside the project, show the short relative path; elsewhere, abbreviate the home directory. */
function displayPath(p, cwd) {
  const rel = path.relative(cwd, p);
  if (rel && !rel.startsWith("..") && !path.isAbsolute(rel)) return rel.split(path.sep).join("/");
  const home = os.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length).split(path.sep).join("/") : p;
}

function pkgVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(SRC, "package.json"), "utf8")).version;
  } catch (e) {
    return "?";
  }
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

  npx github:nguyenquocan0101/skills install [options]
  npx github:nguyenquocan0101/skills uninstall [-g]
  npx github:nguyenquocan0101/skills list

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
  --no-anim         plain output, no animation (also: SKILLS_NO_ANIM=1, NO_COLOR=1)

Default install (Antigravity, this project)

  .agents/plugins/skills/
    plugin.json      skills/       agents/
    hooks.json       hooks/        references/

  One folder. Antigravity discovers the skills, subagents and hook inside a plugin
  automatically, nothing of yours is modified, and uninstalling is deleting it.
`);
}

function list() {
  const { c } = ui;
  ui.log();
  for (const s of ALL_SKILLS) ui.log(`  ${c.bold(s.padEnd(22))}${c.gray(tagline(s))}`);
  ui.log();
}

async function uninstall(opts, cwd) {
  const host = opts.host || detectHost(cwd);
  const dest = resolveDest(host, opts, cwd);
  if (dest.layout !== "plugin") {
    fail("uninstall only handles the plugin layout — remove the copied files by hand for --flat");
  }
  ui.log();
  if (!fs.existsSync(dest.root)) {
    ui.info(`nothing installed at ${dest.root}`);
    ui.log();
    return;
  }
  await ui.spin(
    `${opts.dryRun ? "Would remove" : "Removing"} ${displayPath(dest.root, cwd)}`,
    () => { if (!opts.dryRun) fs.rmSync(dest.root, { recursive: true, force: true }); },
    opts.dryRun ? "dry run" : "done"
  );
  ui.log();
}

async function install(opts, cwd) {
  const { c, G } = ui;
  await ui.banner(pkgVersion(), "agent workflows · brainstorm → plan → cook → fix");

  const host = await ui.spin("Detecting host", () => opts.host || detectHost(cwd), (h) => (opts.host ? h : `${h} (auto)`));
  const dest = resolveDest(host, opts, cwd);
  const skills = opts.skills || ALL_SKILLS;
  for (const s of skills) {
    if (!ALL_SKILLS.includes(s)) fail(`no such workflow "${s}" — run \`list\` to see them`);
  }
  const shown = displayPath(dest.root, cwd);
  ui.info(`${dest.layout} layout ${G.arrow} ${c.cyan(shown)}`);
  if (opts.dryRun) ui.note("dry run — nothing will be written");

  let written = 0;
  let skipped = 0;
  const tally = (r) => { written += r.written; skipped += r.skipped; return r; };
  const describe = (r) =>
    r.skipped && !r.written ? "already there" : `${r.written} file(s)` + (r.skipped ? `, ${r.skipped} kept` : "");

  ui.section(`Workflows (${skills.length})`);
  const bar = ui.progress(skills.length, "workflows");
  for (const s of skills) {
    const plan = [];
    collect(path.join(SRC, "skills", s), path.join(dest.root, "skills", s), plan);
    const r = tally(apply(plan, opts));
    await bar.row(r.written ? "ok" : "skip", s, tagline(s));
  }
  bar.end();

  ui.section("Support");
  await ui.spin("Subagents", () => {
    const plan = [];
    collect(path.join(SRC, "agents"), path.join(dest.root, "agents"), plan);
    return tally(apply(plan, opts, agentTransformFor(host)));
  }, (r) => describe(r) + (host === "claude" ? " · tools mapped to Read/Grep/Glob/Bash" : ""));

  await ui.spin("Shared references", () => {
    const plan = [];
    collect(path.join(SRC, "references"), path.join(dest.root, "references"), plan);
    return tally(apply(plan, opts));
  }, describe);

  if (dest.layout === "plugin") {
    await ui.spin("Plugin manifest", () => {
      const plan = ["plugin.json", "SKILL.md", "README.md", "LICENSE", "NOTICE.md"].map((f) => [
        path.join(SRC, f),
        path.join(dest.root, f),
      ]);
      return tally(apply(plan, opts));
    }, describe);
  }

  let hooks = null;
  if (!dest.noHooks && opts.hooks) {
    hooks = await ui.spin("Simplify hook", () => {
      const plan = [];
      collect(path.join(SRC, "hooks"), path.join(dest.root, "hooks"), plan);
      tally(apply(plan, opts));
      return writeHooks(dest, opts, cwd);
    }, (h) => {
      if (!h) return "skipped";
      if (h.status === "already-present") return `"${h.key}" already configured`;
      if (h.status === "unparseable") return "your hooks.json is not valid JSON — not touched";
      return `${h.status} · python: ${h.python.found ? h.python.cmd : "not found"}`;
    });
  }

  // ------------------------------------------------------------ summary
  const lines = [
    `${c.bold(String(skills.length))} workflows ${G.dot} ${c.bold(String(written))} file(s) ${opts.dryRun ? "to write" : "written"}` +
      (skipped ? ` ${G.dot} ${skipped} kept (--force to overwrite)` : ""),
    `${c.gray("where")}  ${shown}`,
  ];
  if (host === "antigravity" && dest.layout === "plugin") {
    lines.push(`${c.gray("try")}    /${PLUGIN_NAME}:brainstorm  /${PLUGIN_NAME}:plan  /${PLUGIN_NAME}:fix`);
  }
  if (!opts.dryRun) {
    lines.push(`${c.gray("next")}   start a new agent session so the host re-scans its customizations`);
    if (hooks && hooks.python && !hooks.python.found) {
      lines.push(`${c.yellow("hook")}   no Python on PATH — install it or rerun with --python <cmd>`);
    } else if (hooks) {
      lines.push(`${c.gray("check")}  after an edit, .skills/simplify-state.json should exist`);
    } else if (host === "claude") {
      lines.push(`${c.gray("hook")}   skipped on Claude Code — see hooks/README.md for Stop-based wiring`);
    }
    if (dest.layout === "plugin") lines.push(`${c.gray("remove")} rerun with the uninstall command${opts.global ? " -g" : ""}`);
  }
  ui.box(opts.dryRun ? "Dry run complete" : "Installed", lines, opts.dryRun ? "yellow" : "green");
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.anim) ui.disableAnimation();
  const cwd = process.cwd();
  if (opts.command === "help") return help();
  if (opts.command === "list") return list();
  if (opts.command === "uninstall") return uninstall(opts, cwd);
  return install(opts, cwd);
}

main().catch((err) => fail(err && err.message ? err.message : String(err)));
