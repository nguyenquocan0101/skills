---
name: cicd-azure-k8s
description: "Design and review CI/CD pipelines for the Azure DevOps Pipelines → DockerHub/ACR → Kubernetes (K3s/AKS) deployment flow via kubectl or Helm. Covers Dockerfile authoring (Docker Compose is local-dev only here), azure-pipelines.yml structure, image tagging, Kubernetes manifest/Helm chart layout, rollout verification, and rollback. Use whenever the user wants Azure DevOps CI/CD, a Kubernetes/K3s/AKS deploy, a Helm chart pipeline, or describes deploying containers to a cluster rather than a VPS — even if they don't name Azure DevOps explicitly but describe building an image and deploying it with kubectl/Helm."
---

# CI/CD: Azure DevOps Pipelines → Registry → Kubernetes

This skill helps build a production-ready deployment pipeline for containerized apps deployed onto a Kubernetes cluster (K3s or AKS), CI'd through Azure DevOps Pipelines. The pipeline's job is to make builds reproducible and rollouts safe to reverse — never to build images on the cluster.

## Core flow

```
Push to GitHub → Azure DevOps Pipelines (validate/build/test) → Docker image →
push to DockerHub/ACR (tagged) → kubectl apply / helm upgrade --install →
rollout status check → smoke test (health endpoint) → rollback if failed
```

## References

| File | Covers |
|------|--------|
| `references/pipeline-stages.md` | Stage-by-stage breakdown: trigger, validate, build, push, deploy, verify |
| `references/manifests-and-helm.md` | Plain `k8s/` manifests vs Helm chart layout, when to pick which |
| `references/rollback.md` | Image tagging strategy, `kubectl rollout undo` / `helm rollback` procedures |
| `references/security-checklist.md` | Secrets via Service Connections/variable groups, RBAC, Dockerfile hardening |

## Non-negotiable principles

1. **Never build images on the cluster.** Azure Pipelines builds and pushes; the cluster only ever pulls. If a deploy step runs `docker build` against a cluster node, that build belongs back in the pipeline.
2. **Never tag only `latest`.** A Kubernetes `Deployment` referencing `:latest` makes both rollout and rollback ambiguous — `kubectl rollout undo` rolls back the *manifest*, but if the manifest still says `:latest`, the "old" revision pulls whatever `latest` currently points to, which may not be the previous image at all. Always tag with the commit SHA or Azure Pipelines `Build.BuildId`, and put that exact tag in the manifest/Helm values at deploy time.
3. **No secrets in YAML.** Registry credentials and cluster access (kubeconfig or a Kubernetes service connection) live in Azure DevOps **Service Connections** and **variable groups** (marked secret in the Library), never hardcoded in `azure-pipelines.yml` or committed manifests.
4. **Validate before building.** Lint/test/build-check the frontend and backend before the Docker build stage — a pipeline that builds and pushes broken code just automates shipping bugs faster.
5. **Have a health/readiness endpoint and use it twice.** Once as the Kubernetes `readinessProbe`/`livenessProbe`, once as the pipeline's post-deploy smoke test — a `Running` pod is not the same as a working app.
6. **Know your rollback path before you need it.** Decide in advance: `kubectl rollout undo deployment/<name>` (plain manifests) or `helm rollback <release> <revision>` (Helm). Verify the previous revision's image tag is still pullable from the registry — don't discover during an incident that it was pruned.
7. **Docker Compose is local-dev only in this flow.** It never appears in the deploy path — if `docker-compose.prod.yml` is doing the real deploying, that's the Dokploy track (`cicd-dokploy`), not this one. Don't mix the two: a repo is either Dokploy-deployed or Kubernetes-deployed, not both.

## When reviewing an existing pipeline

Check for these failure patterns first — they're the most common gaps:
- Deploy trigger fires from any branch, not just `main`/`master`
- Image only tagged `latest` in the manifest/Helm values, no commit-SHA or Build ID tag substituted at deploy time
- Manifests/chart committed with no `readinessProbe`/`livenessProbe`
- Registry credentials or kubeconfig referenced as plain strings instead of a Service Connection / `$(variableGroup.secret)`
- No `namespace` separation between staging and production
- `kubectl apply`/`helm upgrade` run with no `--wait`/rollout-status check afterward, so a broken rollout reports pipeline success anyway
- No documented rollback command for this specific deployment/release name

Read the relevant reference file before making detailed recommendations — don't guess at `kubectl`/Helm flags or Azure Pipelines YAML syntax from memory.


---

## Host compatibility

Subagent, hook and task-list names in this workflow map differently per host — see
`../../references/host-compatibility.md` for the table (Antigravity, Claude Code, Codex, plain
CLI) and `../../agents/` for the subagent definitions. If something referenced here isn't
available, do the equivalent step inline, keep the same artifacts and verification gates, and say
in one line which fallback you used. Skipping a gate silently is the only unacceptable fallback.
