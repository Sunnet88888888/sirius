# SIRIUS

Online school platform.

| Path | Content |
|---|---|
| `lms/` | The learning platform: `apps/api` (FastAPI), `apps/web` (Next.js), `apps/collab` (real-time server), `Dockerfile`, `docker/` |
| `docs/` | Architecture, runbook, work log, changelog, decisions |

Development stack: PostgreSQL (pgvector), Redis, the platform container, and a Judge0 sandbox for code tasks.
See `docs/ARCHITECTURE.md` and `docs/RUNBOOK.md`.

`lms/LICENSE` and the copyright notices in source files apply to the platform code and must be kept.
