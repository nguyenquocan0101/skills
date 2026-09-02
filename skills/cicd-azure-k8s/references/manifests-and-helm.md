# Manifests vs Helm

## Choosing between plain manifests and Helm

| Signal | Use |
|---|---|
| Single environment, one or two services, no per-env value overrides needed | Plain `k8s/` manifests |
| Multiple environments (staging/prod) needing different replica counts, resource limits, or hostnames | Helm chart with `values.yaml` per environment |
| Team already has Helm experience / other charts in the org | Helm |
| Want the simplest thing that works, no templating | Plain manifests |

Don't default to Helm just because it's more "production-grade" — a two-service app with one environment doesn't need templating overhead it doesn't use.

## Plain manifest layout

```
k8s/
  namespace.yaml
  backend-deployment.yaml
  backend-service.yaml
  frontend-deployment.yaml
  frontend-service.yaml
  ingress.yaml
  configmap.yaml
  secret.yaml          # only as a template — real values injected at deploy time, never committed with real values
```

Minimum required fields on every `Deployment`:
- `spec.template.spec.containers[].image` — pinned to a tag, substituted by the pipeline (`$(Build.BuildId)`), never `:latest` in committed YAML
- `readinessProbe` and `livenessProbe` hitting the app's health endpoint
- `resources.requests`/`resources.limits` — no unbounded pods
- `imagePullSecrets` if the registry is private

`secret.yaml` should be a template with placeholder keys; actual secret values are created via `kubectl create secret` from pipeline variables, or via a sealed-secrets/external-secrets setup if the project has one — never committed with real values.

## Helm chart layout

```
helm/myapp/
  Chart.yaml
  values.yaml           # defaults
  values-staging.yaml   # override per environment
  values-production.yaml
  templates/
    deployment.yaml
    service.yaml
    ingress.yaml
    configmap.yaml
    secret.yaml
    _helpers.tpl
```

Image tag is always a `values.yaml` field overridden at deploy time:

```yaml
image:
  repository: myorg/backend
  tag: latest   # overridden by --set image.tag=$(Build.BuildId) in the pipeline
```

Never hardcode the tag in `templates/deployment.yaml` itself — it must read `{{ .Values.image.tag }}` so the pipeline's `--set`/`-f values-production.yaml` actually controls what gets deployed.

## Ingress, domain, TLS

Out of scope for the pipeline itself — these are cluster-level/ingress-controller concerns set up once (e.g., `ingress-nginx` + `cert-manager` for automatic TLS via Let's Encrypt). The pipeline only ships the `Ingress` resource referencing the right host/TLS secret name; it doesn't provision the ingress controller or certificates.
