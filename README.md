# 🎯 TalentShowcase — Enterprise Internal Talent Showcase & AI-Powered Review System

**Status:** Phase 1 MVP (In Development)  
**Version:** 0.1.0  
**Team:** 2–5 engineers · **Timeline:** 6 months · **Target:** Production ready for real users

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

### 5. Login

Open [http://localhost:3000](http://localhost:3000)

**Test credentials** (seed these in the auth module):
```
Email: alice@company.com
Password: password123
Role: TALENT

Email: bob@company.com
Password: password123
Role: HR_ADMIN
```

---

## 📁 Project Structure

```
my-fullstack-agent-app/
├── apps/
│   ├── api/                    # NestJS backend
│   │   ├── src/
│   │   │   ├── auth/           # OAuth/OIDC, JWT, RBAC
│   │   │   ├── projects/       # Project CRUD, submission
│   │   │   ├── reviews/        # Peer reviews
│   │   │   ├── users/          # User management
│   │   │   ├── ai/             # Explain Agent, AI orchestration
│   │   │   ├── notifications/  # WebSocket gateway
│   │   │   ├── app.module.ts   # App root
│   │   │   └── main.ts         # Bootstrap
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                    # Next.js frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── login/      # Login page
│       │   │   ├── discover/   # Project discovery grid
│       │   │   ├── submit/     # Submit project wizard
│       │   │   ├── projects/[id]/  # Project detail + AI report
│       │   │   ├── layout.tsx  # Root layout
│       │   │   └── globals.css # Tailwind styles
│       │   ├── components/
│       │   │   ├── ui/         # Button, Card, Badge (shadcn-style)
│       │   │   ├── navbar.tsx  # Navigation header
│       │   │   └── project-card.tsx  # Masonry card
│       │   └── lib/
│       │       ├── api.ts      # API client
│       │       ├── auth-context.tsx  # Auth state management
│       │       └── utils.ts    # Helper functions
│       ├── package.json
│       ├── tsconfig.json
│       └── next.config.mjs
├── packages/
│   └── types/                  # Shared TypeScript types + Zod schemas
│       ├── src/
│       │   ├── user.ts         # User types, roles
│       │   ├── project.ts      # Project types, enums
│       │   ├── review.ts       # Review types
│       │   ├── ai.ts           # AI agent outputs, ExplainReport
│       │   ├── api.ts          # API response enums
│       │   ├── enums.ts        # Shared enums
│       │   └── index.ts        # Barrel export
│       └── package.json
├── docker-compose.yml          # Local dev infrastructure
├── pnpm-workspace.yaml         # Monorepo config
├── tsconfig.base.json          # Shared TS config
├── package.json                # Root package + scripts
├── PRD.md                       # Product Requirements Document
├── ARCHITECTURE.md             # Technical architecture (deferred)
└── README.md                   # This file
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

## 🧠 AI System (Phase 1: Explain Agent)

### Explain Agent
**Converts technical work into business-friendly language**

**Input:**
```
- Project title: "Customer Churn Predictor"
- Type: ML_MODEL
- Tech: ["Python", "XGBoost", "Pandas", "Scikit-learn"]
- Files: train.py (250 lines, Python), data.csv, README.md
```

**LLM Prompt:**
```
Generate a multi-tier explanation report for the following project:
- Executive summary: 2-3 sentences (business value, impact)
- Manager summary: 2-3 sentences (scope, effort, outcomes)
- Peer summary: 2-3 sentences (technical approach, quality)
- Analogies: 2-3 simple analogies for non-tech audiences
- Key highlights: 3-5 notable strengths
- Confidence score: 0-100
```

**Output:**
```json
{
  "executiveSummary": "This ML model predicts customer churn with 92% accuracy, enabling proactive retention efforts and estimated $2M annual savings.",
  "managerSummary": "Developed a production-ready predictive model using 18 months of historical data. 2-week sprint effort with 3 team members. Achieves 92% accuracy and 87% precision.",
  "peerSummary": "Well-structured feature engineering pipeline. Used XGBoost with cross-validation. Good hyperparameter tuning, though could benefit from ensemble methods.",
  "analogies": [
    "Like a crystal ball that predicts which customers will leave so you can keep them happy.",
    "Similar to a medical diagnostic tool that flags patients at risk before they get sick."
  ],
  "keyHighlights": [
    "92% accuracy on hold-out test set",
    "Production-ready deployment pipeline",
    "Clear documentation and business value"
  ],
  "confidenceScore": 88
}
```

**LLM Models Supported:**
- GLM 4-Flash (free)
- DeepSeek V4 Flash (free)
- OpenAI GPT-4o (paid, future)

**Fallback:** When LLM unavailable, returns deterministic template report

---

## 📊 API Endpoints (Phase 1)

### Authentication
```
POST   /auth/login              # { email, password } → { accessToken, user }
POST   /auth/refresh            # refresh access token
GET    /auth/me                 # current user profile
```

### Projects
```
POST   /projects                # create draft project
GET    /projects                # browse all (with search, filter, sort)
GET    /projects/:id            # get project detail
PATCH  /projects/:id            # update project
POST   /projects/:id/submit     # submit for review (DRAFT → SUBMITTED)
GET    /projects/:id/files      # list project files
```

### AI
```
POST   /projects/:id/ai/explain       # generate Explain Agent report (sync in Phase 1)
GET    /projects/:id/ai/report        # fetch AI report
GET    /projects/:id/ai/interactions  # audit trail of LLM calls
```

### Reviews (Phase 2+)
```
POST   /projects/:id/reviews    # create peer/AI review
GET    /projects/:id/reviews    # list reviews
POST   /reviews/:id/approve     # HR_ADMIN approves
POST   /reviews/:id/reject      # HR_ADMIN rejects
```

See `apps/api/src/*/controllers` for full endpoint specs and request/response schemas.

---

## 🧪 Testing

### Run All Tests
```bash
pnpm test
```

### Unit Tests
```bash
pnpm test --watch
```

### Integration Tests (require Docker infrastructure)
```bash
pnpm test:integration
```

### E2E Tests (Phase 2+)
```bash
pnpm test:e2e
```

### Type Checking
```bash
pnpm typecheck
```

### Linting
```bash
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
- **API Docs** — Generated OpenAPI 3.1 spec at `http://localhost:4000/api/v1/api-docs` (Phase 2)
- **Figma** — UI kit and component library (coming soon)

---

## 🗂️ Key Files Reference

| File | Purpose |
|---|---|
| `packages/types/src/index.ts` | Export all shared types |
| `apps/api/src/app.module.ts` | NestJS root module, imports all services |
| `apps/api/src/ai/explain.agent.ts` | Explain Agent implementation |
| `apps/api/src/ai/ai.service.ts` | AI orchestration (runs agents, persists reports) |
| `apps/web/src/lib/auth-context.tsx` | Frontend auth state + login logic |
| `apps/web/src/app/discover/page.tsx` | Project discovery grid |
| `apps/web/src/app/projects/[id]/page.tsx` | Project detail + AI report viewer |

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
- [x] Auth (OAuth/OIDC, JWT, RBAC)
- [x] Project CRUD + submission
- [x] Discovery grid (search, filter, sort)
- [x] Explain Agent + AI report
- [x] Frontend (5 pages)
- [x] Docker Compose local dev

### 📋 Phase 2 (Months 3–4) — Core Platform
- [ ] File upload (resumable, virus scan)
- [ ] gVisor sandbox + live preview
- [ ] Code Analyst + Security Scanner agents
- [ ] Review workflow (peer + AI)
- [ ] Async AI pipeline (RabbitMQ workers)
- [ ] Inline comments on files

### 🚀 Phase 3 (Months 5–6) — Enterprise
- [ ] Evaluation & Career Advisor agents
- [ ] Skill radar chart + comparison mode
- [ ] Audit dashboard
- [ ] SSO/SAML
- [ ] Performance optimization
- [ ] Load testing (100 concurrent sessions)

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