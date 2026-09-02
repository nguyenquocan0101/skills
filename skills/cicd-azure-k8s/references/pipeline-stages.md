# Pipeline Stages

## Stage 1 — Trigger

Trigger on pushes to the main/production branch only; give staging its own trigger if it exists.

```yaml
trigger:
  branches:
    include:
      - main
```

## Stage 2 — Validate

Before building the Docker image, fail fast on broken code — separate jobs/steps for frontend and backend if both exist:

```yaml
- stage: Validate
  jobs:
    - job: ValidateBackend
      steps:
        - script: dotnet restore && dotnet build && dotnet test
    - job: ValidateFrontend
      steps:
        - script: npm ci && npm run lint && npm test
```

A red Validate stage must block Build — never let broken code reach the registry.

## Stage 3 — Build Docker images

One image per service. Tag with `Build.BuildId` and/or the commit SHA — never only `latest`.

```yaml
- stage: Build
  jobs:
    - job: BuildImages
      steps:
        - task: Docker@2
          inputs:
            command: buildAndPush
            repository: myorg/backend
            dockerfile: backend/Dockerfile
            containerRegistry: $(registryServiceConnection)
            tags: |
              $(Build.BuildId)
              latest
```

`containerRegistry` points at an Azure DevOps **Service Connection** (Docker Registry type, pointing at DockerHub or Azure Container Registry) — never raw credentials in the YAML.

## Stage 4 — Push to registry

Covered by `Docker@2 buildAndPush` above for most cases. If pushing manually with `docker push`, authenticate via `docker login` using credentials injected from a secret variable group, never literal strings.

DockerHub and Azure Container Registry (ACR) are both valid; ACR is the natural choice if the cluster is AKS (tighter IAM integration via managed identity), DockerHub is fine for K3s or when the team already standardizes on it. Don't switch registries mid-project without a stated reason.

## Stage 5 — Deploy to Kubernetes

Two valid tools — pick one per repo, don't mix:

**kubectl (plain manifests)**
```yaml
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

Always pass `--wait`/use a manifest-deploy task that blocks until rollout completes — a `kubectl apply`/`helm upgrade` that returns immediately reports pipeline success even if pods are crash-looping.

`kubernetesServiceConnection` / `k8sServiceConnection` is an Azure DevOps **Kubernetes service connection** (kubeconfig or Azure Resource Manager-based for AKS) — never a kubeconfig file committed to the repo.

## Stage 6 — Post-deploy verification

After the deploy task returns, explicitly check rollout health — don't trust the task's own exit code alone if it doesn't wait by default:

```yaml
- script: |
    kubectl rollout status deployment/backend -n production --timeout=180s
    curl -fsS https://api.example.com/health || exit 1
```

Fail the pipeline loudly on timeout or a failed health check — that's the signal to investigate or roll back (see `rollback.md`).
