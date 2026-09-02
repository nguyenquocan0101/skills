# Azure-K8s track — Azure DevOps Pipelines → DockerHub/ACR → Kubernetes

Compose plays no part in the deploy path on this track. `docker/docker-compose.dev.yml` exists for
local development only; production is Kubernetes manifests or a Helm chart. A `docker-compose.prod.yml`
in an Azure-track repo is a leftover, and it should be flagged as one.

## Pipeline stages (`azure-pipelines.yml`, repo root)

```yaml
trigger:
  branches:
    include: [main]
```

**`Validate` stage.** The repo's real lint and test commands (per Step 2.5 of the skill).

**`Build` stage.** `Docker@2` with `command: buildAndPush`, `tags: |` `$(Build.BuildId)` and
`latest`. The registry comes from a **Service Connection** — never a literal username and password
in the YAML, and never a PAT pasted into a variable that isn't marked secret.

**`Deploy` stage** (`dependsOn: Build`, only when Step 0.6 resolved autodeploy):

- **kubectl** → `KubernetesManifest@1` with `action: deploy`, the manifests, and the image
  substituted at deploy time via the `containers:` input.
- **Helm** → `HelmDeploy@0` with `command: upgrade`, `arguments: --install --wait`.

Then, in both cases, verify rather than assume:

```bash
kubectl rollout status deployment/<name> -n <ns> --timeout=180s
curl -fsS https://<host>/<health-path>
```

Fail loudly on timeout. `--wait` on Helm and `rollout status` on kubectl are what turn "the task
succeeded" into "the pods are actually serving".

## Deploy tool: kubectl or Helm

Pick on need, not on which sounds more production-grade:

- **kubectl + plain manifests** — one environment, no templating needed. Fewer moving parts, and
  the manifest in git is exactly what is applied.
- **Helm** — several environments needing different values, or a chart you will version and share.
  The cost is a templating layer between what you read and what runs.

An existing `helm/` chart means Helm; an existing `k8s/` directory of plain manifests means
kubectl. Only ask when neither exists.

## Manifest layout

**kubectl** (`k8s/`): `namespace.yaml`, `<service>-deployment.yaml`, `<service>-service.yaml`,
`ingress.yaml`, `configmap.yaml`, and a `secret.yaml` **template** with no real values committed.

**Helm** (`helm/<app>/`): `Chart.yaml`, `values.yaml` plus `values-staging.yaml` /
`values-production.yaml`, and `templates/` containing `deployment.yaml` (reading
`{{ .Values.image.tag }}`), `service.yaml`, `ingress.yaml`, `configmap.yaml`, `secret.yaml`.

Every deployment needs `readinessProbe` and `livenessProbe` pointed at the health endpoint
detected in Step 2, plus `resources.requests` and `resources.limits`. A pod with no requests is a
pod the scheduler cannot place sensibly, and a pod with no readiness probe takes traffic before
it can serve it.

## Image tags

The manifest or `values.yaml` must carry the **Build ID or commit SHA** at deploy time, never
`latest`. `latest` in a Deployment means a restarted pod can silently pick up a different build
than its siblings, and it makes `kubectl rollout undo` meaningless.

## Rollback

- **kubectl** — `kubectl rollout undo deployment/<name> -n <ns>`, or re-apply the manifest with the
  previous immutable tag. `kubectl rollout history deployment/<name>` lists what is available.
- **Helm** — `helm rollback <release> <revision> -n <ns>`; `helm history <release>` lists revisions.

Write the exact command, with this project's real release and namespace names, into
`k8s/README.md` or `helm/<app>/README.md`. Rollback that has to be reconstructed mid-incident is
rollback you do not have.

## Credentials

| Thing | Comes from |
|---|---|
| Registry (DockerHub or ACR) | Docker Registry service connection |
| Cluster access | Kubernetes service connection |
| App config and secrets | variable group, or a Kubernetes Secret created out of band |

Never a committed kubeconfig, never a literal token in YAML. On AKS with ACR, prefer managed
identity over a stored credential. Document the variable-group and service-connection names in the
README so the next person can find them without opening the pipeline settings.

## Security checklist

- [ ] No kubeconfig, token or registry credential committed anywhere
- [ ] Final Dockerfile stage runs as a non-root user
- [ ] `secret.yaml` is a template with placeholder values only
- [ ] Deploy stage is gated on `main` (and optionally on an Environment approval)
- [ ] Secrets not echoed in task logs
- [ ] Image pull uses the service connection or managed identity, not an inline secret

## Reviewing an existing pipeline

- [ ] Image tag in the manifest or values is the Build ID / commit SHA, never `latest`
- [ ] Deploy task blocks until rollout completes (`--wait`, `rollout status`)
- [ ] Post-deploy health check exists and fails the stage on timeout
- [ ] Registry and cluster credentials come from service connections or a variable group
- [ ] `readinessProbe` / `livenessProbe` and `resources` present on every deployment
- [ ] `Validate` stage runs before `Build` and executes the repo's real test command
- [ ] No `docker-compose.prod.yml` treated as a deploy artifact in this repo
- [ ] No leftover SSH-to-VPS deploy step or `VPS_HOST` / `VPS_SSH_KEY` secrets
- [ ] Rollback command documented with this project's real release and namespace names
- [ ] Docs describe the flow that actually exists today
