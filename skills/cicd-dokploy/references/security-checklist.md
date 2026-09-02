# Secrets and Security Checklist

## Sensitive values that must live in GitHub Secrets (never in code or YAML literals)

- DockerHub username
- DockerHub access token (use a token, not the account password)
- `DOKPLOY_API_TOKEN` — the only genuinely sensitive Dokploy value; anyone with it can trigger/redeploy anything in scope. Generated in Dokploy Profile → API/CLI Keys, never the per-app "Webhook URL" (that's a different, narrower trigger mechanism — see `pipeline-stages.md` Stage 5).
- VPS SSH credentials, if any direct SSH step exists
- Production environment variables (DB connection strings, API keys, etc.)

`DOKPLOY_URL` (the Dokploy domain) and `DOKPLOY_COMPOSE_ID`/`DOKPLOY_APPLICATION_ID` aren't sensitive on their own — they're useless without the API token. They still need to be set per-repo, but they don't need the same secrecy as the token itself; if the repos live under a GitHub **Organization**, set `DOKPLOY_URL` and `DOKPLOY_API_TOKEN` once as **Organization secrets** (shared across repos) and only repeat the per-app `DOKPLOY_COMPOSE_ID` at the repo level — that's the only one that legitimately differs per app. Personal (non-org) GitHub accounts have no equivalent sharing mechanism; each repo needs its own copy of all three.

Reference them in workflows as `${{ secrets.NAME }}`, injected at runtime — never echoed to logs.

## Dockerfile hardening

- `.dockerignore` excludes `.git`, `.env`, `node_modules`, build artifacts, test fixtures
- No sensitive values baked into image layers (including build args that leak into history — use BuildKit secret mounts for build-time values, not `ARG`/`ENV`)
- Multi-stage builds to keep the final image minimal
- Non-root user for the app process where the base image/runtime supports it
- `HEALTHCHECK` instruction so orchestration layers can detect a hung container
- Pin and periodically update base images (don't silently inherit unpatched CVEs)

## General security checklist

1. No passwords or sensitive values in source code, ever — including in comments or commit history.
2. `.env` files are never committed (verify `.gitignore` covers them).
3. DockerHub access tokens, not account passwords, used in CI.
4. Dokploy API credentials kept out of logs and PR descriptions.
5. VPS only exposes the ports it needs (app port + SSH if required; nothing else).
6. Containers run non-root unless there's a specific, stated reason not to.
7. Base images updated on a regular cadence, not just at initial setup.
8. Image vulnerability scanning (e.g., `docker scout`, Trivy) added to CI if the project's risk profile warrants it.
9. Clear separation between staging and production credentials — staging compromise should never expose production values.
