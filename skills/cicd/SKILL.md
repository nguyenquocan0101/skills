---
name: cicd
description: "Scaffold or audit a Docker → registry → deploy CI/CD pipeline for a repo, on one of two tracks — Dokploy (GitHub Actions → DockerHub → Dokploy/VPS) or Azure (Azure DevOps Pipelines → DockerHub/ACR → Kubernetes/K3s/AKS via kubectl or Helm). Use when the user wants to set up CI/CD for a new repo, add Docker deploy automation, or check/update an existing repo's pipeline against the standard. Modes (pick one): --new (scaffold Dockerfile/compose/pipeline/manifests for a repo with none), --audit (review an existing pipeline against the standard, report gaps, fix on confirmation). Also use whenever the user mentions Dokploy, deploying containers to a VPS, a DockerHub push from CI, Azure DevOps pipelines, Kubernetes/K3s/AKS, kubectl or Helm deploys, image tagging or rollback — even without saying \"CI/CD\"."
---

# cicd — Scaffold or Audit Docker → Registry → Deploy CI/CD Pipeline

Modes — mutually exclusive, pick one (default = auto-detect):
- **`--new`** — repo has no Dockerfile/compose/pipeline yet → scaffold from scratch
- **`--audit`** — repo already has a pipeline → review against the standard, report gaps, fix on confirmation
- _(no flag)_ — detect mode from target repo state (Step 0)

The target path is whatever the user passed with the request; default to the current repo root
when they didn't say.

### Non-negotiables (both tracks)

These are what separate a production pipeline from one that merely runs. Every scaffold must
satisfy them and every audit checks them first:

1. **Never build on the server or cluster.** CI builds and pushes; the target only pulls.
2. **Never tag only `latest`.** Every image also gets an immutable tag (commit SHA or Build ID),
   and that immutable tag is what gets deployed — otherwise rollback has nothing to roll back to.
3. **No secrets in the repo or pipeline YAML.** GitHub Secrets / Azure Library variable groups and
   Service Connections only, injected at runtime, never echoed.
4. **Validate before building.** A red test/lint/build stage blocks the image from reaching the
   registry.
5. **A health endpoint, checked after deploy.** "Container started" is not "app works"; the deploy
   job fails loudly if the endpoint doesn't come up.
6. **Rollback decided before it is needed,** and written into the repo's deploy README with the
   real names.

---

### Step 0 — Resolve target + detect mode

Resolve the target repo path. Check for: `Dockerfile`, `docker-compose*.yml` / `docker/docker-compose*.yml`, a `.github/workflows/*.yml` or `azure-pipelines.yml` that builds/pushes a Docker image, and a `k8s/`/`helm/` directory.

- None of these exist → **New** mode
- Any exist → **Audit** mode
- Explicit `--new`/`--audit` always overrides detection

```
# Scope:
#   Target: <path>
#   Mode:   New | Audit (detected: <why>)
```

---

### Step 0.5 — Resolve deploy track

There are exactly two supported tracks — no SSH-to-VPS path, no mixing the two. Detect from existing files first (audit mode): `DOKPLOY_URL`/`DOKPLOY_API_TOKEN`/`DOKPLOY_COMPOSE_ID` secrets, `compose.deploy`/`application.deploy` calls, or a `docker-compose.prod.yml` actually used as the deploy artifact → **Dokploy**; `azure-pipelines.yml`, a `k8s/`/`helm/` directory, or `kubectl`/`helm` commands in an existing pipeline → **Azure (Kubernetes)**.

If undetectable (new mode, or audit mode with no existing pipeline at all), ask the user:
- **Dokploy** — GitHub Actions builds/pushes to DockerHub, then triggers the Dokploy API to redeploy on the VPS
- **Azure (Kubernetes)** — Azure DevOps Pipelines builds/pushes to DockerHub or ACR, then deploys onto a Kubernetes cluster (K3s or AKS) via `kubectl` or Helm

These tracks are not variations of each other — they use different CI engines, different reference skills, and Docker Compose plays a different role in each (full deploy artifact for Dokploy; local-dev only for Azure/Kubernetes).

```
# Deploy track: Dokploy | Azure-K8s (detected: <why> | asked)
```

---

### Step 0.55 — Azure track only: resolve deploy tool + registry

Skip this step entirely on the Dokploy track. On the Azure track, detect or ask:

- **Deploy tool** — existing `helm/` chart → **Helm**; existing `k8s/` plain manifests → **kubectl**; otherwise ask the user (Helm if multiple environments need different values, kubectl if a single environment and no templating is needed — don't default to Helm just because it sounds more "production-grade").
- **Registry** — DockerHub or Azure Container Registry (ACR). ACR is the natural fit if the cluster is AKS (managed-identity auth); DockerHub is fine for K3s or if the team already standardizes on it. Detect from existing service connection name/`containerRegistry` value if present; otherwise ask.

```
# Azure track: deploy tool = kubectl | Helm, registry = DockerHub | ACR (detected: <why> | asked)
```

---

### Step 0.6 — Resolve autodeploy preference

Ask the user (both tracks, both modes — don't assume): should pushing to `main` automatically trigger deploy, or should the human deploy by hand?

- **Autodeploy** — the `deploy` job/stage runs automatically after `publish`/`build` succeeds.
- **Manual deploy** — the pipeline stops after pushing the image; the human deploys when ready:
  - **Dokploy + manual** — click "Deploy" in the Dokploy dashboard for that app/compose. (Separate from Dokploy's own native "Autodeploy" toggle, which redeploys on git push to the *Dokploy-watched* repo — if the user wants that instead of a CI-triggered `deploy` job, say so explicitly so they don't end up with two competing triggers.)
  - **Azure-K8s + manual** — run `kubectl apply -f k8s/` or `helm upgrade --install ...` by hand with the new image tag, or gate the `Deploy` stage behind an Azure Pipelines **Environment** approval instead of removing it outright.

```
# Autodeploy: yes | no (manual)
```

---

### Step 1 — Load the standard

Read the reference file for the resolved track in full before touching any file — and only that
one. It is the single source of truth for the track's API and CLI specifics; improvising a deploy
API call or a task name from memory is how a pipeline ends up green while nothing deployed.

| Track | Read | Covers |
|---|---|---|
| Dokploy | `references/dokploy.md` | workflow shape, `compose.deploy` API (and why the webhook URL fails), secrets table, prod compose, rollback by `IMAGE_TAG`, track audit items |
| Azure-K8s | `references/azure-k8s.md` | stage YAML, `KubernetesManifest@1` / `HelmDeploy@0`, kubectl-vs-Helm, manifest/chart layout, Library + Service Connections, rollout undo / helm rollback, track audit items |

The reference files own the track detail; this file owns the decision procedure, the
non-negotiables and the cross-track audit. Never copy their specifics in here — a second copy is a
copy that goes stale.

---

### Step 2 — Detect stack (both tracks)

Inspect the target repo for stack signals:

| Signal | Stack | Base images |
|---|---|---|
| `*.csproj` / `*.sln` / `*.slnx` | .NET | `mcr.microsoft.com/dotnet/sdk:<ver>` build, `mcr.microsoft.com/dotnet/aspnet:<ver>` runtime |
| `package.json` with `next` dep | Next.js | `node:<lts>-alpine` build, standalone output runner |
| `package.json` (no `next`) | Node | `node:<lts>-alpine` |
| `requirements.txt` / `pyproject.toml` | Python | `python:<ver>-slim` |
| `go.mod` | Go | `golang:<ver>` build, `scratch`/`distroless` runtime |

Also determine: exposed app port (read existing config/env, ask if not inferable), a health endpoint (`/health`, `/api/health`, `/` — check existing routes first; on the Azure track this doubles as the K8s readiness/liveness probe target), and the image name (usually the repo/service name).

If any of these can't be inferred, ask the user rather than guessing — a wrong port or health path breaks the pipeline silently.

---

### Step 2.5 — Detect test setup (both tracks)

Look for test signals per stack: `package.json` `scripts.test` (and whether it's a real command or the npm-init placeholder `echo "Error: no test specified"`), `*.Tests.csproj`/`*.sln` test projects, `tests/`/`test/` directories, `pytest.ini`/`pyproject.toml` test config, `*_test.go` files.

- **Tests found and runnable** → the validate job/stage (Step 3a/3b) runs them for real (`npm test`, `dotnet test`, `pytest`, `go test ./...`).
- **No tests found** → ask the user whether to (a) scaffold a minimal test job tailored to the detected stack now, or (b) skip tests and run lint+build only as the validate step. Don't silently assume either — a pipeline that claims to validate but doesn't is worse than one that's honest about having no tests.

---

### Step 3a — New mode: Scaffold

Common to both tracks:

1. **`.dockerignore`** — exclude `.git`, `node_modules`/`bin`/`obj`, `.env*` (with `!*.env.example`), test artifacts, `.claude`
2. **`Dockerfile`** (or `docker/Dockerfile`, one per service) — multi-stage build, final stage runs as non-root user, `HEALTHCHECK` instruction hitting the detected health endpoint, no dev/SDK headers in the runtime stage that the base image already bundles (verify with `docker run --rm <base> sh -c "dpkg -l | grep <pkg>"` before adding a package — don't add packages on faith)
3. **`docker/docker-compose.dev.yml`** — local dev stack (app + its datastores), healthchecks on dependencies, named volumes. On the Azure track this is the *only* compose file written — Compose never appears in the deploy path there.

**If Dokploy track:**

4. **`docker/docker-compose.prod.yml`** — `pull_policy: always`, log rotation (`max-size`/`max-file`), per-service memory limits via env-overridable vars, `HEALTHCHECK`, `restart: unless-stopped`, named external network if multiple repos share one VPS
5. **`.github/workflows/docker-publish.yml`**: `validate` (lint/test, per Step 2.5) → `publish` (`needs: validate`; buildx → login → tag with `latest` + commit SHA, never only `latest` → push, retry once on failure → verify pullable) → `deploy` (`needs: publish`, **only if Step 0.6 resolved autodeploy**): **POST** `${{ secrets.DOKPLOY_URL }}/api/compose.deploy` with header `x-api-key: ${{ secrets.DOKPLOY_API_TOKEN }}` and body `{"composeId": "${{ secrets.DOKPLOY_COMPOSE_ID }}"}` — never the Deployments-tab Webhook URL (rejected with `{"message":"Branch Not Match"}`); capture HTTP status + body and fail on non-2xx (see `references/dokploy.md` — it also documents why the Deployments-tab webhook URL and the webhook token both fail). Then poll the health endpoint for ~3–4 minutes, fail loudly on timeout.
6. **`docker/README.md`** — secrets table (`DOCKER_USERNAME`, `DOCKER_PASSWORD`, plus `DOKPLOY_URL`/`DOKPLOY_API_TOKEN`/`DOKPLOY_COMPOSE_ID` only if autodeploy) and a "Deploy" section stating plainly whether deploy is automatic or manual (manual: document clicking "Deploy" in the Dokploy dashboard).

If a known-good `docker-publish.yml` + `docker/README.md` pair already exists in another repo on this machine, use it as the shape to match — matching a working pipeline beats reconstructing one.

**If Azure-K8s track:**

4. **Manifests or chart**, per Step 0.55's tool choice:
   - **kubectl** → `k8s/namespace.yaml`, `<service>-deployment.yaml` (pinned image tag substituted at deploy time, `readinessProbe`/`livenessProbe`, `resources.requests`/`limits`), `<service>-service.yaml`, `ingress.yaml`, `configmap.yaml`, a `secret.yaml` *template* (no real values committed).
   - **Helm** → `helm/<app>/Chart.yaml`, `values.yaml` + `values-staging.yaml`/`values-production.yaml`, `templates/` (`deployment.yaml` reading `{{ .Values.image.tag }}`, `service.yaml`, `ingress.yaml`, `configmap.yaml`, `secret.yaml`).
   - See `references/azure-k8s.md` for the full layout and the kubectl-vs-Helm choice criteria.
5. **`azure-pipelines.yml`** at the repo root: `trigger: branches: include: [main]` → `Validate` stage (lint/test per Step 2.5) → `Build` stage (`Docker@2 buildAndPush`, tags = `$(Build.BuildId)` + `latest`, registry via a Service Connection — never literal credentials) → `Deploy` stage (`needs: Build`, **only if Step 0.6 resolved autodeploy**): `KubernetesManifest@1` (kubectl) or `HelmDeploy@0` (Helm) with `--wait`, then `kubectl rollout status ... --timeout=180s` and a `curl` health check, fail loudly on timeout. See `references/azure-k8s.md` for the full YAML shape.
6. **`k8s/README.md`** (or `helm/<app>/README.md`) — variable-group/Service-Connection table (registry credentials, Kubernetes service connection) and a "Deploy" section stating whether deploy is automatic or manual, plus the exact rollback command for this deployment/release name (see `references/azure-k8s.md`, Rollback) — don't leave rollback as something to reconstruct mid-incident.

Either track: if autodeploy, note that this CI-triggered `deploy` job/stage is the only redeploy trigger — don't let it race against an unrelated native auto-redeploy mechanism (Dokploy's own "Autodeploy" toggle) if one exists.

---

### Step 3b — Audit mode: Review + fix

Walk the "Audit" checklist at the end of the resolved track's reference file
(`references/dokploy.md` or `references/azure-k8s.md`) against the target repo's actual files,
plus these cross-track checks:

- [ ] Confirm via Step 0.6 whether the user actually wants autodeploy or manual deploy here — don't assume from whatever the existing pipeline happens to do
- [ ] **If autodeploy confirmed but `deploy` job/stage is missing/disabled** → gap; **if manual confirmed but a `deploy` job/stage exists anyway** → also a gap
- [ ] No leftover SSH-to-VPS deploy step, `appleboy/ssh-action`, or `VPS_HOST`/`VPS_SSH_KEY` secrets anywhere in the pipeline — flag and offer to remove; this pattern is not a supported track
- [ ] Pipeline/manifest files match the resolved track (Step 0.5) — no stray `azure-pipelines.yml` on a Dokploy repo, no `docker-compose.prod.yml` treated as the real deploy artifact on an Azure-K8s repo
- [ ] Post-deploy health check step exists and fails the job (not just logs) on timeout
- [ ] Image tagged with both `latest` and an immutable tag (commit SHA or Build ID)
- [ ] `.dockerignore` excludes `.git`, `.env*`, build artifacts
- [ ] Multi-stage Dockerfile, non-root final user, `HEALTHCHECK` present
- [ ] No redundant packages installed in the runtime stage that the base image already bundles
- [ ] Pipeline triggers only on `main`/`master` push (+ optional manual trigger), not every branch
- [ ] docs describe the actual current flow, not a stale description
- [ ] `validate` job/stage runs before build/publish and actually executes the repo's real test command (per Step 2.5)

Report as a table: `Gap | Found | Standard | Fix`. Then **ask for confirmation before editing anything** — these are CI/CD files, and a bad edit
breaks deploys for everyone, not just the person who ran this. Apply only the fixes the user
confirmed, scoped to the gaps found. Do not rewrite sections that already comply: a diff that
touches the whole pipeline cannot be reviewed by the person approving it, so the reformatting you
threw in for free is what makes the real fix unmergeable.

---

### Step 4 — Finalize (mandatory, both tracks)

1. Run a YAML sanity check on every pipeline/manifest file touched (e.g. `python3 -c "import yaml; yaml.safe_load(open('path'))"`).
2. List every file written/changed.
3. Spawn `git-manager` to commit (conventional commit message). **Never push without an explicit ask-first confirmation**, unless the user already said to push in this same request.

```
// git-manager → ci(docker): add Dokploy auto-deploy job + health check
//            → Push to remote? [y/N]
```

---

## Related

- Track standards: `references/dokploy.md` and `references/azure-k8s.md` — read the matching one
  in Step 1, never duplicated here.
- Finalize agent: `git-manager` (definition in `../../agents/git-manager.md`)

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
