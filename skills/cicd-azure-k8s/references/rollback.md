# Image Tagging and Rollback

## Why `latest` alone is dangerous here

A Kubernetes `Deployment` resolves its image tag at rollout time. If the manifest/chart says `:latest`, then "redeploy the previous revision" doesn't actually pull the previous image — it pulls whatever `latest` currently points to, which has likely already moved past the bad version. Rollback only works if every revision recorded a real, immutable tag.

## Tagging strategy

Tag every build with at least:

| Tag type | Example | Purpose |
|---|---|---|
| Build ID | `backend:2451` | Azure Pipelines' own immutable counter, always available as `$(Build.BuildId)` |
| Commit SHA | `backend:a1b2c3d` | Traceability to exact source, available as `$(Build.SourceVersion)` |
| `latest` | `backend:latest` | Convenience pointer only — never the value put in a manifest/Helm values |

The manifest/Helm values `image.tag` field must be set to the Build ID or commit SHA at deploy time — `--set image.tag=$(Build.BuildId)` (Helm) or the `containers:` substitution in `KubernetesManifest@1` (kubectl) — never left as `latest`.

## Rollback

**kubectl (plain manifests)**
```bash
kubectl rollout history deployment/backend -n production
kubectl rollout undo deployment/backend -n production              # previous revision
kubectl rollout undo deployment/backend -n production --to-revision=4  # specific revision
kubectl rollout status deployment/backend -n production            # confirm it actually came back healthy
```
This only works if `kubectl rollout history` actually has multiple revisions to roll back to — Kubernetes keeps revision history by default (`revisionHistoryLimit`), don't set it to 0 or 1.

**Helm**
```bash
helm history myapp -n production
helm rollback myapp <revision> -n production --wait
```
Helm tracks every `upgrade` as a revision automatically; `helm rollback` without a revision number rolls back to the immediately preceding one.

## Verify before you need it

Before relying on either command in an incident:
1. Confirm rollout/revision history actually has more than one entry (a fresh chart/deployment won't).
2. Confirm the previous image tag is still pullable from the registry — registries can be configured to prune old tags; if rollback target images get pruned, rollback becomes impossible no matter what `kubectl`/`helm` does.
3. Document the exact command (with the real deployment/release name and namespace) in the repo's deploy docs — don't make this something someone reconstructs from memory mid-incident.
