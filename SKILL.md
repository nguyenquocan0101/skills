---
name: skills
description: "Dispatcher for a collection of agent workflows — brainstorm, spec, scenario (edge cases), plan, cook (implement), fix (debug), sumup (recap), cicd, three frontend design skills, problem-solving techniques, and skill-creator. Use when a task matches one of these workflows, when the user asks which workflow to run, or when they want the collection's catalogue. Routes to exactly one component and loads only that one."
---

# skills — agent workflow collection

A dispatcher. Pick the smallest component that covers the task, load that one, and follow it. The
components are deliberately separate because loading all of them would fill the context with rules
for work you aren't doing — and a plan skill that has also read the CI/CD standard tends to plan
CI/CD nobody asked for.

## Component catalogue

| Component | Use it for |
|---|---|
| `brainstorm` | Explore alternatives before committing, then write a spec and a brainstorm report |
| `spec` | Write the spec directly — the direction is already decided |
| `plan` | Research, split into phases, red-team the plan, hand off to `cook` |
| `cook` | Implement a plan phase by phase, with tests and review gates |
| `fix` | Scout → reproduce → root-cause gate → fix → regression test → review, for a specific bug |
| `scenario` | Edge cases before code: 12 dimensions, severity, test anchors for `plan` and `tester` |
| `sumup` | Recap finished work — outcome, verified vs not, decisions, what is left |
| `cicd` | Scaffold or audit a Docker → registry → deploy pipeline on the Dokploy (GitHub Actions → DockerHub → Dokploy/VPS) or Azure-K8s (Azure DevOps → DockerHub/ACR → Kubernetes) track |
| `frontend-mindset` | Product UI: app screens, dashboards, tables, forms, components — and reviewing them |
| `design-taste-frontend` | Marketing surfaces: landing pages, portfolios, campaign sites, redesigns |
| `minimalist-ui` | One specific look: warm monochrome, editorial, flat bento, document-style |
| `problem-solving` | The work is stuck and you need a different way to think about it |
| `skill-creator` | Create, validate, evaluate or improve a skill |

### Choosing between the three frontend skills

They overlap enough that picking by keyword goes wrong, so pick by **what the page is for**:

- Someone is going to *use* it repeatedly — dashboard, settings, table, form, admin tool →
  `frontend-mindset`.
- Someone is going to *look at it and decide* — landing page, portfolio, launch page, pricing
  page, or an existing one that "looks AI-made" → `design-taste-frontend`.
- The user named the aesthetic — minimal, editorial, Notion-like, document-style, or explicitly
  rejected the colourful SaaS look → `minimalist-ui`.

`minimalist-ui` is a look, not a methodology: it pairs with either of the other two rather than
replacing them. If the brief is a dashboard *in* that aesthetic, read `frontend-mindset` for the
engineering and `minimalist-ui` for the visual language.

## Routing procedure

1. Identify the smallest matching component.
2. Read that component's `skills/{component}/SKILL.md` completely before acting.
3. Read only the references, scripts or assets that component points you to for the task at hand.
4. Follow its workflow, and keep its artifacts and verification gates intact. Those gates are the
   part that is easy to drop under time pressure and expensive to have dropped.
5. If a referenced subagent, hook, task list or slash command isn't available on this host, do the
   equivalent step inline and say briefly which fallback you used — see
   `references/host-compatibility.md`.

`cicd` is the only entry point for pipeline work — it resolves the track and the mode, then
reads just that track's reference file (`skills/cicd/references/dokploy.md` or `skills/cicd/references/azure-k8s.md`).

**Sequencing.** Novel or ambiguous feature: `brainstorm` → `plan` → `cook`. Already decided:
`spec` or `plan` → `cook`. A specific bug: `fix` on its own. Blocked or the failure mode is
unclear: `problem-solving` first, then back to whichever workflow you were in.

## Shared contracts

Three files define what the workflows agree on. Read the relevant one when a workflow points at it
rather than up front:

| File | Covers |
|---|---|
| `references/artifact-layout.md` | Where `spec.md`, `plan.md`, phase files and `feature_list.json` live; how the project root is resolved; the `.skills.json` config |
| `references/review-rubric.md` | What the reviewer score means — severity levels, the arithmetic, the auto-approve gate |
| `references/host-compatibility.md` | Antigravity / Claude Code / Codex mapping for subagents, hooks, task lists and slash commands; Antigravity's five hook events |

`agents/` holds definitions for the ten subagent roles the workflows spawn (`researcher`,
`planner`, `plan-reviewer`, `scout`, `debugger`, `tester`, `code-reviewer`, `project-manager`,
`docs-manager`, `git-manager`). `hooks/` holds the simplify trigger that `cook` Step 3.S reads.
Both have install instructions in their own README.

## Portability

The workflows are Markdown-first: the reasoning is the product, and host-specific machinery is an
integration point rather than a prerequisite. Replace an unavailable host action with the
equivalent local one, keep the safety gates, artifacts, tests and review steps, and state the
substitution. The one thing that must never be silently dropped is a verification gate.
