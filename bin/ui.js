"use strict";
/**
 * Terminal presentation for the installer: banner, spinners, progress bar, summary box.
 *
 * Zero dependencies on purpose — `npx github:...` should not have to resolve a tree just to
 * print in colour. Everything degrades on its own:
 *   - not a TTY, CI, TERM=dumb, --no-anim or SKILLS_NO_ANIM  -> no animation, no cursor tricks
 *   - NO_COLOR (or not a TTY without FORCE_COLOR)             -> no colour
 *   - a legacy Windows console                                 -> ASCII instead of box/braille glyphs
 * so piping the installer into a log file yields plain, readable lines.
 */

const out = process.stdout;
const env = process.env;

const isTTY = !!out.isTTY;
const color =
  !("NO_COLOR" in env) && (env.FORCE_COLOR ? env.FORCE_COLOR !== "0" : isTTY && env.TERM !== "dumb");
let animate = isTTY && !env.CI && !("SKILLS_NO_ANIM" in env) && env.TERM !== "dumb";
const unicode =
  process.platform !== "win32" ||
  !!(env.WT_SESSION || env.TERM_PROGRAM || env.ConEmuANSI === "ON" || env.TERM || env.VSCODE_PID);
const truecolor =
  color && (/truecolor|24bit/i.test(env.COLORTERM || "") || !!env.WT_SESSION || env.TERM_PROGRAM === "vscode");

// ------------------------------------------------------------------ styling

const sgr = (open, close) => (s) => (color ? `\x1b[${open}m${s}\x1b[${close}m` : String(s));
const c = {
  bold: sgr(1, 22),
  dim: sgr(2, 22),
  red: sgr(31, 39),
  green: sgr(32, 39),
  yellow: sgr(33, 39),
  cyan: sgr(36, 39),
  magenta: sgr(35, 39),
  gray: sgr(90, 39),
};

const G = unicode
  ? { ok: "✔", skip: "↷", warn: "▲", fail: "✖", dot: "•", arrow: "›", full: "█", empty: "░",
      frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
      box: { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" } }
  : { ok: "+", skip: "=", warn: "!", fail: "x", dot: "*", arrow: ">", full: "#", empty: "-",
      frames: ["|", "/", "-", "\\"],
      box: { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" } };

const ANSI_RE = /\x1b\[[0-9;]*m/g;
const visible = (s) => String(s).replace(ANSI_RE, "").length;
const sleep = (ms) => (animate ? new Promise((r) => setTimeout(r, ms)) : Promise.resolve());
const width = () => Math.max(40, Math.min(out.columns || 80, 100));
const clip = (s, n) => (s.length > n ? s.slice(0, Math.max(0, n - 1)) + (unicode ? "…" : ".") : s);

// Two-stop gradient (cyan -> magenta), per character, for the banner.
function gradient(line, row, rows) {
  if (!color) return line;
  if (!truecolor) return (row < rows / 2 ? c.cyan : c.magenta)(line);
  const from = [34, 211, 238], to = [217, 70, 239];
  const chars = [...line];
  return (
    chars
      .map((ch, i) => {
        if (ch === " ") return ch;
        const t = Math.min(1, (i / Math.max(1, chars.length - 1)) * 0.75 + (row / rows) * 0.25);
        const [r, g, b] = from.map((v, k) => Math.round(v + (to[k] - v) * t));
        return `\x1b[38;2;${r};${g};${b}m${ch}`;
      })
      .join("") + "\x1b[39m"
  );
}

let cursorHidden = false;
function hideCursor() {
  if (animate && !cursorHidden) { out.write("\x1b[?25l"); cursorHidden = true; }
}
function showCursor() {
  if (cursorHidden) { out.write("\x1b[?25h"); cursorHidden = false; }
}
process.on("exit", showCursor);
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => { showCursor(); out.write("\n"); process.exit(130); });
}

const log = (s = "") => out.write(s + "\n");

// ------------------------------------------------------------------- pieces

const LOGO = [
  "███████╗██╗  ██╗██╗██╗     ██╗     ███████╗",
  "██╔════╝██║ ██╔╝██║██║     ██║     ██╔════╝",
  "███████╗█████╔╝ ██║██║     ██║     ███████╗",
  "╚════██║██╔═██╗ ██║██║     ██║     ╚════██║",
  "███████║██║  ██╗██║███████╗███████╗███████║",
  "╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚══════╝",
];

async function banner(version, tagline) {
  hideCursor();
  log();
  if (unicode && width() >= 50) {
    for (let i = 0; i < LOGO.length; i++) {
      log("  " + gradient(LOGO[i], i, LOGO.length));
      await sleep(35);
    }
  } else {
    log("  " + c.bold(c.cyan("== skills ==")));
  }
  log(`  ${c.dim(tagline)}  ${c.gray("v" + version)}`);
  log();
}

/** Run `fn` behind a spinner; the line resolves to a tick (or cross) with an optional detail. */
async function spin(label, fn, detail) {
  let i = 0;
  let timer = null;
  const draw = () => out.write(`\r\x1b[2K  ${c.cyan(G.frames[i++ % G.frames.length])} ${label}`);
  if (animate) { draw(); timer = setInterval(draw, 80); }
  const started = Date.now();
  try {
    const value = await fn();
    if (animate) await sleep(Math.max(0, 260 - (Date.now() - started)));
    if (timer) clearInterval(timer);
    const d = typeof detail === "function" ? detail(value) : detail;
    const line = `  ${c.green(G.ok)} ${label}${d ? "  " + c.gray(d) : ""}`;
    animate ? out.write(`\r\x1b[2K${line}\n`) : log(line);
    return value;
  } catch (err) {
    if (timer) clearInterval(timer);
    const line = `  ${c.red(G.fail)} ${label}  ${c.red(err.message)}`;
    animate ? out.write(`\r\x1b[2K${line}\n`) : log(line);
    throw err;
  }
}

function section(title) {
  log();
  log(`  ${c.bold(title)}`);
}

/** A list of rows with a live progress bar pinned underneath while it fills. */
function progress(total, label) {
  let done = 0;
  const bar = () => {
    const w = 24;
    const fill = Math.round((done / total) * w);
    return `  ${c.cyan(G.full.repeat(fill))}${c.gray(G.empty.repeat(w - fill))} ${c.dim(`${done}/${total} ${label}`)}`;
  };
  if (animate) out.write(bar());
  return {
    async row(status, name, note) {
      done++;
      const mark = status === "ok" ? c.green(G.ok) : status === "skip" ? c.yellow(G.skip) : c.red(G.fail);
      const nameCol = name.padEnd(22);
      const room = width() - 6 - nameCol.length;
      const line = `  ${mark} ${c.bold(nameCol)}${c.gray(clip(note || "", room))}`;
      if (animate) {
        out.write(`\r\x1b[2K${line}\n${bar()}`);
        await sleep(45);
      } else {
        log(line);
      }
    },
    end() {
      if (animate) out.write("\r\x1b[2K");
    },
  };
}

function box(title, lines, tone = "green") {
  const paint = c[tone] || c.green;
  const max = width() - 4;
  // A line wider than the box loses its colour and gets clipped rather than breaking the border.
  lines = lines.map((l) => (visible(l) + 2 > max ? clip(String(l).replace(ANSI_RE, ""), max - 2) : l));
  const inner = Math.min(max, Math.max(visible(title) + 4, ...lines.map((l) => visible(l) + 2)));
  const b = G.box;
  log();
  log("  " + paint(b.tl + b.h + " ") + c.bold(title) + " " + paint(b.h.repeat(Math.max(0, inner - visible(title) - 3)) + b.tr));
  for (const l of lines) {
    const pad = Math.max(0, inner - visible(l) - 2);
    log("  " + paint(b.v) + " " + l + " ".repeat(pad) + " " + paint(b.v));
  }
  log("  " + paint(b.bl + b.h.repeat(inner) + b.br));
  log();
  showCursor();
}

const note = (s) => log(`  ${c.yellow(G.warn)} ${s}`);
const info = (s) => log(`  ${c.gray(G.dot)} ${s}`);

module.exports = {
  c, G, banner, spin, section, progress, box, note, info, log, showCursor,
  disableAnimation() { animate = false; },
  get animated() { return animate; },
};
