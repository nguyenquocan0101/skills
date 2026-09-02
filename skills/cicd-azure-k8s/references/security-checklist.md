# Secrets and Security Checklist

## Sensitive values that must live in Azure DevOps Library (never in code or YAML literals)

- Registry credentials (DockerHub access token, or ACR via a Service Connection with managed identity — never an account password)
- Kubernetes cluster access — a Kubernetes service connection (kubeconfig, or ARM-based for AKS), never a kubeconfig file committed to the repo
- Production environment variables / app secrets (DB connection strings, API keys) — injected into the cluster as Kubernetes `Secret` objects created from pipeline variables, not committed YAML with real values
- Helm `values-production.yaml` should contain only non-sensitive defaults; secret values come from a separate `--set` injection or a Kubernetes `Secret` referenced by name

Reference variables as `$(variableGroupName.secretVarName)`, with the variable group's secret values marked secret in **Pipelines → Library** — never echoed in logs (`##vso[task.setvariable]` with `issecret=true` if a script needs to set one dynamically).

## Dockerfile hardening

Same as any containerized app — this isn't Kubernetes-specific:
- `.dockerignore` excludes `.git`, `.env`, `node_modules`/`bin`/`obj`, test fixtures
- Multi-stage builds to keep the final image minimal
- Non-root user for the app process where the runtime supports it
- `HEALTHCHECK` instruction (also useful as the basis for the K8s `readinessProbe`/`livenessProbe` command)
- Pin and periodically update base images

## Kubernetes-specific checklist

1. `imagePullSecrets` configured if the registry is private — don't make the registry public just to skip this.
2. RBAC: the Kubernetes service connection's credentials are scoped to the namespace(s) the pipeline actually needs, not full cluster-admin.
3. `NetworkPolicy` or namespace isolation between staging and production — a staging pod should not be able to reach production services by default.
4. Secrets in the cluster (`kubectl get secrets`) are never committed to the repo in plaintext form, including as "example" files with real values accidentally left in.
5. `resources.requests`/`resources.limits` set on every container — an unbounded pod can starve the node.
6. Readiness/liveness probes present — without them Kubernetes can route traffic to a pod that isn't actually ready, or never restart a hung one.
7. Image vulnerability scanning (Trivy, `docker scout`, or ACR's built-in scanning) added to the Build stage if the project's risk profile warrants it.
8. Clear separation between staging and production variable groups/service connections — a leaked staging credential should never expose production.
