# Folder Design

## Overview

This document describes the **monorepo folder layout** for the **sparkle‑version‑003** project.  The goal is to keep the codebase easy to navigate, enable independent development of the UI, API and Android client, and provide a clear place for shared utilities and documentation.

---

## Desired Root Structure

```
sparkle-version-003/
│
├─ frontend/                # React + Vite UI
│   ├─ src/
│   ├─ public/
│   ├─ vite.config.ts
│   └─ tsconfig.json
│
├─ backend/                 # Node / Express server, DB, sockets, workers
│   ├─ server.js
│   ├─ routes/
│   ├─ controllers/
│   ├─ middleware/
│   ├─ models/
│   ├─ migrations/
│   ├─ prisma/
│   ├─ socket/
│   ├─ services/
│   ├─ validators/
│   ├─ jobs/
│   ├─ workers/
│   ├─ utils/
│   ├─ config/
│   └─ helpers/
│
├─ android/                 # Capacitor / native Android project
│   └─ (Android Studio files)
│
├─ docs/                    # Centralised documentation, design, API spec
│   ├─ README.md
│   ├─ UI_AUDIT.md
│   ├─ ALGORITHMS.md
│   ├─ RESEARCH_FINDINGS.md
│   ├─ architecture.md
│   └─ route-audit.md
│
├─ shared/                  # (optional) shared TS types, constants, utilities
│   └─ …
│
├─ scripts/                 # Build, lint, migration, load‑test helpers
│   └─ …
│
├─ tests/                   # Unit / integration / e2e test suites
│   └─ …
│
├─ .env
├─ .gitignore
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
└─ … (other top‑level config files)
```

---

## Rationale

| Folder | Reasoning |
|--------|-----------|
| **frontend/** | Holds all UI code.  Vite dev server runs here. |
| **backend/** | Isolates server‑side logic (Express routes, DB models, socket handling).  Allows independent start‑up (`npm run dev:backend`). |
| **android/** | Native Android / Capacitor project; builds the mobile client. |
| **docs/** | Central location for READMEs, design docs, API specifications, and the route‑audit file used during the re‑organisation. |
| **shared/** | Optional place for code (types, constants) that both frontend and backend need, exposed via a TS path alias (`@shared/*`). |
| **scripts/** | Helpers for migrations, load tests, CI scripts – kept top‑level to be reusable by any part of the repo. |
| **tests/** | Test suites for the whole project; can contain sub‑folders (`frontend/`, `backend/`, `e2e/`). |

---

## Future Considerations

* If the backend ever needs to be published as a separate service, the `backend/` folder can be extracted to its own repository with minimal friction because it already lives in isolation.
* The `shared/` package can be turned into a private npm package (`@sparkle/shared`) when independent versioning becomes desirable.
* CI is set up as a matrix (`frontend` | `backend`) so each part can be tested and linted in parallel.

---

## Next Steps

1. **Create the folder‑audit (`docs/route‑audit.md`)** – list every UI‑to‑API endpoint.
2. **Move the backend files** into `backend/` (using `git mv`).
3. **Update import paths** according to the audit.
4. **Add dev scripts** (`dev:frontend`, `dev:backend`, `dev`).
5. **Run full validation** (dev servers, tests, Android build).

---

*Document version:* 2026‑10‑09

## File Mapping

| Current Path | New Destination |
| ------------ | --------------- |
| .env | .env |
| .gitignore | .gitignore |
| .npmrc | .npmrc |
| ALGORITHMS.md | docs/ALGORITHMS.md |
| DELETIONS.md | docs/DELETIONS.md |
| FIXED_PROGRESS.md | docs/FIXED_PROGRESS.md |
| FIXES_NEEDED.md | docs/FIXES_NEEDED.md |
| README.md | README.md |
| RESEARCH_FINDINGS.md | docs/RESEARCH_FINDINGS.md |
| UI_AUDIT.md | docs/UI_AUDIT.md |
| agent.md | docs/agent.md |
| android/ | android/ |
| api-inventory.json | docs/api-inventory.json |
| api-inventory.txt | docs/api-inventory.txt |
| capacitor.config.json | capacitor.config.json |
| config/ | backend/config/ |
| controllers/ | backend/controllers/ |
| data/ | backend/data/ |
| db.sql | backend/data/db.sql |
| discovery-logic.md | docs/discovery-logic.md |
| folder-design.md | docs/folder-design.md |
| frontend/ | frontend/ |
| generate-api-inventory.js | scripts/generate-api-inventory.js |
| generate-sparkle-api-inventory.js | scripts/generate-sparkle-api-inventory.js |
| helpers/ | backend/helpers/ |
| implementation_plan.md | docs/implementation_plan.md |
| jobs/ | backend/jobs/ |
| manifest.json | manifest.json |
| middleware/ | backend/middleware/ |
| migrations/ | backend/migrations/ |
| models/ | backend/models/ |
| moments-production-architecture.md | docs/moments-production-architecture.md |
| node_modules/ | (ignored) |
| package-lock.json | package-lock.json |
| package.json | package.json |
| prisma/ | backend/prisma/ |
| public/ | frontend/public/ |
| results/ | backend/results/ |
| routes/ | backend/routes/ |
| schemas/ | backend/schemas/ |
| scripts/ | scripts/ |
| server.js | backend/server.js |
| services/ | backend/services/ |
| socket/ | backend/socket/ |
| sparkle-api-inventory.json | docs/sparkle-api-inventory.json |
| sparkle-api-inventory.txt | docs/sparkle-api-inventory.txt |
| sparkle-load-test-auth-read.json | scripts/sparkle-load-test-auth-read.json |
| sparkle-load-test-controlled-write.json | scripts/sparkle-load-test-controlled-write.json |
| sparkle-load-test-excluded.json | scripts/sparkle-load-test-excluded.json |
| sparkle-load-test-safe.json | scripts/sparkle-load-test-safe.json |
| sparkle-load-test.js | scripts/sparkle-load-test.js |
| sparkle-phase1.js | scripts/sparkle-phase1.js |
| sparkly-knowledge/ | docs/sparkly-knowledge/ |
| src/ | backend/src/ |
| tailwind.config.js | frontend/tailwind.config.js |
| tests/ | tests/ |
| tools/ | scripts/tools/ |
| utils/ | backend/utils/ |
| validators/ | backend/validators/ |
| vercel.json | vercel.json |
| workers/ | backend/workers/ |

