# Environments and Scaling Beyond One VPS

## Staging vs production

Run at least two environments before treating this pipeline as production-grade:

**Staging**
```
Push to staging branch → build image → deploy to staging Dokploy app
```
Use staging to validate a release before it touches production — same Dockerfile/compose, different Dokploy application and environment variables.

**Production**
```
Merge to main → build image → push to DockerHub → trigger Dokploy production deploy via API
```
If the team's risk tolerance warrants it, gate production deploys behind a manual approval step (GitHub Environments with required reviewers is the standard way to do this in Actions).

Keep staging and production secrets fully separate — a leaked staging credential should never expose production.

## When to consider Kubernetes

Don't reach for Kubernetes by default. This Docker Compose + Dokploy + CI/CD flow is the right fit for a single VPS or a small number of services. Only consider migrating when concrete needs show up:

- Multiple services need to scale independently
- Workload spans multiple servers/nodes
- Rolling updates need finer control than Dokploy's restart model provides
- Self-healing requirements exceed what a single Docker Compose host can offer
- Internal service discovery is needed across many services
- An ingress controller or autoscaling is genuinely required
- Secret/config management needs to be more structured (e.g., per-namespace, dynamic)
- GitOps (Argo CD, Flux) is wanted for declarative, auditable deploys

Get the Docker Compose + Dokploy + CI/CD flow fully solid first — image tagging, health checks, rollback, secrets — before adding Kubernetes' operational complexity on top.
