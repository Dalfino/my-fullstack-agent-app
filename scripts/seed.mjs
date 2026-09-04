#!/usr/bin/env node
/**
 * Demo seed for TalentShowcase.
 * Creates users, projects with files, curated showcase blocks, reviews and
 * skill assessments so the platform has realistic, visually rich data on
 * first boot. Idempotent: safe to re-run (--force wipes previous data).
 *
 * Showcase (Phase A): every demo project ships a curated visual story —
 * galleries, a pre-executed notebook, an OpenAPI explorer and terminal
 * replays — so all six project kinds are represented.
 *
 * Usage: node scripts/seed.mjs [--force]
 */
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

// Resolve pg/bcryptjs from the API workspace package (they are its deps)
const _require = createRequire(new URL('../apps/api/package.json', import.meta.url));
const pg = _require('pg');
const bcrypt = _require('bcryptjs');

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const force = process.argv.includes('--force');
const ASSETS = path.join(__dirname, 'assets');

const DB = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 5432),
  user: process.env.DB_USER ?? 'talentshowcase',
  password: process.env.DB_PASSWORD ?? 'talentshowcase',
  database: process.env.DB_NAME ?? 'talentshowcase',
};

const client = new pg.Client(DB);

const USERS = [
  { email: 'alice@company.com', name: 'Alice Johnson', department: 'Engineering', role: 'TALENT', career: 'L3', skills: ['React', 'Node.js', 'PostgreSQL'] },
  { email: 'carol@company.com', name: 'Carol Wu', department: 'Data Platform', role: 'TALENT', career: 'L2', skills: ['Python', 'SQL', 'Airflow'] },
  { email: 'dave@company.com', name: 'Dave Okafor', department: 'Security', role: 'REVIEWER', career: 'L4', skills: ['Security', 'Go', 'Kubernetes'] },
  { email: 'bob@company.com', name: 'Bob Manager', department: 'People Ops', role: 'HR_ADMIN', career: 'L5', skills: ['People Ops'] },
];

/* --------------------------------------------------------------------- */
/* Project catalogue (all six showcase kinds represented)                */
/* --------------------------------------------------------------------- */

const FEEDBACK_README = `# Customer Feedback Analytics Dashboard\n\nIngests feedback from multiple channels and visualises sentiment trends.\n\n## Features\n- Multi-channel ingestion (email, webhooks, CSV import)\n- Sentiment classification pipeline\n- Interactive trend dashboard\n- Role-based access control\n`;

const FORECAST_README = `# Warehouse Demand Forecasting\n\nPredicts SKU-level demand 14 days ahead using gradient boosting on engineered lag features.\n\n## Design\n- Airflow DAGs orchestrate ingestion, features, training, backtest\n- Drift alerts via Slack webhook\n`;

const PROJECTS = [
  {
    ownerEmail: 'alice@company.com',
    title: 'Customer Feedback Analytics Dashboard',
    description:
      'A full-stack analytics dashboard that ingests customer feedback from multiple channels, ' +
      'classifies sentiment with a lightweight NLP pipeline, and visualises trends for product managers. ' +
      'Includes JWT auth, role-based access and CSV/PDF export.',
    type: 'FULLSTACK',
    status: 'APPROVED',
    visibility: 'COMPANY',
    tags: ['analytics', 'nlp', 'react'],
    techStack: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
    aiSummary: 'A production-shaped analytics product with clear layering and strong data visualisation.',
    aiScore: 82,
    files: [
      { path: 'README.md', language: 'markdown', content: FEEDBACK_README },
      {
        path: 'src/server/app.ts',
        language: 'typescript',
        content:
          "import express from 'express';\nimport { ingestRouter } from './routes/ingest';\nimport { reportRouter } from './routes/report';\n\nconst app = express();\napp.use(express.json());\napp.use('/api/ingest', ingestRouter);\napp.use('/api/reports', reportRouter);\n\napp.listen(4000, () => console.log('analytics api ready'));\n",
      },
      {
        path: 'src/server/sentiment.ts',
        language: 'typescript',
        content:
          "const POSITIVE = ['love', 'great', 'excellent', 'fast', 'friendly'];\nconst NEGATIVE = ['slow', 'broken', 'confusing', 'expensive'];\n\nexport function classify(text) {\n  const words = text.toLowerCase().split(/\\W+/);\n  let score = 0;\n  for (const w of words) {\n    if (POSITIVE.includes(w)) score += 1;\n    if (NEGATIVE.includes(w)) score -= 1;\n  }\n  return { score, label: score > 0 ? 'positive' : score < 0 ? 'negative' : 'neutral' };\n}\n",
      },
      {
        path: 'src/web/Dashboard.tsx',
        language: 'typescript',
        content:
          "import React, { useEffect, useState } from 'react';\n\nexport function Dashboard({ user }) {\n  const [trends, setTrends] = useState([]);\n  useEffect(() => {\n    fetch('/api/reports/trends').then((r) => r.json()).then(setTrends);\n  }, []);\n  return (\n    <div className=\"dashboard\">\n      <h1>Feedback Trends</h1>\n      {trends.map((t) => (\n        <div key={t.week}>Week {t.week}: {t.positive} positive / {t.negative} negative</div>\n      ))}\n    </div>\n  );\n}\n",
      },
      { path: 'docs/dashboard-overview.png', language: 'image', binary: 'dashboard_mock.png', mime: 'image/png' },
    ],
  },
  {
    ownerEmail: 'carol@company.com',
    title: 'Warehouse Demand Forecasting Pipeline',
    description:
      'An airflow-orchestrated forecasting pipeline that predicts SKU-level demand two weeks ahead. ' +
      'Feature store on Postgres, gradient-boosted models, and automated backtests with alerting on drift.',
    type: 'DATA_ANALYSIS',
    status: 'SUBMITTED',
    visibility: 'DEPT',
    tags: ['forecasting', 'airflow', 'ml'],
    techStack: ['Python', 'Airflow', 'PostgreSQL'],
    aiSummary: 'A disciplined ML pipeline with reproducible backtests and sensible alerting.',
    aiScore: 74,
    files: [
      { path: 'README.md', language: 'markdown', content: FORECAST_README },
      {
        path: 'dags/forecast_dag.py',
        language: 'python',
        content:
          "from airflow import DAG\nfrom airflow.operators.python import PythonOperator\nfrom datetime import datetime, timedelta\n\nfrom tasks.features import build_features\nfrom tasks.train import train_model\nfrom tasks.backtest import run_backtest\n\nwith DAG(\n    'demand_forecast',\n    schedule_interval='0 4 * * *',\n    start_date=datetime(2025, 1, 1),\n    catchup=False,\n) as dag:\n    features = PythonOperator(task_id='features', python_callable=build_features, dag=dag)\n    train = PythonOperator(task_id='train', python_callable=train_model, dag=dag)\n    backtest = PythonOperator(task_id='backtest', python_callable=run_backtest, dag=dag)\n    features >> train >> backtest\n",
      },
      {
        path: 'tasks/features.py',
        language: 'python',
        content:
          "import pandas as pd\n\nLAGS = [1, 7, 14, 28]\n\ndef build_features(ds=None, **kwargs):\n    sales = pd.read_sql('SELECT day, sku, units FROM sales', con)\n    for lag in LAGS:\n        sales[f'units_lag_{lag}'] = sales.groupby('sku')['units'].shift(lag)\n    sales['dow'] = pd.to_datetime(sales['day']).dt.dayofweek\n    return sales\n",
      },
      { path: 'notebooks/channel_analysis.ipynb', language: 'ipynb', notebook: 'forecast' },
      { path: 'output/backtest_output.txt', language: 'text', content: null, terminal: 'forecast' },
    ],
  },
  {
    ownerEmail: 'carol@company.com',
    title: 'Customer Churn Prediction Model',
    description:
      'A gradient-boosted churn classifier for the subscription business: feature engineering over ' +
      'usage + billing events, 30-epoch training with early stopping, and a held-out evaluation ' +
      'reaching 0.87 AUC. Ships with a reproducible training notebook and model card.',
    type: 'ML_MODEL',
    status: 'SUBMITTED',
    visibility: 'COMPANY',
    tags: ['churn', 'xgboost', 'classification'],
    techStack: ['Python', 'XGBoost', 'scikit-learn', 'pandas'],
    aiSummary: 'A rigorous, well-evaluated churn classifier with honest holdout reporting.',
    aiScore: 79,
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# Customer Churn Prediction Model\n\nPredicts 90-day churn risk for subscription customers.\n\n## Results (holdout)\n- ROC-AUC: 0.87 · PR-AUC: 0.64\n- Precision@20%: 0.71 (baseline 0.23)\n\n## Model card\n- Algorithm: XGBoost (depth 6, 300 trees, early stopping)\n- Features: 42 (usage recency/frequency, billing events, support tickets)\n- Fairness: checked across plan tiers; no proxy for protected attributes retained\n',
      },
      {
        path: 'src/features.py',
        language: 'python',
        content:
          "import pandas as pd\n\nRECENCY_WINDOWS = [7, 30, 90]\n\ndef build_features(events: pd.DataFrame, billing: pd.DataFrame) -> pd.DataFrame:\n    feats = events.groupby('customer_id').agg(\n        sessions_30d=('ts', lambda s: (s >= '2025-08-01').sum()),\n        active_days_90d=('day', 'nunique'),\n        tickets=('ticket_id', 'count'),\n    )\n    for w in RECENCY_WINDOWS:\n        feats[f'logins_{w}d'] = events[events.ts >= f'2025-09-{91-w:02d}'].groupby('customer_id').size()\n    feats = feats.join(billing.set_index('customer_id')[['mrr', 'plan_tier']])\n    return feats.fillna(0)\n",
      },
      { path: 'notebooks/churn_training.ipynb', language: 'ipynb', notebook: 'churn' },
      { path: 'reports/confusion_matrix.png', language: 'image', binary: 'churn_confusion_matrix.png', mime: 'image/png' },
      { path: 'reports/loss_curve.png', language: 'image', binary: 'churn_loss_curve.png', mime: 'image/png' },
    ],
  },
  {
    ownerEmail: 'alice@company.com',
    title: 'Payments & Billing REST API',
    description:
      'A versioned REST API for payments and billing: idempotent charge creation, subscription ' +
      'lifecycle, webhooks with signature verification, and OpenAPI-first docs. Deployed behind ' +
      'a gateway with per-tenant rate limits.',
    type: 'API',
    status: 'SUBMITTED',
    visibility: 'COMPANY',
    tags: ['payments', 'rest', 'openapi'],
    techStack: ['Node.js', 'TypeScript', 'PostgreSQL', 'Stripe-like PSP'],
    aiSummary: 'A disciplined, contract-first payments API with idempotency and clear versioning.',
    aiScore: 77,
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# Payments & Billing REST API\n\nContract-first billing API. The full spec lives in `openapi.yaml`.\n\n## Principles\n- Idempotency keys on every mutating operation\n- Cursor pagination, RFC 7807 problem details\n- Webhooks signed with HMAC-SHA256\n',
      },
      {
        path: 'src/server.ts',
        language: 'typescript',
        content:
          "import fastify from 'fastify';\nimport { chargesRoutes } from './routes/charges';\nimport { customersRoutes } from './routes/customers';\n\nconst app = fastify({ logger: true });\napp.register(chargesRoutes, { prefix: '/v1' });\napp.register(customersRoutes, { prefix: '/v1' });\n\napp.listen({ port: 8080, host: '0.0.0.0' });\n",
      },
      { path: 'openapi.yaml', language: 'yaml', openapi: true },
    ],
  },
  {
    ownerEmail: 'alice@company.com',
    title: 'Nimbus Brand Refresh Kit',
    description:
      'A complete visual refresh for the Nimbus product line: logo lockups, core palette with ' +
      'accessibility ratios, and a typography specimen. Includes usage rules so any team can ship ' +
      'on-brand material without a designer in the loop.',
    type: 'DESIGN',
    status: 'APPROVED',
    visibility: 'COMPANY',
    tags: ['branding', 'visual-identity', 'design-system'],
    techStack: ['Figma', 'Illustrator', 'Design tokens'],
    aiSummary: 'A crisp, practical brand kit with accessibility-checked palette and clear usage rules.',
    aiScore: 85,
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# Nimbus Brand Refresh Kit\n\nOne kit, three deliverables: logo, palette, type.\n\n## Usage rules\n- Primary logo on white or Blue 600 only\n- Body text: Slate 900 on white, minimum 4.5:1 contrast\n- Amber 400 reserved for call-to-action accents — never for body text\n',
      },
      { path: 'logo-lockups.png', language: 'image', binary: 'design_logo_variants.png', mime: 'image/png' },
      { path: 'color-palette.png', language: 'image', binary: 'design_color_palette.png', mime: 'image/png' },
      { path: 'typography.png', language: 'image', binary: 'design_typography.png', mime: 'image/png' },
    ],
  },
  {
    ownerEmail: 'carol@company.com',
    title: 'CSV Cleaner CLI',
    description:
      'A zero-dependency Python CLI that cleans messy CSV exports: encoding detection, header ' +
      'normalisation, type inference and dedup reports. Used weekly by three non-engineering teams.',
    type: 'SCRIPT',
    status: 'SUBMITTED',
    visibility: 'DEPT',
    tags: ['cli', 'automation', 'csv'],
    techStack: ['Python'],
    aiSummary: 'A small tool with outsized impact — adopted by three teams for weekly data cleanup.',
    aiScore: 68,
    files: [
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# CSV Cleaner CLI\n\n`python csv_cleaner.py input.csv -o clean/ --dedupe email --report`\n\n- Encoding + delimiter sniffing\n- Header normalisation (snake_case, unique)\n- Type inference (dates, numbers, bools)\n- Dedup report written alongside the cleaned file\n',
      },
      {
        path: 'csv_cleaner.py',
        language: 'python',
        content:
          "import argparse, csv, sys\nfrom pathlib import Path\n\ndef normalise_headers(rows):\n    header = [h.strip().lower().replace(' ', '_') for h in rows[0]]\n    seen, deduped = {}, []\n    for h in header:\n        seen[h] = seen.get(h, -1) + 1\n        deduped.append(h if seen[h] == 0 else f'{h}_{seen[h]}')\n    return deduped\n\ndef main():\n    ap = argparse.ArgumentParser()\n    ap.add_argument('input'); ap.add_argument('-o', '--outdir', default='clean')\n    ap.add_argument('--dedupe', default=None)\n    args = ap.parse_args()\n    rows = list(csv.reader(open(args.input, encoding='utf-8-sig')))\n    header = normalise_headers(rows)\n    Path(args.outdir).mkdir(exist_ok=True)\n    out = Path(args.outdir) / Path(args.input).name\n    with open(out, 'w', newline='') as f:\n        csv.writer(f).writerows([header, *rows[1:]])\n    print(f'wrote {out} ({len(rows)-1} rows, {len(header)} columns)')\n\nif __name__ == '__main__':\n    main()\n",
      },
      { path: 'output/run_report.txt', language: 'text', content: null, terminal: 'script' },
    ],
  },
];

/* --------------------------- showcase payloads --------------------------- */

const NB_CHART_B64 = (() => {
  try {
    return JSON.parse(fs.readFileSync(path.join(ASSETS, 'nb_chart_b64.json'), 'utf8'))['image/png'];
  } catch {
    return null;
  }
})();

function notebookPayload(kind) {
  if (kind === 'forecast') {
    const cells = [
      {
        type: 'markdown',
        source: '# Channel mix — exploratory analysis\n\nWhere does our feedback actually come from? Load 90 days of raw items and break the volume down by ingestion channel.',
        outputs: [],
      },
      {
        type: 'code',
        source: 'import pandas as pd\n\nitems = pd.read_csv("data/feedback_items.csv", parse_dates=["created_at"])\nitems.groupby("channel")["id"].count().sort_values(ascending=False)',
        outputs: [
          {
            kind: 'text',
            text:
              'channel\nemail        5210\nwebhook      3840\ncsv_import   2270\nmobile_sdk   1098\nName: id, dtype: int64',
          },
        ],
      },
      {
        type: 'code',
        source: 'weekly = items.set_index("created_at").resample("W")[["sentiment_pos", "sentiment_neg"]].sum()\nweekly.plot(title="Weekly sentiment"); pass',
        outputs: NB_CHART_B64
          ? [{ kind: 'image', mediaType: 'image/png', data: NB_CHART_B64 }]
          : [],
      },
      {
        type: 'markdown',
        source: '**Takeaway:** email dominates volume but webhooks are the fastest-growing channel (+38% QoQ) — worth a dedicated ingestion SLA.',
        outputs: [],
      },
    ];
    return { title: 'channel_analysis.ipynb', fileId: null, kernelHint: 'Python 3 (pandas 2.2)', truncated: false, cells };
  }
  // churn
  const lossB64 = (() => {
    try {
      return Buffer.from(fs.readFileSync(path.join(ASSETS, 'churn_loss_curve.png'))).toString('base64');
    } catch {
      return null;
    }
  })();
  const cells = [
    {
      type: 'markdown',
      source: '# Churn model — training run 2025-08-30\n\nXGBoost classifier on 42 engineered features (usage + billing + support). Early stopping after 30 epochs.',
      outputs: [],
    },
    {
      type: 'code',
      source: 'from xgboost import XGBClassifier\n\nmodel = XGBClassifier(max_depth=6, n_estimators=300, early_stopping_rounds=12)\nmodel.fit(X_tr, y_tr, eval_set=[(X_val, y_val)], verbose=0)\nprint(f"best_iteration={model.best_iteration}")',
      outputs: [{ kind: 'text', text: 'best_iteration=178' }],
    },
    {
      type: 'code',
      source: 'import matplotlib.pyplot as plt\n\nplt.plot(model.evals_result()["validation_0"]["logloss"], label="validation")\nplt.title("Learning curve"); plt.xlabel("epoch"); plt.ylabel("logloss"); pass',
      outputs: lossB64 ? [{ kind: 'image', mediaType: 'image/png', data: lossB64 }] : [],
    },
    {
      type: 'code',
      source: 'from sklearn.metrics import roc_auc_score, classification_report\n\npred = model.predict_proba(X_test)[:, 1]\nprint(f"holdout ROC-AUC: {roc_auc_score(y_test, pred):.3f}")\nprint(classification_report(y_test, pred > 0.5, target_names=["retained", "churned"]))',
      outputs: [
        {
          kind: 'text',
          text:
            'holdout ROC-AUC: 0.870\n              precision    recall  f1-score   support\n\n    retained       0.92      0.94      0.93      1524\n     churned       0.79      0.75      0.77       476\n\n    accuracy                           0.89      2000\n   macro avg       0.86      0.84      0.85      2000\nweighted avg       0.89      0.89      0.89      2000',
        },
      ],
    },
    {
      type: 'markdown',
      source: '**Model card note:** performance is stable across plan tiers (AUC delta < 0.02); no protected-attribute proxies retained after the feature audit.',
      outputs: [],
    },
  ];
  return { title: 'churn_training.ipynb', fileId: null, kernelHint: 'Python 3 (xgboost 2.1)', truncated: false, cells };
}

const TERMINALS = {
  forecast: {
    title: 'backtest_output.txt',
    command: 'airflow dags test demand_forecast 2025-08-30',
    lines: [
      '[2025-08-30 04:00:12] DAG demand_forecast: starting backtest window 2025-07-01..2025-08-30',
      '[2025-08-30 04:00:19] features: built 42 features for 1,842 SKUs (8.3s)',
      '[2025-08-30 04:01:02] train: xgboost trained, best_iter=178, val_wape=11.4%',
      '[2025-08-30 04:01:44] backtest: wape=12.1% | bias=+0.8% | drift_score=0.06 (ok)',
      '[2025-08-30 04:01:44] backtest: top drift SKUs: SKU-4021, SKU-1187, SKU-9340',
      '[2025-08-30 04:01:45] alerts: none fired (threshold 0.15)',
      '[2025-08-30 04:01:45] DAG demand_forecast: SUCCESS in 93s',
    ],
  },
  script: {
    title: 'run_report.txt',
    command: 'python csv_cleaner.py exports/crm_july.csv -o clean/ --dedupe email --report',
    lines: [
      '$ python csv_cleaner.py exports/crm_july.csv -o clean/ --dedupe email --report',
      '→ detected encoding: utf-8-sig (BOM stripped)',
      '→ delimiter: , (quoting: minimal)',
      '→ headers normalised: 14 columns, renamed 5, deduped 1 (email → email_1)',
      '→ types inferred: 6 numeric, 3 date, 2 bool, 3 string',
      '→ duplicate emails removed: 217 (report: clean/crm_july_dupes.csv)',
      'wrote clean/crm_july.csv (8,241 rows, 14 columns)',
      '✔ done in 1.9s',
    ],
  },
  fullstack: {
    title: 'dev-server.log',
    command: 'pnpm dev',
    lines: [
      '$ pnpm dev',
      '[server] analytics api listening on :4000',
      '[server] ingest router mounted (email, webhook, csv)',
      '[worker] sentiment pipeline: model sentiment-v3 loaded',
      '[web] next dev server ready on :3000',
      '[web] GET /reports/trends 200 in 34ms',
      '[server] POST /api/ingest/webhook 202 in 41ms (batch=120)',
    ],
  },
};

const OPENAPI_YAML = `openapi: 3.0.3
info:
  title: Payments & Billing API
  version: 2025.09.1
  description: >
    Idempotent billing API. All mutating endpoints accept an Idempotency-Key
    header. Webhooks are signed with HMAC-SHA256.
servers:
  - url: https://api.nimbus.example/v1
paths:
  /customers:
    post:
      summary: Create a customer
      tags: [Customers]
    get:
      summary: List customers (cursor pagination)
      tags: [Customers]
  /customers/{id}:
    get:
      summary: Retrieve a customer
      tags: [Customers]
  /charges:
    post:
      summary: Create an idempotent charge
      tags: [Charges]
    get:
      summary: List charges for the tenant
      tags: [Charges]
  /charges/{id}/refund:
    post:
      summary: Refund a charge (partial or full)
      tags: [Charges]
  /subscriptions:
    post:
      summary: Start a subscription
      tags: [Subscriptions]
    delete:
      summary: Cancel a subscription at period end
      tags: [Subscriptions]
  /webhooks:
    get:
      summary: List webhook endpoints
      tags: [Webhooks]
    post:
      summary: Register a webhook endpoint
      tags: [Webhooks]
`;

const SHOWCASES = [
  {
    projectTitle: 'Customer Feedback Analytics Dashboard',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'A dashboard that turns customer rants into product decisions',
          bullets: [
            'Collects feedback from email, webhooks and CSV imports, then automatically labels every item as positive or negative.',
            'Built as a web app: a React dashboard in front, a Node.js service doing the language analysis, PostgreSQL and Redis underneath.',
            'Product managers spot sentiment dips within a day instead of waiting for the monthly survey — that is the whole point.',
          ],
          audienceNote: 'Start with the dashboard screenshot below, then peek at the dev-server replay if you are curious how it runs.',
        },
      },
      { kind: 'GALLERY', source: 'AUTO', payloadRef: 'gallery:docs/dashboard-overview.png', payload: { title: 'Visual output (1)', items: [] } },
      { kind: 'TERMINAL', source: 'AUTO', payload: TERMINALS.fullstack },
    ],
  },
  {
    projectTitle: 'Warehouse Demand Forecasting Pipeline',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'A pipeline that predicts what the warehouse will run out of next',
          bullets: [
            'Forecasts demand for every product two weeks ahead, so purchasing can act before shelves go empty.',
            'Orchestrated with Airflow: features are computed from sales history, models retrain daily, and every run is backtested against reality.',
            'Missed forecasts used to cost thousands in emergency freight; the backtest shows errors cut by roughly a third.',
          ],
          audienceNote: 'The notebook below shows the actual exploratory analysis — charts included, no coding required to read it.',
        },
      },
      { kind: 'NOTEBOOK', source: 'AUTO', payloadRef: 'notebook:forecast', payload: null },
      { kind: 'TERMINAL', source: 'AUTO', payload: TERMINALS.forecast },
    ],
  },
  {
    projectTitle: 'Customer Churn Prediction Model',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'A model that flags which customers are about to leave',
          bullets: [
            'Scores every subscription customer on their 90-day churn risk using product usage, billing events and support history.',
            'A gradient-boosted model trained in a reproducible notebook, evaluated honestly on a holdout set it never saw (0.87 AUC).',
            'Retention campaigns can now target the 20% riskiest customers and reach 7 in 10 of those who would truly churn.',
          ],
          audienceNote: 'Open the training notebook to see the learning curve and full evaluation report.',
        },
      },
      { kind: 'NOTEBOOK', source: 'AUTO', payloadRef: 'notebook:churn', payload: null },
      { kind: 'GALLERY', source: 'AUTO', payloadRef: 'gallery:reports/confusion_matrix.png,reports/loss_curve.png', payload: { title: 'Visual output (2)', items: [] } },
    ],
  },
  {
    projectTitle: 'Payments & Billing REST API',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'The API other teams build billing on — safely',
          bullets: [
            'Handles charges, refunds and subscription lifecycles for any product that needs to take money.',
            'Contract-first: every endpoint is specified in OpenAPI before implementation, with idempotency keys so retries never double-charge.',
            'Integrating teams ship faster because the documentation below is always in sync with the code.',
          ],
          audienceNote: 'Browse the endpoint explorer below — each card is one thing the API can do.',
        },
      },
      { kind: 'OPENAPI', source: 'AUTO', payloadRef: 'openapi:openapi.yaml', payload: null },
    ],
  },
  {
    projectTitle: 'Nimbus Brand Refresh Kit',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'One visual language for everything Nimbus ships',
          bullets: [
            'Defines the new logo lockups, a six-colour accessible palette, and the typography scale for product and marketing.',
            'Delivered as print-ready assets plus design tokens, so engineers consume the same values designers draw with.',
            'Any team can now produce on-brand slides, pages and decks without waiting for a designer — the usage rules do the policing.',
          ],
          audienceNote: 'Three visuals below: logo variants, the core palette, and the type specimen.',
        },
      },
      {
        kind: 'GALLERY',
        source: 'AUTO',
        payloadRef: 'gallery:logo-lockups.png,color-palette.png,typography.png',
        payload: { title: 'Visual output (3)', items: [] },
      },
    ],
  },
  {
    projectTitle: 'CSV Cleaner CLI',
    blocks: [
      {
        kind: 'STORY',
        source: 'AI',
        payload: {
          headline: 'A tiny command that un-messes any CSV export',
          bullets: [
            'Cleans messy spreadsheet exports: fixes encodings, normalises headers, infers column types and removes duplicates.',
            'A single zero-dependency Python file — no install marathon, works on any machine with Python.',
            'Three non-engineering teams run it weekly on CRM exports, saving roughly a hand-edited afternoon per week.',
          ],
          audienceNote: 'Watch the terminal replay below — that is the entire user experience.',
        },
      },
      { kind: 'TERMINAL', source: 'AUTO', payload: TERMINALS.script },
    ],
  },
];

/* ------------------------------- helpers -------------------------------- */

const STORAGE_DIR = path.resolve(__dirname, '../.storage');

function writeStorageObject(s3Key, buffer) {
  const safe = s3Key.replace(/\.\./g, '_');
  const fileDir = path.dirname(path.join(STORAGE_DIR, safe));
  fs.mkdirSync(fileDir, { recursive: true });
  fs.writeFileSync(path.join(STORAGE_DIR, safe), buffer);
}

function loadAsset(name) {
  const p = path.join(ASSETS, name);
  if (!fs.existsSync(p)) throw new Error(`missing demo asset: ${p}`);
  return fs.readFileSync(p);
}

/* --------------------------------- main --------------------------------- */

async function main() {
  await client.connect();
  console.log('[seed] connected');

  if (force) {
    // Wipe previous demo data so repeated runs stay clean
    await client.query(`DELETE FROM showcase_block`);
    await client.query(`DELETE FROM comment`);
    await client.query(`DELETE FROM project_file`);
    await client.query(`DELETE FROM review`);
    await client.query(`DELETE FROM ai_report`);
    await client.query(`DELETE FROM ai_interaction`);
    await client.query(`DELETE FROM skill_assessment`);
    await client.query(`DELETE FROM project`);
    await client.query(`DELETE FROM "user"`);
    console.log('[seed] wiped previous demo data');
  } else {
    const existing = await client.query('SELECT COUNT(*)::int AS n FROM "user"');
    if (existing.rows[0].n > 0) {
      console.log('[seed] users already present; use --force to seed anyway. Skipping.');
      await client.end();
      return;
    }
  }

  const hash = await bcrypt.hash('password123', 10);
  const userIds = {};

  for (const u of USERS) {
    const r = await client.query(
      `INSERT INTO "user" (email, name, department, role, career_level, skills, password_hash)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)
       ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [u.email, u.name, u.department, u.role, u.career, JSON.stringify(u.skills), hash],
    );
    userIds[u.email] = r.rows[0].id;
    console.log(`[seed] user ${u.email} (${u.role})`);
  }

  /** Create a project_file row + storage object; returns the file id. */
  async function createFile(projectId, f) {
    let buffer;
    let mime = f.mime ?? 'text/plain';
    let lineCount = 0;
    let language = f.language;

    if (f.binary) {
      buffer = loadAsset(f.binary);
      lineCount = 0;
    } else if (f.notebook) {
      const nb = buildNotebookFile(f.notebook);
      buffer = Buffer.from(JSON.stringify(nb), 'utf8');
      mime = 'application/x-ipynb+json';
      language = 'ipynb';
      lineCount = buffer.toString('utf8').split('\n').length;
    } else if (f.openapi) {
      buffer = Buffer.from(OPENAPI_YAML, 'utf8');
      mime = 'text/yaml';
      lineCount = OPENAPI_YAML.split('\n').length;
    } else if (f.terminal) {
      const t = TERMINALS[f.terminal];
      const body = [`$ ${t.command}`, ...t.lines.slice(t.command ? 1 : 0)].join('\n');
      buffer = Buffer.from(body, 'utf8');
      lineCount = body.split('\n').length;
    } else {
      buffer = Buffer.from(f.content, 'utf8');
      lineCount = f.content.split('\n').length;
    }

    const s3Key = `projects/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.path}`;
    writeStorageObject(s3Key, buffer);
    const r = await client.query(
      `INSERT INTO project_file (project_id, path, size, mime_type, s3_key, line_count, language, is_entry_point)
       VALUES ($1,$2,$3,$4,$5,$6,$7,false)
       RETURNING id`,
      [projectId, f.path, buffer.length, mime, s3Key, lineCount, language],
    );
    return { fileId: r.rows[0].id, path: f.path };
  }

  async function insertBlock(projectId, position, kind, source, payload) {
    await client.query(
      `INSERT INTO showcase_block (project_id, position, kind, payload, source)
       VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [projectId, position, kind, JSON.stringify(payload), source],
    );
  }

  const projectIds = {};
  for (const p of PROJECTS) {
    const ownerId = userIds[p.ownerEmail];
    const r = await client.query(
      `INSERT INTO project (title, description, type, owner_id, status, visibility, tags, tech_stack, ai_summary, ai_score)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9,$10)
       RETURNING id`,
      [p.title, p.description, p.type, ownerId, p.status, p.visibility, JSON.stringify(p.tags), JSON.stringify(p.techStack), p.aiSummary, p.aiScore],
    );
    const projectId = r.rows[0].id;
    projectIds[p.title] = projectId;
    console.log(`[seed] project "${p.title}" (${p.status})`);

    const created = [];
    for (const f of p.files) {
      created.push(await createFile(projectId, f));
    }
    console.log(`[seed]   ${created.length} file(s) written to storage`);

    /* Curated showcase blocks (match zod payloads in @talentshowcase/types) */
    const showcase = SHOWCASES.find((s) => s.projectTitle === p.title);
    if (showcase) {
      for (let i = 0; i < showcase.blocks.length; i++) {
        const b = showcase.blocks[i];
        let payload = b.payload;
        if (b.payloadRef) {
          if (b.kind === 'GALLERY') {
            const wanted = b.payloadRef.replace('gallery:', '').split(',');
            const items = created
              .filter((c) => wanted.includes(c.path))
              .map((c) => ({
                fileId: c.fileId,
                caption: c.path.split('/').pop().replace(/[-_]/g, ' ').replace('.png', ''),
              }));
            if (items.length === 0) continue;
            payload = { title: b.payload.title ?? `Visual output (${items.length})`, items };
          } else if (b.kind === 'NOTEBOOK') {
            payload = notebookPayload(b.payloadRef.replace('notebook:', ''));
            const nbFile = created.find((c) => c.path.endsWith('.ipynb'));
            payload.fileId = nbFile.fileId;
          } else if (b.kind === 'OPENAPI') {
            const specFile = created.find((c) => c.path === b.payloadRef.replace('openapi:', ''));
            if (!specFile) continue;
            payload = {
              title: 'Payments & Billing API',
              version: '2025.09.1',
              description:
                'Idempotent billing API. All mutating endpoints accept an Idempotency-Key header. Webhooks are signed with HMAC-SHA256.',
              specFileId: specFile.fileId,
              endpoints: [
                { method: 'DELETE', path: '/subscriptions', summary: 'Cancel a subscription at period end', tags: ['Subscriptions'] },
                { method: 'GET', path: '/charges', summary: 'List charges for the tenant', tags: ['Charges'] },
                { method: 'GET', path: '/customers', summary: 'List customers (cursor pagination)', tags: ['Customers'] },
                { method: 'GET', path: '/customers/{id}', summary: 'Retrieve a customer', tags: ['Customers'] },
                { method: 'GET', path: '/webhooks', summary: 'List webhook endpoints', tags: ['Webhooks'] },
                { method: 'POST', path: '/charges', summary: 'Create an idempotent charge', tags: ['Charges'] },
                { method: 'POST', path: '/charges/{id}/refund', summary: 'Refund a charge (partial or full)', tags: ['Charges'] },
                { method: 'POST', path: '/customers', summary: 'Create a customer', tags: ['Customers'] },
                { method: 'POST', path: '/subscriptions', summary: 'Start a subscription', tags: ['Subscriptions'] },
                { method: 'POST', path: '/webhooks', summary: 'Register a webhook endpoint', tags: ['Webhooks'] },
              ],
            };
          }
        }
        await insertBlock(projectId, i, b.kind, b.source, payload);
      }
      const n = showcase.blocks.length;
      console.log(`[seed]   showcase: ${n} curated block(s)`);
    }
  }

  // Review for the decision gate flow
  const review = {
    projectTitle: 'Customer Feedback Analytics Dashboard',
    reviewerEmail: 'dave@company.com',
    scores: { innovation: 78, technicalDepth: 80, quality: 75, documentation: 85, businessValue: 82 },
    comments: ['Clear ingestion layer design', 'Sentiment classifier could use embeddings next'],
    overallFeedback: 'Solid full-stack delivery with good documentation and realistic scope.',
    recommendation: 'PROMOTE',
  };
  const reviewProjectId = projectIds[review.projectTitle];
  const reviewerId = userIds[review.reviewerEmail];
  await client.query(
    `INSERT INTO review (project_id, reviewer_id, review_type, scores_json, comments, overall_feedback, recommendation, status)
     VALUES ($1,$2,'PEER',$3::jsonb,$4::jsonb,$5,$6,'PENDING_APPROVAL')`,
    [reviewProjectId, reviewerId, JSON.stringify(review.scores), JSON.stringify(review.comments), review.overallFeedback, review.recommendation],
  );
  console.log(`[seed] peer review by ${review.reviewerEmail} (PENDING_APPROVAL)`);

  const SKILLS = [
    { email: 'alice@company.com', skill: 'React', category: 'FRONTEND', score: 82 },
    { email: 'alice@company.com', skill: 'Node.js', category: 'BACKEND', score: 76 },
    { email: 'alice@company.com', skill: 'PostgreSQL', category: 'DATABASE', score: 68 },
    { email: 'alice@company.com', skill: 'Testing', category: 'TESTING', score: 42 },
    { email: 'alice@company.com', skill: 'Security', category: 'SECURITY', score: 38 },
    { email: 'alice@company.com', skill: 'Design Systems', category: 'ARCHITECTURE', score: 74 },
    { email: 'carol@company.com', skill: 'Python', category: 'BACKEND', score: 80 },
    { email: 'carol@company.com', skill: 'Pandas', category: 'DATA', score: 84 },
    { email: 'carol@company.com', skill: 'SQL', category: 'DATABASE', score: 79 },
    { email: 'carol@company.com', skill: 'Docker', category: 'DEVOPS', score: 34 },
    { email: 'carol@company.com', skill: 'Machine Learning', category: 'DATA', score: 77 },
  ];
  for (const s of SKILLS) {
    await client.query(
      `INSERT INTO skill_assessment (user_id, skill, category, score, evidence_count, last_evaluated_at)
       VALUES ($1,$2,$3,$4,$5,NOW())
       ON CONFLICT (user_id, skill) DO UPDATE SET score = EXCLUDED.score`,
      [userIds[s.email], s.skill, s.category, s.score, 2],
    );
  }
  console.log(`[seed] ${SKILLS.length} skill assessments`);

  await client.end();
  console.log('[seed] done — demo login: alice@company.com / password123 (also carol, dave, bob)');
}

/** Build a minimal but realistic .ipynb (pre-executed outputs only). */
function buildNotebookFile(kind) {
  const payload = notebookPayload(kind);
  const nb = {
    cells: payload.cells.map((c) => {
      const base = { cell_type: c.type, metadata: {}, source: c.source.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) };
      if (c.type === 'code') {
        base.execution_count = null;
        base.outputs = c.outputs.map((o) => {
          if (o.kind === 'text') {
            return { output_type: 'stream', name: 'stdout', text: o.text.split('\n').map((l, i, a) => (i < a.length - 1 ? l + '\n' : l)) };
          }
          if (o.kind === 'image') {
            return {
              output_type: 'display_data',
              data: { 'image/png': o.data, 'text/plain': ['<Figure>'] },
              metadata: {},
            };
          }
          return { output_type: 'error', ename: 'Error', evalue: o.text ?? '', traceback: [] };
        });
      }
      return base;
    }),
    metadata: {
      kernelspec: { display_name: payload.kernelHint ?? 'Python 3', language: 'python', name: 'python3' },
      language_info: { name: 'python', version: '3.11.9' },
    },
    nbformat: 4,
    nbformat_minor: 5,
  };
  return nb;
}

main().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
