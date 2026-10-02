# Dokploy track — GitHub Actions → DockerHub → Dokploy → VPS

The track-specific half of the standard. `../SKILL.md` owns the decision procedure, the
scaffold list and the cross-track rules (Dockerfile hygiene, tagging, secrets, health check);
this file holds only what is true of Dokploy and nowhere else. Read it in full before writing
or auditing a Dokploy pipeline — the deploy API is the part people get wrong from memory.

```
push to main → validate → build → push to DockerHub (latest + SHA) →
POST Dokploy API (compose.deploy | application.deploy) → Dokploy pulls + recreates →
poll health endpoint → fail loudly (rollback by tag if needed)
```

The VPS never builds. If a deploy step runs `git pull && docker build` on the server, that build
belongs back in Actions.

## Workflow shape

```yaml
on:
  push:
    branches: [main]        # staging gets its own branch/workflow, never "every branch"
```

Jobs: `validate` → `publish` (`needs: validate`) → `deploy` (`needs: publish`, only when the user
chose autodeploy). Push at least two tags:

```yaml
- uses: docker/build-push-action@v5
  with:
    push: true
    tags: |
      ${{ secrets.DOCKER_USERNAME }}/my-app:latest
      ${{ secrets.DOCKER_USERNAME }}/my-app:${{ github.sha }}
```

## Deploy — use the REST API, not the webhook URL

**Never use the Deployments-tab "Webhook URL"** (`/api/deploy/compose/<token>`). It is meant for
a git provider: Dokploy reads a `ref` from the body and compares it to the app's branch, so a bare
`curl` is rejected with `{"message":"Branch Not Match"}`. GET vs POST makes no difference — the
payload shape is the problem. Stop using that URL.

Use the API with an API key:

1. Key: Dokploy → Profile/Settings → **API/CLI Keys** → Generate (expiration *Never* for CI,
   correct Organization).
2. ID: read `composeId` from the app's **dashboard URL** (`.../services/compose/<composeId>`).
   For an Application (not Compose) the endpoint is `application.deploy` with `applicationId`.
   **Not** the token segment of the webhook URL — that is a regenerable webhook token, and
   `compose.deploy` with it returns `404 {"message":"Compose not found"}`. If the dashboard URL is
   unavailable, click "Deploy" in the UI with DevTools → Network open and read the id off the
   real `compose.deploy` request.
3. Call it, capturing status and body (`curl -f` alone hides the body you need on failure):

```yaml
- name: Trigger Dokploy deploy
  env:
    DOKPLOY_URL: ${{ secrets.DOKPLOY_URL }}
    DOKPLOY_API_TOKEN: ${{ secrets.DOKPLOY_API_TOKEN }}
    DOKPLOY_COMPOSE_ID: ${{ secrets.DOKPLOY_COMPOSE_ID }}
  run: |
    HTTP_CODE=$(curl -sS -o /tmp/dokploy.txt -w "%{http_code}" \
      -X POST "$DOKPLOY_URL/api/compose.deploy" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $DOKPLOY_API_TOKEN" \
      -d "{\"composeId\":\"$DOKPLOY_COMPOSE_ID\"}")
    echo "Dokploy API ($HTTP_CODE):"; cat /tmp/dokploy.txt
    if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then exit 1; fi
```

Then verify — a started container is not a working app:

```yaml
- name: Verify health
  run: |
    for i in $(seq 1 40); do
      curl -fs https://your-app.example.com/health && exit 0
      sleep 5
    done
    echo "Health check failed after ~3 min"; exit 1
```

**One redeploy trigger only.** Dokploy's own "Autodeploy" toggle redeploys on git push to the
repo Dokploy watches. If a CI `deploy` job exists, that toggle must be off, or two deploys race.
Manual deploy = no `deploy` job; the human clicks "Deploy" in the dashboard.

## Secrets

| Secret | Sensitive? | Scope |
|---|---|---|
| `DOCKER_USERNAME`, `DOCKER_PASSWORD` (an access token, not the account password) | yes | repo or org |
| `DOKPLOY_API_TOKEN` | **yes** — redeploys anything in scope | org secret when repos share an org |
| `DOKPLOY_URL` | no, useless without the token | org secret when repos share an org |
| `DOKPLOY_COMPOSE_ID` / `DOKPLOY_APPLICATION_ID` | no | always per repo |

Personal (non-org) accounts have no secret sharing — every repo needs all of them.
Production env vars (DB strings, API keys) live in the Dokploy app's environment, not in the repo.

## `docker-compose.prod.yml`

This is the real deploy artifact on this track. It must have: `image:
${DOCKER_USERNAME}/<image>:${IMAGE_TAG:-latest}` (so a tag variable controls what is pulled),
`pull_policy: always`, `restart: unless-stopped`, log rotation (`max-size`/`max-file`),
env-overridable memory limits, a healthcheck, and a named external network if several repos share
one VPS. The VPS exposes only the app port (and SSH if required).

## Rollback

`compose.deploy` redeploys whatever tag the app's env resolves to; it takes no tag argument.

1. Set `IMAGE_TAG` on the app (Dokploy UI or API) to the last known-good SHA.
2. Call the same `compose.deploy` / `application.deploy` endpoint. Same payload as a normal deploy.

Never "roll back" by redeploying `latest` — it has already moved past the bad build. Know the
currently running SHA before each deploy (Dokploy deployment history, or log it in the workflow).

## Staging and when to leave this track

Staging = same Dockerfile/compose, separate Dokploy app, separate secrets, own branch trigger.
Gate production behind GitHub Environments with required reviewers if the team wants approval.

Move to the Azure-K8s track only for a concrete need: services that must scale independently,
multiple nodes, rolling-update control, autoscaling, or GitOps. Not because it sounds more
production-grade.

## Audit — Dokploy-specific gaps

- [ ] Deploy uses `compose.deploy`/`application.deploy` + `x-api-key`, not the webhook URL
- [ ] `composeId` came from the dashboard URL, not the webhook token
- [ ] Deploy step captures HTTP status + body and fails on non-2xx
- [ ] Dokploy native Autodeploy is off when a CI `deploy` job exists
- [ ] `docker-compose.prod.yml` pins `${IMAGE_TAG}` and has `pull_policy: always`
