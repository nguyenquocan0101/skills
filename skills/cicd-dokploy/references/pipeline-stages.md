# Pipeline Stages

## Stage 1 — Trigger

Trigger the pipeline on pushes to the main/production branch only:

```yaml
on:
  push:
    branches: [main]
```

Do not deploy production from every branch. If a staging environment exists, give it its own trigger (e.g., a `staging` branch or a separate workflow) — see `environments.md`.

## Stage 2 — Validate

Before building the Docker image, fail fast on broken code:

- Checkout succeeds
- Dependencies install cleanly
- Unit tests pass
- App builds without errors
- Lint/format checks pass (if the project uses them)

This stage exists so a red pipeline never reaches DockerHub. A pipeline that builds and pushes failing code just automates shipping bugs faster.

## Stage 3 — Build the Docker image

Build from the Dockerfile only after validation passes. Dockerfile hygiene:

- Add a `.dockerignore` (exclude `.git`, `node_modules`, `.env`, test fixtures, etc.)
- Don't copy files the image doesn't need at runtime
- Never bake secrets into image layers
- Use multi-stage builds when there's a compile/bundle step — keep the final image to runtime deps only
- Run the app as a non-root user where the runtime supports it
- Add a `HEALTHCHECK` instruction if the app exposes a health endpoint

## Stage 4 — Push to DockerHub

Push with at least two tags: one immutable identifier and one mutable pointer.

```yaml
- uses: docker/build-push-action@v5
  with:
    push: true
    tags: |
      myorg/my-app:latest
      myorg/my-app:${{ github.sha }}
```

See `tagging-and-rollback.md` for the full tagging strategy.

## Stage 5 — Trigger Dokploy

After the image is on DockerHub, call the Dokploy API to trigger a deploy. This is the step that lets GitHub Actions avoid SSH-ing into the VPS directly — Dokploy owns the deploy mechanics (pull image, recreate container, apply compose config).

**Do not use the "Deployments → Webhook URL" shown in the Dokploy UI for this.** That URL (`https://<dokploy-domain>/api/deploy/compose/<id>`) is designed for a *git provider* to call on a push event — Dokploy parses the request body for a `ref`/branch and compares it against the branch configured on the app. A bare `curl` with no git-provider payload gets rejected with `{"message":"Branch Not Match"}` (HTTP 301/400 depending on version) — confirmed in practice, this is not a method (GET/POST) issue, it's a payload-shape issue. Don't try GET vs POST on this URL; it doesn't matter, the real fix is to stop using it.

Use the **Dokploy REST API** instead, authenticated with an API key (no branch matching involved):

1. Generate a key: Dokploy UI → Profile/Settings → **API/CLI Keys** → Generate New Key (`Expiration: Never` for a long-lived CI key, scoped to the right Organization)
2. Find the compose/application id: open the app in Dokploy and read the **dashboard URL** — `.../services/compose/<composeId>` (for an `Application`, not Compose, the endpoint is `application.deploy` with `applicationId` instead). **Do not** take the id from the Deployments-tab Webhook URL (`.../api/deploy/compose/<token>`) — that segment is a separate regenerable webhook token, not the real `composeId`; calling `compose.deploy` with it returns `404 {"message":"Compose not found"}` (confirmed in practice on 2026-06). If the dashboard URL isn't available, open DevTools → Network, click the manual "Deploy" button in the UI, and read `composeId` off the actual `compose.deploy` request body.
3. Call the API:

```yaml
- name: Trigger Dokploy deploy
  env:
    DOKPLOY_URL: ${{ secrets.DOKPLOY_URL }}
    DOKPLOY_API_TOKEN: ${{ secrets.DOKPLOY_API_TOKEN }}
    DOKPLOY_COMPOSE_ID: ${{ secrets.DOKPLOY_COMPOSE_ID }}
  run: |
    HTTP_CODE=$(curl -sS -o /tmp/dokploy_response.txt -w "%{http_code}" \
      -X POST "$DOKPLOY_URL/api/compose.deploy" \
      -H "Content-Type: application/json" \
      -H "x-api-key: $DOKPLOY_API_TOKEN" \
      -d "{\"composeId\":\"$DOKPLOY_COMPOSE_ID\"}")
    echo "Dokploy API response ($HTTP_CODE):"; cat /tmp/dokploy_response.txt
    if [ "$HTTP_CODE" -lt 200 ] || [ "$HTTP_CODE" -ge 300 ]; then
      echo "Dokploy compose.deploy call failed with status $HTTP_CODE"; exit 1
    fi
```

Capture the status code and body explicitly rather than relying on `curl -f` alone — `-f` suppresses the response body on failure, which is exactly what you need to see when a deploy call is rejected.

Never hardcode the domain, API token, or compose/application id — all three are secrets (`DOKPLOY_URL`, `DOKPLOY_API_TOKEN`, `DOKPLOY_COMPOSE_ID`).

## Stage 6 — Health check after deploy

After Dokploy reports the deploy as applied, verify the app actually works — a running container is not the same as a working app.

```yaml
- name: Wait and verify health
  run: |
    for i in {1..10}; do
      if curl -fs https://your-app.example.com/health; then
        echo "Healthy"; exit 0
      fi
      sleep 5
    done
    echo "Health check failed"; exit 1
```

A good health endpoint (`/health`, `/api/health`, `/status`) should confirm:
- The process is up and responding with HTTP 200
- It can reach its database/dependencies if those are required for basic operation

If this stage fails, the workflow should fail loudly (not silently succeed) so the team knows to investigate or roll back.
