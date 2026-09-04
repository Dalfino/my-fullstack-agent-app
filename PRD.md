# 📘 TalentShowcase — Product Requirements Document (PRD)

> **Version:** 1.0 · **Date:** 2026-09-01 · **Status:** Approved for Build  
> **Team:** 2–5 engineers · **Timeline:** 6 months · **Target:** Working MVP for real users

---

## 1. Product Overview

### 1.1 Vision
TalentShowcase is an enterprise internal platform where IT talent submits technical work products (fullstack apps, data analysis, ML models, APIs, scripts) and non-technical stakeholders (HR, department heads, business units) discover, interact with live previews, and receive AI-generated explanations, evaluations, and career recommendations.

### 1.2 Goals
- Enable IT talent to showcase work products in a discoverable, browsable format
- Let non-technical stakeholders understand technical work without writing code
- Provide AI-assisted evaluation and career development insights
- Establish a human-in-the-loop review workflow (AI suggests, human approves)

### 1.3 Non-Goals (Out of Scope for MVP)
- Multi-tenant SaaS (single company only)
- SSO/SAML integration (deferred to Phase 3)
- Firecracker microVM sandbox (gVisor in Phase 1)
- Kubernetes orchestration (Docker Compose in Phase 1)
- MongoDB, Elasticsearch, Kafka, GraphQL (all cut/deferred)
- Interactive notebook execution (static render first)
- 6-agent AI system (3 agents max in MVP)

---

## 2. Target Users & Personas

| Persona | Role | Needs |
|---|---|---|
| **Talent** | IT staff submitting work | Easy upload, versioning, visibility into AI report |
| **Reviewer** | Peer/mentor | Comment on files, score against rubric |
| **HR Admin** | HR staff | Browse projects, view AI reports, make final decisions |
| **Dept Head** | Business unit leader | Discover talent, approve promotions, view skill radar |

### 2.1 Key User Journeys
1. **Talent submits a project** → upload → AI report generated → share with reviewers
2. **HR browses projects** → discovery grid → live preview → AI explanation → review
3. **Dept head evaluates talent** → skill radar → comparison → approve/reject recommendation

---

## 3. Functional Requirements

### 3.1 Authentication & Authorization (P0 = MVP)
| ID | Requirement | Priority |
|---|---|---|
| AUTH-1 | OAuth 2.0 + OIDC login with email/password | P0 |
| AUTH-2 | MFA via TOTP (enforced for HR_ADMIN and DEPT_HEAD) | P0 |
| AUTH-3 | RBAC roles: `TALENT`, `REVIEWER`, `HR_ADMIN`, `DEPT_HEAD` | P0 |
| AUTH-4 | Session management via Redis (short-lived access + refresh tokens) | P0 |
| AUTH-5 | ABAC rules via Casbin (dept-scoped visibility) | P1 |
| AUTH-6 | SSO/SAML integration | P2 (Phase 3) |

### 3.2 Project Management
| ID | Requirement | Priority |
|---|---|---|
| PROJ-1 | Create/edit project draft (title, description, type, tags, visibility) | P0 |
| PROJ-2 | Resumable file upload (tus protocol) to MinIO | P1 (Phase 2) |
| PROJ-3 | Project types: `FULLSTACK`, `DATA_ANALYSIS`, `ML_MODEL`, `API`, `SCRIPT`, `DESIGN` | P0 |
| PROJ-4 | Submit project → status `DRAFT → SUBMITTED → UNDER_REVIEW` | P0 |
| PROJ-5 | Project versioning (parent_project_id) | P1 |
| PROJ-6 | Visibility levels: `PRIVATE`, `TEAM`, `DEPT`, `COMPANY` | P0 |
| PROJ-7 | Auto-tagging + tech stack detection | P1 |

### 3.3 Discovery & Browsing
| ID | Requirement | Priority |
|---|---|---|
| DISC-1 | Pinterest-style masonry grid of project cards | P0 |
| DISC-2 | Smart cards: AI thumbnail, tech badges, complexity meter | P0 |
| DISC-3 | Search by keyword (Postgres FTS) | P0 |
| DISC-4 | Filter by type, status, visibility, department | P0 |
| DISC-5 | Sort by date, AI score, popularity | P1 |

### 3.4 Project Detail & Preview
| ID | Requirement | Priority |
|---|---|---|
| PREV-1 | Split-pane view: files left, live preview right | P1 (Phase 2) |
| PREV-2 | Live preview in gVisor sandbox (no network egress, read-only FS, 5-min TTL) | P1 (Phase 2) |
| PREV-3 | Static notebook render for DATA_ANALYSIS (nbconvert → HTML) | P1 (Phase 2) |
| PREV-4 | ML demo UI + inference endpoint for ML_MODEL | P1 (Phase 2) |
| PREV-5 | Swagger UI playground for API projects | P2 |
| PREV-6 | Inline comments on any file/line (Figma-style) | P1 |

### 3.5 AI System
| ID | Requirement | Priority |
|---|---|---|
| AI-1 | Explain Agent: business-friendly summaries (Executive/Manager/Peer) | P0 |
| AI-2 | Code Analyst: AST parse, complexity metrics, architecture diagram (Mermaid) | P1 |
| AI-3 | Security Scanner: gitleaks, snyk, sonarqube, trivy | P1 |
| AI-4 | Review & Evaluation Agent: 0–100 scores per rubric dimension | P2 |
| AI-5 | Career Advisor Agent: skill mapping + development plan | P2 |
| AI-6 | Comparative Analysis Agent: progression timeline | P2 |
| AI-7 | All AI outputs include confidence scores + source references | P0 |
| AI-8 | Async processing via RabbitMQ (never synchronous) | P1 (Phase 2) |
| AI-9 | PII redaction before LLM context | P0 |
| AI-10 | Full audit trail of prompts + responses | P0 |
| AI-11 | Fallback to local LLM if external API unavailable | P1 |

### 3.6 Review Workflow
| ID | Requirement | Priority |
|---|---|---|
| REV-1 | Peer/mentor reviews with rubric scores (innovation, technical depth, quality, documentation, business value) | P1 |
| REV-2 | AI-generated review with recommendation (`PROMOTE`/`DEVELOP`/`REJECT`) | P2 |
| REV-3 | Human decision gate: HR_ADMIN/DEPT_HEAD approves or rejects | P1 |
| REV-4 | Skill radar chart (5-axis visualization) | P2 |
| REV-5 | Review status tracking: `PENDING_APPROVAL → APPROVED/REJECTED` | P1 |

### 3.7 Notifications & Real-Time
| ID | Requirement | Priority |
|---|---|---|
| NOTIF-1 | WebSocket real-time notifications (project status, AI report ready, new review) | P1 |
| NOTIF-2 | Email notifications for key events | P2 |
| NOTIF-3 | Activity feed via Redis Streams | P2 |

---

## 4. Non-Functional Requirements

### 4.1 Security (Non-Negotiable)
- **SEC-1:** TLS 1.3 everywhere; mTLS between services (Phase 2)
- **SEC-2:** AES-256 encryption at rest (PostgreSQL + MinIO)
- **SEC-3:** Field-level encryption for PII (email, name)
- **SEC-4:** Zod validation on all inputs; parameterized SQL only
- **SEC-5:** CSP headers, context-aware output encoding, XSS protection
- **SEC-6:** Secrets in HashiCorp Vault — never in env vars or code (on-prem Phase 2)
- **SEC-7:** Sandbox: gVisor, no network egress, read-only FS, quotas, 5-min TTL (Phase 2)
- **SEC-8:** `.env` and config files scrubbed before preview
- **SEC-9:** Prompt injection detection, PII redaction, output sanitization
- **SEC-10:** GDPR/CCPA data handling, SOC 2 readiness

### 4.2 Performance
- **PERF-1:** API p95 latency < 200ms
- **PERF-2:** AI report generation < 5 minutes
- **PERF-3:** Page load < 1.5s (Lighthouse > 90)
- **PERF-4:** Sandbox spin-up < 2 seconds (Phase 2)
- **PERF-5:** Support 100 concurrent sandbox sessions (Phase 2)

### 4.3 Reliability
- **REL-1:** 99.9% uptime over 30 days
- **REL-2:** Point-in-time recovery for PostgreSQL
- **REL-3:** MinIO versioning + replication

### 4.4 Accessibility & UX
- **ACC-1:** WCAG 2.2 AA compliance
- **ACC-2:** Full keyboard navigation
- **ACC-3:** Screen reader optimized (ARIA labels)
- **ACC-4:** Dark/light mode with system preference detection
- **ACC-5:** Mobile-responsive

---

## 5. Technical Architecture

### 5.1 Tech Stack (Final)
| Layer | Technology |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS, shadcn/ui |
| Backend | NestJS 10 (Node 22 LTS) |
| API | REST + OpenAPI 3.1 |
| Primary DB | PostgreSQL 16 + pgvector |
| Cache/Session | Redis 7 |
| Object Storage | MinIO (S3-compatible) |
| Queue | RabbitMQ 3.13 |
| Secrets | HashiCorp Vault (Phase 2) |
| Sandbox | gVisor (Phase 2) → Firecracker (Phase 3) |
| AI | LangGraph + GLM/DeepSeek + deterministic tools |
| Observability | OpenTelemetry → Grafana + Loki + Jaeger |
| CI/CD | GitHub Actions |

### 5.2 Key Architectural Principles
1. **Deterministic tools for facts, LLM for narrative** — never let the LLM compute metrics or scan for secrets
2. **CQRS** — separate read model for browsing, write model for submission
3. **Event-driven** — all AI processing async via RabbitMQ (Phase 2)
4. **API-first** — all functionality via versioned REST APIs
5. **Observability by default** — every service emits OTel traces, metrics, logs

---

## 6. Data Model (PostgreSQL)

See [ARCHITECTURE.md](./ARCHITECTURE.md) Section 6 for full schema.

**Core entities:**
- `user` — talent, reviewers, HR admins, dept heads
- `project` — work products with status tracking
- `project_file` — versioned file metadata
- `review` — peer/AI reviews with human decision gate
- `ai_report` — AI agent outputs (Explain, Code Analyst, Security Scanner, etc.)
- `ai_interaction` — full audit trail of LLM calls
- `skill_assessment` — career radar data

---

## 7. API Contracts (REST + OpenAPI 3.1)

### 7.1 Base URL
```
http://localhost:4000/api/v1
```

### 7.2 Key Endpoints
```
POST   /auth/login                     # email + password
POST   /auth/refresh
GET    /auth/me

POST   /projects                       # create draft
GET    /projects                       # browse (CQRS read model)
GET    /projects/:id
PATCH  /projects/:id
POST   /projects/:id/submit            # DRAFT -> SUBMITTED
GET    /projects/:id/files
GET    /projects/:id/ai/report
POST   /projects/:id/ai/explain        # trigger Explain Agent

GET    /projects/:id/reviews
POST   /projects/:id/reviews

WS     /ws                             # WebSocket notifications
```

### 7.3 Example: Login
```json
POST /auth/login
{
  "email": "alice@company.com",
  "password": "password123"
}
→ 200 OK
{
  "accessToken": "eyJhbGc...",
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "alice@company.com",
    "name": "Alice Smith",
    "role": "TALENT",
    "department": "Engineering"
  }
}
```

### 7.4 Example: Create Project
```json
POST /projects
{
  "title": "Customer Churn Predictor",
  "type": "ML_MODEL",
  "visibility": "DEPT",
  "tags": ["python", "xgboost", "pandas"],
  "description": "ML model to predict customer churn using feature engineering"
}
→ 201 Created
{
  "id": "proj-uuid",
  "status": "DRAFT",
  ...
}
```

---

## 8. Frontend Features

### 8.1 Pages (Phase 1 MVP)
| Page | Status | Description |
|---|---|---|
| **/login** | ✅ Built | OAuth/OIDC + email/password |
| **/discover** | ✅ Built | Masonry grid, search, filter, sort |
| **/submit** | ✅ Built | Create project wizard |
| **/projects/[id]** | ✅ Built | Project detail, files, AI report |

### 8.2 Pages (Deferred)
| Page | Phase | Description |
|---|---|---|
| **/projects/[id]/review** | 2 | Rubric scoring, comments, decision gate |
| **/users/[id]/skill-radar** | 2 | 5-axis visualization, comparison |
| **/admin/audit** | 3 | Audit dashboard, user management |

### 8.3 Components (Shipped)
- `Button`, `Card`, `Badge` — base UI
- `Navbar` — navigation + logout
- `ProjectCard` — masonry grid item
- `AuthProvider` — login state + context

---

## 9. AI Agent System (Phase 1)

### 9.1 Explain Agent (MVP)
**Purpose:** Translate technical work into business-friendly narratives

**Input:**
- Project title, description, type
- Tech stack, tags
- File summary (paths, languages, line counts)

**Output:**
```json
{
  "executiveSummary": "2-3 sentences for executives (business value, impact)",
  "managerSummary": "2-3 sentences for managers (scope, effort, outcomes)",
  "peerSummary": "2-3 sentences for technical peers (approach, quality)",
  "analogies": ["analogy1", "analogy2", "analogy3"],
  "keyHighlights": ["strength1", "strength2", "strength3"],
  "confidenceScore": 85
}
```

**LLM:** GLM 4-Flash / DeepSeek V4 Flash (free/cheap)  
**Fallback:** Deterministic template when LLM unavailable

### 9.2 Agents Deferred to Phase 2+
- Code Analyst (AST parse, complexity, tech stack detection)
- Security Scanner (gitleaks, snyk, sonarqube, trivy)
- Review & Evaluation (rubric scoring)
- Career Advisor (skill mapping)
- Comparative Analysis (progression timeline)

---

## 10. Deployment & Setup

### 10.1 Development (Docker Compose)
```bash
# Clone repo
git clone https://github.com/Dalfino/my-fullstack-agent-app.git
cd my-fullstack-agent-app

# Install dependencies
pnpm install

# Start infrastructure (Postgres, Redis, MinIO, RabbitMQ)
docker-compose up -d

# Create .env files
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env

# Run migrations (optional, TypeORM auto-sync enabled in dev)
# pnpm --filter @talentshowcase/api run migrate

# Start frontend + backend in parallel
pnpm dev

# Or separately:
# Terminal 1: pnpm dev:api      (NestJS on :4000)
# Terminal 2: pnpm dev:web      (Next.js on :3000)
```

### 10.2 Production (On-Prem)
- Build Docker images for API and web
- Deploy to single VM or bare metal
- Use Vault for secret management
- Configure PostgreSQL replication + MinIO versioning for HA

---

## 11. Testing Strategy

| Type | Tool | Coverage | Phase |
|---|---|---|---|
| Unit | Jest (FE) + Vitest (BE) | 80% | 1+ |
| Integration | Supertest + TestContainers | API contracts | 2 |
| E2E | Playwright | Critical journeys | 2 |
| Security | OWASP ZAP, gitleaks, snyk | CI pipeline | 2 |
| Performance | k6 | Load testing | 3 |

---

## 12. Definition of Done (6-Month MVP)

- [x] Backend auth + RBAC
- [x] Project CRUD + submission workflow
- [x] Discovery grid + search/filter/sort
- [x] Explain Agent integration
- [x] Frontend pages: login, discover, submit, detail
- [x] Docker Compose for local dev
- [x] File upload + deterministic virus scan (multipart; tus resumable deferred) — Phase 2
- [x] Live code preview (in-app viewer; gVisor sandbox deferred) — Phase 2
- [x] Code Analyst + Security Scanner agents — Phase 2
- [x] Review workflow + decision gate — Phase 2
- [x] Inline comments + resolve flow — Phase 2
- [x] Async AI pipeline (RabbitMQ with in-process fallback) — Phase 2
- [x] Evaluation + Career Advisor agents — Phase 3
- [x] Skill radar + comparison mode — Phase 3
- [x] Audit dashboard + admin user management — Phase 3
- [x] MFA (TOTP) enrolment + login challenge — Phase 3
- [x] Swagger/OpenAPI docs + k6 load test script — Phase 3
- [ ] 99.9% uptime over 30 days (production ops)
- [ ] SSO/SAML (deferred — requires enterprise IdP)

---

## 13. Success Metrics

| Metric | Target |
|---|---|
| Talent Adoption Rate | >90% of IT staff active within 30 days |
| Non-Tech Engagement | >60% of HR/business users browse weekly |
| AI Report Accuracy | >85% peer-reviewed accuracy score |
| API Availability | 99.99% |
| Security Incidents | 0 critical |
| Time-to-Generate Report | <5 minutes |
| Page Load Time | <1.5s (Lighthouse > 90) |

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Live previews break often | gVisor isolation, error handling, static fallback |
| Notebook interactivity scope creep | Static render first, interactivity deferred to Phase 2 |
| LLM code analysis weakness | Deterministic tools for facts, LLM for narrative |
| On-prem ops burden | Minimal services (cut MongoDB/ES/Kafka), Docker Compose first |
| 6-month timeline slip | Strict phase gates, cut features not security |

---

## 15. Build Phases

### Phase 1 (Months 1–2) — MVP ✅ DELIVERED
- Auth (JWT, MFA-ready, RBAC)
- Project CRUD, discovery, submission
- Explain Agent, AI report display
- Frontend: login, discover, submit, detail
- Docker Compose local dev

### Phase 2 (Months 3–4) — Core Platform ✅ DELIVERED
- [x] File upload (multipart, size limits, deterministic virus scan, MinIO/local-disk fallback)
- [x] Code file content preview (line-addressable)
- [x] Inline comments on files with threads + resolve flow
- [x] Code Analyst agent (deterministic repo stats + LLM narrative)
- [x] Security Scanner agent (8-rule engine + LLM summary)
- [x] Review workflow (create/approve/reject) + status transitions with decision gate
- [x] Async AI pipeline (RabbitMQ transport with durable Postgres-backed in-process fallback)
- Deferred: gVisor sandboxed live preview (needs privileged runtime)

### Phase 3 (Months 5–6) — Enterprise ✅ DELIVERED
- [x] Evaluation agent (5-criterion scoring, detected skills, AI review for the gate)
- [x] Career Advisor agent (radar-driven roadmap, gaps, career paths)
- [x] Skill radar (9 categories) + pairwise comparison UI
- [x] Audit log (22 action types) + admin dashboard (users, roles, stats, audit viewer)
- [x] MFA: TOTP enrolment (QR) + login challenge flow
- [x] Swagger/OpenAPI at /docs + k6 load test script
- [x] DB indexes on hot query paths
- Deferred: SSO/SAML (needs enterprise IdP)

---

## 16. Anti-Patterns (NEVER do these)

❌ Store secrets in env vars — use Vault always  
❌ Execute user code in Docker containers — use gVisor/Firecracker only  
❌ Allow sandbox network egress without explicit allowlist  
❌ Send PII to external LLMs without redaction  
❌ Skip input validation on any endpoint  
❌ Use synchronous calls for AI processing — always async  
❌ Expose internal service ports — API Gateway only  
❌ Store AI prompts/responses without audit logging  

---

## 17. References

- [ARCHITECTURE.md](./ARCHITECTURE.md) — Full technical design
- [README.md](./README.md) — Setup and run instructions
- API docs: OpenAPI 3.1 spec (generated from NestJS)
- Types: [@talentshowcase/types](./packages/types/src/)
