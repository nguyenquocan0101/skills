---
name: cicd-dokploy
description: "Design and review CI/CD pipelines for the GitHub Actions → DockerHub → Dokploy → VPS deployment flow. Covers Dockerfile/docker-compose authoring, GitHub Actions workflow structure, image tagging strategy, Dokploy API-triggered deploys, health checks, and rollback. Use whenever the user wants to write or review a deploy pipeline, GitHub Actions workflow, Dockerfile, docker-compose for production, or mentions Dokploy, VPS deployment, DockerHub push, or CI/CD for a containerized app — even if they don't name Dokploy explicitly but describe building an image in CI and deploying it to a VPS."
---

# CI/CD: GitHub Actions → DockerHub → Dokploy → VPS

This skill helps build a production-ready deployment pipeline for containerized apps deployed via Dokploy on a VPS. The pipeline's job is to make builds reproducible and deploys safe to reverse — never to build on the server itself.

## Core flow

```
Push to main → GitHub Actions (test/build) → Docker image →
push to DockerHub (tagged) → trigger Dokploy API (compose.deploy/application.deploy) →
Dokploy pulls image → Docker Compose restarts container →
health check → (rollback if failed)
```

## References

| File | Covers |
|------|--------|
| `references/pipeline-stages.md` | Stage-by-stage breakdown: trigger, validate, build, push, deploy, health check |
| `references/tagging-and-rollback.md` | Image tagging strategy and rollback procedure |
| `references/security-checklist.md` | Secrets management, Dockerfile hardening, security checklist |
| `references/environments.md` | Staging vs production setup, when to consider Kubernetes |

## Non-negotiable principles

These are the parts of the flow that, if skipped, turn this from "production-ready" into "works on my machine but fragile":

1. **Never build on the VPS.** The VPS only pulls a finished image. If you find yourself writing `git pull && docker build` in a Dokploy deploy script, stop — that build belongs in GitHub Actions. Building on the server makes deploys slow, non-reproducible, and couples build failures to production uptime.
2. **Never tag only `latest`.** `latest` always points to "whatever was pushed most recently" — it gives you no way to know what's running or to roll back to a specific version. Always also tag with the commit SHA (or release version); `latest` can ride alongside it for convenience.
3. **No secrets in the repo or pipeline YAML.** DockerHub credentials, the Dokploy API token, and production env vars belong in GitHub Secrets, injected at workflow runtime — never hardcoded, never committed even temporarily.
4. **Validate before building.** Run tests/lint/build checks before the Docker build step. A pipeline that builds and pushes broken code just automates shipping bugs faster.
5. **Have a health check endpoint and use it post-deploy.** Without one, "deploy succeeded" only means "container started," not "app works."
6. **Know your rollback path before you need it.** Decide in advance: is rollback "redeploy the previous commit-SHA tag via Dokploy" or fully scripted? Don't improvise this during an incident.

## When reviewing an existing pipeline

Check for these failure patterns first — they're the most common gaps:
- Deploy trigger fires from any branch, not just `main`/`master`
- Image only tagged `latest`, no commit-SHA or version tag
- Dockerfile copies the whole repo context instead of using `.dockerignore`
- No multi-stage build for compiled/bundled apps (bloated final image)
- Container runs as root with no stated reason
- No `HEALTHCHECK` in the Dockerfile or no post-deploy health check call in the workflow
- Secrets referenced as plain strings instead of `${{ secrets.X }}`
- No distinction between staging and production triggers/environments

Read the relevant reference file before making detailed recommendations — don't guess at Dokploy API specifics or Dockerfile flags from memory.


---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
