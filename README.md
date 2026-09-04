# 🎯 TalentShowcase — Enterprise Internal Talent Showcase & AI-Powered Review System

**Status:** Phase 1 + Phase 2 + Phase 3 — Feature Complete ✅  
**Version:** 2.0.0  
**Stack:** NestJS · Next.js 15 · PostgreSQL · MinIO · RabbitMQ · GLM/LLM agents  
**Verified:** 47/47 API smoke tests · full browser E2E journey · pnpm monorepo builds clean

---

## 📋 What is TalentShowcase?

TalentShowcase is an enterprise-internal platform that enables IT talent to showcase technical work products (fullstack apps, data analysis, ML models, APIs, scripts) and allows non-technical stakeholders (HR, department heads, business units) to discover, interact with live previews, and receive **AI-generated explanations, evaluations, and career recommendations**.

**In plain English:** A GitHub-for-internal-talent meets Figma-meets-Slack — where engineers submit work, non-tech folks can actually understand it via AI, and business decisions are informed by both human and AI review.

---

## 🚀 Quick Start

### Prerequisites
- **Node:** 22+ LTS
- **pnpm:** 10+
- **Docker & Docker Compose:** latest stable
- **Git:** latest stable

### 1. Clone & Install

```bash
git clone https://github.com/Dalfino/my-fullstack-agent-app.git
cd my-fullstack-agent-app

pnpm install
```

### 2. Start Infrastructure

```bash
docker-compose up -d

# Verify all services are healthy:
docker-compose ps
```

**Services started:**
- **PostgreSQL 16** (port 5432) — primary database + pgvector for embeddings
- **Redis 7** (port 6379) — sessions, cache, pub/sub
- **MinIO** (port 9000/9001) — S3-compatible file storage
- **RabbitMQ** (port 5672/15672) — message queue for async AI pipeline

### 3. Configure Environment

```bash
# API
cp apps/api/.env.example apps/api/.env

# Web
cp apps/web/.env.example apps/web/.env
```

**Key env vars to customize:**
- `LLM_API_KEY` — your GLM/DeepSeek API key (leave empty for deterministic fallback)
- `CORS_ORIGIN` — frontend URL for CORS (default: `http://localhost:3000`)
- `DB_*` — database credentials (match docker-compose.yml defaults)

### 4. Start Development Servers

```bash
# Run both frontend + backend in parallel
pnpm dev

# Or run separately:
# Terminal 1: pnpm dev:api   (NestJS on http://localhost:4000/api/v1)
# Terminal 2: pnpm dev:web   (Next.js on http://localhost:3000)
```

### 5. Seed Demo Data (recommended)

```bash
# Creates 4 users, 2 projects with real files, a peer review and skill assessments
node scripts/seed.mjs --force
```

### 6. Login

Open [http://localhost:3000](http://localhost:3000)

**Test credentials** (all use password `password123`):
```
alice@company.com   TALENT    (owns 2 demo projects)
carol@company.com   TALENT    (owns the forecasting pipeline)
dave@company.com    REVIEWER  (can review, comment, start reviews)
bob@company.com     HR_ADMIN  (decision gate, admin dashboard, audit log)
```

### Dockerless mode (no Docker installed?)

The API degrades gracefully when infra is missing — perfect for sandboxes and CI:

- **Database:** `node scripts/dev-db.mjs` boots an embedded PostgreSQL 18 (data in `.pgdata/`)
- **Storage:** `STORAGE_DRIVER=auto` (default) uses MinIO when reachable, else local disk (`.storage/`)
- **Queue:** set `RABBITMQ_URL` to use RabbitMQ; when unset (or unreachable) jobs run on a durable in-process worker loop backed by the `queue_job` table

```bash
# Full stack without Docker:
node scripts/dev-db.mjs &      # embedded postgres
pnpm dev                       # api + web
node scripts/seed.mjs --force  # demo data
```

---

## 📁 Project Structure

```
my-fullstack-agent-app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # JWT + RBAC + MFA (TOTP via otplib)
│   │   │   ├── projects/       # CRUD, submission, status transitions, file upload/preview
│   │   │   ├── comments/       # Inline comments (threads, resolve flow)
│   │   │   ├── reviews/        # Peer reviews + approve/reject
│   │   │   ├── users/          # User management + seeds
│   │   │   ├── ai/             # 5 agents + orchestration + LLM client
│   │   │   │   └── agents/     # explain, code-analyst, security-scanner, evaluation, career-advisor
│   │   │   ├── queue/          # Durable job queue (RabbitMQ / in-process fallback)
│   │   │   ├── storage/        # MinIO + local-disk fallback, deterministic virus scan
│   │   │   ├── assessments/    # Skill assessments, radar, comparison
│   │   │   ├── audit/          # Immutable audit trail + admin query endpoints
│   │   │   ├── admin/          # User management + platform stats
│   │   │   ├── notifications/  # Socket.IO gateway (JWT-verified, per-user rooms)
│   │   │   ├── app.module.ts   # App root
│   │   │   └── main.ts         # Bootstrap + Swagger
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # Next.js 15 frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/      # Login + MFA code step
│       │   │   ├── discover/   # Project discovery grid
│       │   │   ├── submit/     # Submit project wizard
│       │   │   ├── projects/[id]/  # Tabbed workspace: Overview / AI Reports / Files / Reviews
│       │   │   ├── radar/      # Skill radar + comparison + career advisor
│       │   │   ├── settings/   # Profile + MFA enrolment (QR)
│       │   │   ├── admin/      # HR dashboard: users, roles, stats, audit log
│       │   │   ├── layout.tsx  # Root layout
│       │   │   └── globals.css # Tailwind styles
│       │   ├── components/
│       │   │   ├── ui/         # Button, Card, Badge (shadcn-style)
│       │   │   ├── navbar.tsx  # Role-aware navigation
│       │   │   ├── file-viewer.tsx   # Code preview + inline comments
│       │   │   ├── radar-chart.tsx   # Dependency-free SVG radar
│       │   │   └── project-card.tsx
│       │   └── lib/
│       │       ├── api.ts      # API client + multipart upload + job polling
│       │       ├── auth-context.tsx  # Auth + MFA state management
│       │       └── utils.ts
│       └── next.config.mjs     # Proxies /api/v1/* to the API (single origin)
├── packages/
│   └── types/                  # Shared TypeScript types + Zod schemas
├── scripts/
│   ├── dev-db.mjs              # Embedded PostgreSQL launcher (no Docker needed)
│   ├── seed.mjs                # Demo users/projects/reviews/skills
│   ├── smoke-test.mjs          # 47-check API test suite
│   └── run-smoke.sh            # Boots DB+API, runs smoke tests
├── load/
│   └── smoke.js                # k6 load test (run: k6 run load/smoke.js)
├── docker-compose.yml          # Local dev infrastructure
└── README.md
```

---

## 🏗️ Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js 15)                    │
│  Login → Discover → Submit → Detail → AI Report             │
└──────────────────────┬──────────────────────────────────────┘
                       │ REST + TLS 1.3
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    API GATEWAY (NestJS)                     │
│  ├─ Auth Service (OAuth/OIDC + JWT + MFA)                  │
│  ├─ Project Service (CRUD, submission, visibility)         │
│  ├─ Review Service (peer/AI reviews)                       │
│  ├─ AI Service (Explain Agent orchestration)              │
│  └─ Notifications (WebSocket)                              │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
    ┌────────┐   ┌────────┐    ┌──────────┐
    │  PG 16 │   │ Redis  │    │  MinIO   │
    │ +pgv.  │   │  7     │    │  S3      │
    └────────┘   └────────┘    └──────────┘
        ▲              ▲              ▲
        │ Metadata,    │ Sessions,    │ Project
        │ Reviews,     │ Cache,       │ Files,
        │ AI Reports   │ Pub/Sub      │ Artifacts

                    RabbitMQ
                       ▲
                       │
                ┌──────┴───────┐
                ▼              ▼
         [Explain Agent]  [Future Agents]
            (LLM Call)     Phase 2+
             GLM/DeepSeek
```

---

## 🔐 Security & Auth

### Authentication Flow
1. User enters email + password on `/login`
2. Backend validates credentials, returns JWT + user profile
3. JWT stored in localStorage (dev) / secure cookie (prod)
4. All subsequent requests include `Authorization: Bearer <JWT>`
5. Backend validates JWT via `JwtAuthGuard` + `RolesGuard`

### Authorization
- **RBAC:** Four roles: `TALENT`, `REVIEWER`, `HR_ADMIN`, `DEPT_HEAD`
- **Visibility:** Projects can be `PRIVATE`, `TEAM`, `DEPT`, `COMPANY`
- **Guards:** `@UseGuards(JwtAuthGuard, RolesGuard)` on all protected endpoints

### Secrets Management
- **Dev:** `.env` files with plaintext secrets (development only)
- **Prod:** HashiCorp Vault for secret rotation (Phase 2)

---

## 🧠 AI System (5 Agents, All Async via Queue)

All agent runs are **asynchronous**: `POST` endpoints enqueue a durable job and return `{ jobId }` immediately. Clients poll `GET /jobs/:id` or subscribe to the `ai:report-ready` Socket.IO event. Every agent blends **deterministic tooling for facts** with **LLM narrative for explanations**, and degrades to a fully deterministic report when no `LLM_API_KEY` is configured.

| Agent | Endpoint | What it does |
|---|---|---|
| **Explain** | `POST /projects/:id/ai/explain` | Multi-tier business translation (exec / manager / peer) |
| **Code Analyst** | `POST /projects/:id/ai/code-analysis` | Repo stats: languages, complexity heuristics, architecture narrative |
| **Security Scanner** | `POST /projects/:id/ai/security-scan` | 8 deterministic rule classes (secrets, SQLi, XSS, eval, weak crypto…) + risk rating |
| **Evaluation** | `POST /projects/:id/ai/evaluation` | 5-criterion scoring, detected skills → skill radar, writes the AI review feeding the HR decision gate |
| **Career Advisor** | `POST /ai/career-advisor` | Radar-driven gaps, learning roadmap, career-path fit |

**LLM Models Supported:** GLM 4-Flash (default), any OpenAI-compatible endpoint, deterministic fallback when no key.

---

## 📊 API Endpoints

Interactive docs: **http://localhost:4000/docs** (Swagger/OpenAPI generated from NestJS).

### Auth & MFA
```
POST   /auth/login                 # → tokens, or { mfaRequired, mfaTicket }
POST   /auth/mfa/verify            # { ticket, code } → tokens
POST   /auth/mfa/setup             # → { secret, otpauthUrl, qrDataUrl }
POST   /auth/mfa/enable            # confirm first TOTP code
POST   /auth/mfa/disable           # final TOTP code required
GET    /auth/me                    # current user
```

### Projects & Files
```
POST   /projects                        # create draft
GET    /projects                        # search/filter/sort (visibility-aware)
GET    /projects/:id                    # detail
PATCH  /projects/:id                    # update
POST   /projects/:id/status             # submit | start-review | needs-work | approve | archive
POST   /projects/:id/files              # multipart upload + virus scan
GET    /projects/:id/files              # list
GET    /projects/:id/files/:fid/content # line-addressable text preview
DELETE /projects/:id/files/:fid
```

### Comments
```
POST   /projects/:id/comments           # { fileId, body, lineNumber, parentCommentId? }
GET    /projects/:id/comments?fileId=   # grouped threads
PATCH  /comments/:id                    # edit / resolve / reopen
DELETE /comments/:id
```

### AI & Jobs
```
POST   /projects/:id/ai/{explain|code-analysis|security-scan|evaluation}
POST   /ai/career-advisor               # { userId? } (self by default)
GET    /projects/:id/ai/reports         # all reports
GET    /projects/:id/ai/report?agentType=
GET    /jobs/:id                        # queue job status
GET    /jobs                            # recent jobs + transport mode
```

### Reviews
```
POST   /projects/:id/reviews            # create peer review
GET    /projects/:id/reviews
POST   /reviews/:id/decide              # HR: { APPROVE | REJECT }
```

### Skills (radar)
```
GET    /users/:id/skill-radar           # 9-axis radar
GET    /users/:id/skill-assessments
GET    /skill-radar/compare?userA&userB
```

### Admin (HR_ADMIN only)
```
GET    /admin/users?search&role&page
PATCH  /admin/users/:id/role
GET    /admin/stats
GET    /admin/audit-logs?actorId&action&from&to&page
GET    /admin/audit-logs/stats
```

### Status transitions & decision gate
`DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED → ARCHIVED`, with `needs-work` sending back to DRAFT. The `approve` action is gated: **at least one human-approved review is required**, enforced server-side.

---

## 🧪 Testing

### Full API Smoke Suite (47 checks)
```bash
# Boots embedded Postgres + API, seeds, runs everything, tears down
bash scripts/run-smoke.sh
```
Covers: health, auth (+bad credentials), visibility, file upload + EICAR virus rejection, preview, comment threads + resolve, all 5 agents end-to-end through the queue, decision-gate enforcement, admin RBAC, audit trail, full MFA enrolment/login/disable cycle, Swagger.

### Load Testing (k6)
```bash
k6 run load/smoke.js                    # default: 30s ramp to 50 VUs
BASE_URL=http://staging:4000 k6 run load/smoke.js
```

### Unit / Type / Lint
```bash
pnpm test          # jest unit tests
pnpm typecheck     # tsc --noEmit across the monorepo
pnpm lint
```

---

## 📦 Build & Deploy

### Build for Production
```bash
pnpm build
```

Outputs:
- `apps/api/dist/` — compiled NestJS app
- `apps/web/.next/` — optimized Next.js build

### Run in Production Mode
```bash
# Terminal 1: API
pnpm --filter @talentshowcase/api start:prod

# Terminal 2: Web
pnpm --filter @talentshowcase/web start
```

### Docker Production Build (coming soon)
```bash
docker build -f apps/api/Dockerfile -t talentshowcase-api:latest .
docker build -f apps/web/Dockerfile -t talentshowcase-web:latest .
```

---

## 📚 Documentation

- **[PRD.md](./PRD.md)** — Product Requirements Document (features, requirements, success metrics)
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** — Technical architecture (deferred — full schema, API contracts, security deep-dive)
- **API Docs** — Swagger/OpenAPI at `http://localhost:4000/docs`
- **Figma** — UI kit and component library (coming soon)

---

## 🗂️ Key Files Reference

| File | Purpose |
|---|---|
| `packages/types/src/index.ts` | Export all shared types + zod schemas |
| `apps/api/src/app.module.ts` | NestJS root module, wires all 12 feature modules |
| `apps/api/src/ai/agents/*.ts` | The 5 AI agents (explain, code-analyst, security, evaluation, career) |
| `apps/api/src/ai/ai.service.ts` | AI orchestration + queue handler registration |
| `apps/api/src/queue/queue.service.ts` | Durable queue (RabbitMQ / in-process, SKIP LOCKED worker) |
| `apps/api/src/storage/storage.service.ts` | MinIO / local-disk storage abstraction |
| `apps/api/src/storage/virus-scan.service.ts` | Deterministic malware/content scanner |
| `apps/api/src/projects/projects.service.ts` | Status transitions + decision gate |
| `apps/api/src/auth/mfa.service.ts` | TOTP enrolment + verification (otplib v13) |
| `apps/api/src/audit/audit.service.ts` | Immutable audit trail (22 action types) |
| `apps/web/src/lib/auth-context.tsx` | Auth + MFA challenge state |
| `apps/web/src/components/file-viewer.tsx` | Code preview + inline comment threads |
| `apps/web/src/components/radar-chart.tsx` | Dependency-free SVG skill radar |
| `scripts/smoke-test.mjs` | 47-check API verification suite |

---

## 🐛 Troubleshooting

### Docker won't start
```bash
# Check logs
docker-compose logs postgres

# Nuke and rebuild
docker-compose down -v
docker-compose up -d
```

### API port 4000 already in use
```bash
# Kill the process
lsof -i :4000 | grep LISTEN | awk '{print $2}' | xargs kill -9

# Or change PORT in .env
PORT=4001 pnpm dev:api
```

### Frontend can't connect to API
- Check `NEXT_PUBLIC_API_URL` in `apps/web/.env`
- Ensure `CORS_ORIGIN` in `apps/api/.env` includes frontend URL
- Verify API is running: `curl http://localhost:4000/api/v1/health`

### Postgres connection refused
```bash
docker-compose logs postgres

# Reset DB
docker-compose down -v
docker-compose up -d postgres
# Wait ~30s for postgres to be ready
pnpm dev:api
```

---

## 🎯 Phase Roadmap

### ✅ Phase 1 (Months 1–2) — MVP Complete
- [x] Auth (JWT, RBAC, MFA-ready)
- [x] Project CRUD + submission
- [x] Discovery grid (search, filter, sort)
- [x] Explain Agent + AI report
- [x] Frontend (5 pages)
- [x] Docker Compose local dev

### ✅ Phase 2 (Months 3–4) — Core Platform Complete
- [x] File upload (multipart, virus scan, MinIO + local fallback)
- [x] Code preview + inline comments (threads, resolve flow)
- [x] Code Analyst + Security Scanner agents
- [x] Review workflow (peer + AI) with decision gate
- [x] Async AI pipeline (RabbitMQ workers + in-process fallback)
- [ ] gVisor sandbox + live preview (deferred — needs privileged runtime)

### ✅ Phase 3 (Months 5–6) — Enterprise Complete
- [x] Evaluation & Career Advisor agents
- [x] Skill radar chart + comparison mode
- [x] Audit dashboard + admin user management
- [x] MFA (TOTP) enrolment + login challenge
- [x] Swagger/OpenAPI docs + k6 load testing
- [x] DB indexes + queue durability + orphan-job recovery
- [ ] SSO/SAML (deferred — requires enterprise IdP)

---

## 💬 Communication

**Questions or issues?**
- Open a GitHub issue: [Issues](https://github.com/Dalfino/my-fullstack-agent-app/issues)
- Check the [Discussions](https://github.com/Dalfino/my-fullstack-agent-app/discussions) for FAQ

**Contributing:**
All contributions must follow:
1. TypeScript strict mode
2. Zod validation on all inputs
3. Tests alongside code (TDD)
4. Security review before merge
5. No secrets in code or PRs

---

## 📄 License

[Your License Here]

---

## 🙏 Acknowledgments

Built with:
- [NestJS](https://nestjs.com/) — powerful Node.js framework
- [Next.js](https://nextjs.org/) — React framework for production
- [PostgreSQL](https://www.postgresql.org/) + [pgvector](https://github.com/pgvector/pgvector) — AI-ready database
- [LangChain](https://js.langchain.com/) — LLM orchestration (Phase 2)
- [Tailwind CSS](https://tailwindcss.com/) — utility-first styling
- [shadcn/ui](https://ui.shadcn.com/) — component design system

---

**Happy coding! 🚀**