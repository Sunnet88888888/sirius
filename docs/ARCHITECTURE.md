# Architecture (development environment)

## Containers on the server
| Stack | Service | Role |
|---|---|---|
| platform | `app` | One container: nginx, web (Next.js, :8000), API (FastAPI, :9000), collab (:4000) |
| platform | `db` | PostgreSQL 16 with pgvector |
| platform | `redis` | Cache, queues |
| judge0 | `server`, `workers`, `db`, `redis` | Code execution sandbox (privileged), reachable only from the platform over an internal Docker network |

## Network
- Public: port 80 of the server (HTTP, development only).
- Judge0 is not published; the platform reaches it as `http://judge0:2358` with a shared client id/secret.

## Host requirements
- cgroup v1 (kernel parameter `systemd.unified_cgroup_hierarchy=0`), required by Judge0 1.13.x.
- Docker with Compose.

## Configuration
All settings are environment variables in the stack's `.env` (never committed). Main groups: database, redis, auth secrets, initial admin, AI provider and models, Judge0 URL and credentials.

## AI
Provider and model tiers (fast / standard / pro) are set by environment. Embeddings use a separate provider setting (768 dimensions).

## Tenancy
Single organization mode.
