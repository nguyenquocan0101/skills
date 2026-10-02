# Azure-K8s track — Azure DevOps Pipelines → DockerHub/ACR → Kubernetes

The track-specific half of the standard. `../SKILL.md` owns the decision procedure, the scaffold
list and the cross-track rules; this file holds only what is true of Azure Pipelines and
Kubernetes. Read it in full before writing or auditing — task names and flags are where pipelines
go green while nothing actually rolled out.

```
push to main → Validate → Build (Docker@2 buildAndPush: BuildId + latest) →
Deploy (KubernetesManifest@1 | HelmDeploy@0, --wait) → rollout status → curl health →
fail loudly (rollout undo / helm rollback)
```

The cluster never builds, and Docker Compose is local-dev only here. A `docker-compose.prod.yml`
doing the real deploy means the repo is on the Dokploy track, not this one.

## Pipeline shape

```yaml
trigger:
  branches:
    include: [main]          # staging gets its own trigger

stages:
- stage: Validate            # separate jobs per service; red here blocks Build
  jobs:
  - job: Backend
    steps: [{ script: dotnet restore && dotnet build && dotnet test }]
  - job: Frontend
    steps: [{ script: npm ci && npm run lint && npm test }]

- stage: Build
  dependsOn: Validate
  jobs:
  - job: Images
    steps:
    - task: Docker@2
      inputs:
        command: buildAndPush
        repository: myorg/backend
        dockerfile: backend/Dockerfile
        containerRegistry: $(registryServiceConnection)   # Service Connection, never credentials
        tags: |
          $(Build.BuildId)
          latest
```

Registry: ACR when the cluster is AKS (managed identity), DockerHub for K3s or when the team
already standardises on it. Don't switch mid-project without a reason.

## Deploy — one tool per repo

**kubectl (plain manifests)**

```yaml
- stage: Deploy
  dependsOn: Build
  jobs:
  - deployment: Deploy
    environment: production          # add an approval check here for "manual" deploy
    strategy:
      runOnce:
        deploy:
          steps:
          - task: KubernetesManifest@1
            inputs:
              action: deploy
              kubernetesServiceConnection: $(k8sServiceConnection)
              namespace: production
              manifests: |
                k8s/backend-deployment.yaml
                k8s/backend-service.yaml
              containers: myorg/backend:$(Build.BuildId)
```

**Helm**

```yaml
          - task: HelmDeploy@0
            inputs:
              command: upgrade
              chartType: FilePath
              chartPath: helm/myapp
              releaseName: myapp
              namespace: production
              arguments: --install --set image.tag=$(Build.BuildId) --wait --timeout 5m
```

Then verify explicitly — a deploy that returns immediately reports success over crash-looping pods:

```yaml
          - script: |
              kubectl rollout status deployment/backend -n production --timeout=180s
              curl -fsS https://api.example.com/health || exit 1
```

Manual deploy = keep the stage but gate the `environment` behind an approval, or drop the stage
and document the exact `kubectl apply` / `helm upgrade --install` command.

## kubectl or Helm

| Signal | Pick |
|---|---|
| One environment, one or two services, no per-env overrides | plain `k8s/` manifests |
| Staging + production with different replicas, limits or hosts | Helm, `values-<env>.yaml` |
| Team already runs Helm charts | Helm |

Don't pick Helm for prestige — templating nobody uses is just overhead.

**Manifests** — `k8s/namespace.yaml`, `<svc>-deployment.yaml`, `<svc>-service.yaml`,
`ingress.yaml`, `configmap.yaml`, and `secret.yaml` as a *template only*.

**Chart** — `helm/<app>/Chart.yaml`, `values.yaml`, `values-staging.yaml`,
`values-production.yaml`, `templates/` (`deployment`, `service`, `ingress`, `configmap`,
`secret`, `_helpers.tpl`). `templates/deployment.yaml` must read `{{ .Values.image.tag }}`;
never hardcode the tag there.

Every `Deployment` has: an image pinned to the tag substituted at deploy time (never `:latest` in
committed YAML), `readinessProbe` + `livenessProbe` on the health endpoint, `resources.requests`
and `limits`, `imagePullSecrets` for a private registry, and a `revisionHistoryLimit` above 1.

Ingress controller and TLS (e.g. ingress-nginx + cert-manager) are set up once per cluster; the
pipeline ships only the `Ingress` resource.

## Secrets

- Registry and cluster access are **Service Connections** (Kubernetes type: kubeconfig, or
  ARM-based for AKS). Never a committed kubeconfig.
- App secrets come from a variable group in **Pipelines → Library**, marked secret, referenced as
  `$(group.var)`, turned into Kubernetes `Secret` objects at deploy time (`kubectl create secret`,
  or sealed-/external-secrets if the cluster has them). Dynamic ones use
  `##vso[task.setvariable ...;issecret=true]`.
- `values-production.yaml` holds non-sensitive defaults only.
- The service connection is scoped to the namespaces the pipeline needs, not cluster-admin.
- Staging and production use separate variable groups, service connections and namespaces
  (plus a `NetworkPolicy` so staging pods can't reach production).

## Rollback

Tag every image with `$(Build.BuildId)` (and optionally `$(Build.SourceVersion)`); `latest` is a
pointer, never the value in a manifest. A revision that recorded `:latest` cannot be rolled back
to — it pulls whatever `latest` is now.

```bash
# kubectl
kubectl rollout history deployment/backend -n production
kubectl rollout undo deployment/backend -n production [--to-revision=N]
kubectl rollout status deployment/backend -n production

# Helm
helm history myapp -n production
helm rollback myapp [REVISION] -n production --wait
```

Before trusting either: confirm history has more than one entry, and that the previous image tag
is still in the registry (retention policies prune tags). Write the exact command, with the real
names and namespace, into the repo's deploy README.

## Audit — Azure-K8s-specific gaps

- [ ] Image tag in manifest/values is substituted with `$(Build.BuildId)`/SHA at deploy time
- [ ] Deploy blocks until rollout completes (`--wait`, then `rollout status`)
- [ ] Probes and resource limits on every container
- [ ] Registry + cluster credentials via Service Connection / variable group only
- [ ] Separate namespaces (and credentials) for staging and production
- [ ] Rollback command documented with the real deployment/release name
