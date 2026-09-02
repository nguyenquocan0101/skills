# Dokploy track — GitHub Actions → DockerHub → Dokploy/VPS

The deploy artifact on this track is **Docker Compose**. Dokploy pulls the image and brings the
compose stack up on the VPS, so `docker-compose.prod.yml` is production, not a convenience.

## Pipeline stages (`.github/workflows/docker-publish.yml`)

```
validate  →  publish  →  deploy
```

**Stage 1 — `validate`.** Lint and test with the repo's real commands. If the repo has no tests,
say so in the job name rather than running a placeholder; a pipeline that claims to validate and
doesn't is worse than one that admits it has no tests.

**Stage 2 — `publish`** (`needs: validate`). `docker/setup-buildx-action` → `docker/login-action`
with `DOCKER_USERNAME` / `DOCKER_PASSWORD` → build and push tagged with **both** `latest` and the
commit SHA. Never only `latest`: without an immutable tag you cannot say what is running, and
rollback becomes guesswork. Retry the push once on failure, then verify the image is pullable.

**Stage 3 — `deploy`** (`needs: publish`, only when Step 0.6 resolved autodeploy).

```yaml
- name: Trigger Dokploy redeploy
  run: |
    code=$(curl -s -o body.txt -w '%{http_code}' -X POST \
      "${{ secrets.DOKPLOY_URL }}/api/compose.deploy" \
      -H "x-api-key: ${{ secrets.DOKPLOY_API_TOKEN }}" \
      -H "Content-Type: application/json" \
      -d '{"composeId": "${{ secrets.DOKPLOY_COMPOSE_ID }}"}')
    cat body.txt
    [ "$code" -ge 200 ] && [ "$code" -lt 300 ] || exit 1
```

Two things go wrong here more than anything else:

- **Using the Deployments-tab Webhook URL instead of the API.** It rejects the call with
  `{"message":"Branch Not Match"}` and, because the HTTP status can still look benign, the job
  goes green while nothing deployed. Use `/api/compose.deploy` (or `/api/application.deploy` for
  an application rather than a compose stack) with the `x-api-key` header.
- **Not checking the response.** Capture status *and* body, and fail on non-2xx. `curl` without
  `-f` or an explicit status check exits 0 on a 500.

**Stage 4 — health gate.** Poll the health endpoint for roughly 3–4 minutes and fail loudly on
timeout. A deploy that returned 200 from the API but never came up is the failure this catches.

## Tagging and rollback

- Tags: `latest` + commit SHA on every publish. Optionally a semver tag on release.
- Rollback = redeploy the previous SHA. Pin the image tag in `docker-compose.prod.yml` to a
  variable (`image: user/app:${IMAGE_TAG:-latest}`), set `IMAGE_TAG` in Dokploy's environment,
  and rolling back is changing one value and clicking Deploy.
- Write the exact rollback steps into `docker/README.md`. Reconstructing them during an incident
  is where the extra twenty minutes of downtime comes from.

## `docker-compose.prod.yml` requirements

`pull_policy: always` (otherwise a redeploy can reuse the cached image), log rotation via
`max-size` / `max-file`, per-service memory limits from env-overridable variables, a `HEALTHCHECK`,
`restart: unless-stopped`, and a named external network when several repos share one VPS.

## Environments

Keep `docker/docker-compose.dev.yml` (local: app + datastores, healthchecked dependencies, named
volumes) separate from `docker-compose.prod.yml`. Environment values come from Dokploy's own
environment settings, not from a committed `.env`. Commit `.env.example` only.

## Secrets

| Secret | Needed when |
|---|---|
| `DOCKER_USERNAME`, `DOCKER_PASSWORD` | always |
| `DOKPLOY_URL`, `DOKPLOY_API_TOKEN`, `DOKPLOY_COMPOSE_ID` | only when autodeploy is on |

All referenced as `${{ secrets.* }}`, never inline. Document the table in `docker/README.md`.

## Security checklist

- [ ] No credentials, tokens or `.env` contents in the workflow, the Dockerfile, or the image
- [ ] Final Dockerfile stage runs as a non-root user
- [ ] `.dockerignore` excludes `.git`, `.env*` (keeping `!*.env.example`), build output, test artifacts
- [ ] Workflow triggers on `main`/`master` push (plus optional manual dispatch), not every branch
- [ ] Secrets are not echoed in logs — no `set -x` around the curl, no printing the token
- [ ] The Dokploy API token is scoped to what it needs and rotatable

## Reviewing an existing pipeline

- [ ] Deploy step uses the Dokploy API, not the Deployments-tab Webhook URL
- [ ] Deploy job checks HTTP status and body, and fails on non-2xx
- [ ] Post-deploy health check exists and fails the job on timeout, rather than only logging
- [ ] Image tagged with an immutable tag, not `latest` alone
- [ ] `validate` runs before `publish` and executes the repo's real test command
- [ ] `pull_policy: always` present in the production compose file
- [ ] No leftover SSH-to-VPS deploy step, `appleboy/ssh-action`, or `VPS_HOST` / `VPS_SSH_KEY`
      secrets — that pattern is not a supported track here
- [ ] No stray `azure-pipelines.yml` or Kubernetes manifests in a Dokploy repo
- [ ] Dokploy's own native "Autodeploy" toggle is not also enabled, racing the CI deploy job
- [ ] `docker/README.md` describes the flow that actually exists today
