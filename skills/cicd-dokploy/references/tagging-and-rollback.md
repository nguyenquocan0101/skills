# Image Tagging and Rollback

## Why `latest` alone is dangerous

`latest` always points at whatever was pushed most recently. Once a new image is pushed, the old `latest` is gone — there's no way to know what's currently running on the VPS, and no tag left to roll back to. Treat `latest` as a convenience pointer only, never as the source of truth for "what's deployed."

## Tagging strategy

Push at least two tags per build:

| Tag type | Example | Purpose |
|---|---|---|
| Commit SHA | `my-app:a1b2c3d` | Immutable, exact traceability to source |
| `latest` | `my-app:latest` | Convenience pointer to newest build |
| Semver (on release) | `my-app:v1.2.0` | Human-readable release marker |
| Branch name (optional) | `my-app:main-a1b2c3d` | Useful if multiple branches build images |

In GitHub Actions, the commit SHA is available as `${{ github.sha }}` (full) or via `git rev-parse --short HEAD` for a short form.

## Tracking what's currently deployed

Before each deploy, know the tag currently running in production — Dokploy's deployment history/dashboard usually shows this, or record it in a deploy log/Slack notification step. This is what makes rollback fast instead of a guessing game during an incident.

## Rollback

Two approaches, not mutually exclusive:

**1. Manual rollback via Dokploy UI**
Open Dokploy, pick the previous known-good image tag, redeploy. Simple, good enough for early-stage projects with low deploy frequency.

**2. Scripted rollback by tag**
Dokploy's `compose.deploy`/`application.deploy` API (see `pipeline-stages.md` Stage 5) just redeploys whatever image tag the compose/env config currently points at — it does not accept an arbitrary tag in the deploy call itself. To roll back to a specific commit-SHA tag:

1. Update the `IMAGE_TAG` (or equivalent) environment variable for that app in the Dokploy UI/API to the previous known-good SHA — compose files should reference `${DOCKER_USERNAME}/<image>:${IMAGE_TAG:-latest}` so this variable actually controls what gets pulled.
2. Call the same `compose.deploy`/`application.deploy` endpoint used for normal deploys (`x-api-key` + `composeId`/`applicationId`) to trigger the redeploy against that pinned tag.

Don't invent a different payload shape for rollback than for a normal deploy — it's the same API call, the only thing that changes is which tag the env var resolves to.

**Never roll back by redeploying `latest`** — by the time you need to roll back, `latest` has already moved past the bad version, possibly to something even worse, or it floats forward again on the next unrelated push.
