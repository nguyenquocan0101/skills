---
name: frontend-mindset
description: "Build and review production frontend UI — app screens, dashboards, data tables, forms, components, empty states — covering visual design, the eight interaction states, UX copy, responsive behaviour, Core Web Vitals and accessibility. Use when implementing or reviewing product interface work, when spacing/type/color feel off or generic, or when checking contrast, keyboard access, responsiveness or animation quality. For a marketing landing page, portfolio or campaign site use design-taste-frontend; for a specifically restrained editorial monochrome look use minimalist-ui."
---

# Frontend Development Skill

## References

| File | Covers |
|------|--------|
| `references/visual-design.md` | Color (OKLCH, contrast, palettes), typography (scale, pairing, loading), layout/spacing (grid systems, hierarchy) |
| `references/motion-interaction.md` | Animation timing/easing, the 8 interactive states, focus rings, modals, dropdowns, keyboard nav, advanced techniques (View Transitions, scroll-driven animation, virtual scrolling) |
| `references/copy.md` | Error messages, button labels, empty states, confirmation dialogs, terminology consistency |
| `references/responsive-performance.md` | Breakpoints, touch targets, responsive images, Core Web Vitals, rendering performance |
| `references/review-checklist.md` | Design-system drift, absolute bans, AI-slop test, Nielsen heuristics scoring, cognitive load, severity tagging, final polish checklist |
| `references/design-systems.md` | Brand vs. product register, font selection, imagery, color strategy, token hierarchy, dark mode |
| `references/production-hardening.md` | Extreme inputs, text overflow, i18n/RTL, error handling by status code, edge cases, graceful degradation |

## Register: pick one before designing

| | Brand (marketing, landing pages, campaigns) | Product (app UI, dashboards, tools) |
|---|---|---|
| Slop test | "Would someone say AI made this?" | "Would a Linear/Stripe/Notion user trust this without pausing?" |
| Color | Committed/Full palette/Drenched allowed | Restrained — accent reserved for action/state only |
| Type scale | Fluid `clamp()`, ratio ≥1.25 | Fixed `rem`, ratio 1.125–1.2 |
| Motion | One rehearsed hero moment | 150–250ms, state-only, no page-load choreography |
| Failure mode | Generic / safe / forgettable | Strangeness without purpose, broken familiarity |

See `references/design-systems.md` for the full breakdown.

## Quick Decision Guide

| Need | Choose |
|------|--------|
| Color space | OKLCH, not HSL — perceptually uniform lightness |
| Body text below 4.5:1 contrast | Bump toward ink end of the ramp, never ship as-is |
| 1D layout (rows, nav, button groups) | Flexbox |
| 2D layout (page structure, dashboards) | Grid |
| Responsive grid, no breakpoints | `repeat(auto-fit, minmax(280px, 1fr))` |
| Dropdown inside `overflow: hidden` | `position: fixed`, native `<dialog>`/popover, or a portal — never `position: absolute` in the clipped container |
| Easing curve | `ease-out-quart/quint/expo` — never bounce/elastic |
| Destructive action | Undo toast, not a confirm dialog — confirm only when truly irreversible |
| Button label | Verb + object ("Save changes"), never "OK"/"Submit"/"Yes" |

## Absolute bans (any register)

Match-and-refuse — if about to write one of these, rewrite with different structure:

- **Side-stripe borders** (`border-left/right` >1px as a colored accent). Use full borders, tints, or leading icons instead.
- **Gradient text** (`background-clip: text` + gradient). Use a solid color; emphasize via weight/size.
- **Glassmorphism as default** decoration.
- **The hero-metric template** (big number + label + gradient accent) as a default, not a real-data display.
- **Identical card grids** (icon + heading + text, repeated endlessly).
- **Tiny uppercase tracked eyebrows** above every section.
- **Numbered section markers** (01/02/03) as default scaffolding when there's no real sequence.
- **Text overflowing its container** — test heading copy at every breakpoint.
- **Light gray body text "for elegance"** — the single biggest AI-design readability failure.

Full anti-pattern checklist and severity tagging: `references/review-checklist.md`.

## Defaults

- Verify contrast before shipping: body ≥4.5:1, large text ≥3:1 — placeholders get the same bar as body text
- Every interactive element needs all 8 states designed (default/hover/focus/active/disabled/loading/error/success) — keyboard users never see hover
- `:focus-visible`, never bare `outline: none`
- Every animation has a `prefers-reduced-motion` alternative
- Cap body line length 65–75ch; never animate layout-driving properties (`width`, `height`, `top`, `left`, margin) casually
- Touch targets ≥44×44px even when the visual element is smaller
- Measure performance before optimizing — don't fix what isn't slow

---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
