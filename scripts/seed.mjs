#!/usr/bin/env node
/**
 * Demo seed for TalentShowcase.
 * Creates users, projects with files, reviews and skill assessments so the
 * platform has realistic data on first boot. Idempotent: safe to re-run.
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
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# Customer Feedback Analytics Dashboard\n\nIngests feedback from multiple channels and visualises sentiment trends.\n\n## Features\n- Multi-channel ingestion (email, webhooks, CSV import)\n- Sentiment classification pipeline\n- Interactive trend dashboard\n- Role-based access control\n',
      },
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
      {
        path: 'README.md',
        language: 'markdown',
        content:
          '# Warehouse Demand Forecasting\n\nPredicts SKU-level demand 14 days ahead using gradient boosting on engineered lag features.\n\n## Design\n- Airflow DAGs orchestrate ingestion, features, training, backtest\n- Drift alerts via Slack webhook\n',
      },
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
    ],
  },
];

const REVIEW = {
  projectTitle: 'Customer Feedback Analytics Dashboard',
  reviewerEmail: 'dave@company.com',
  scores: { innovation: 78, technicalDepth: 80, quality: 75, documentation: 85, businessValue: 82 },
  comments: ['Clear ingestion layer design', 'Sentiment classifier could use embeddings next'],
  overallFeedback: 'Solid full-stack delivery with good documentation and realistic scope.',
  recommendation: 'PROMOTE',
};

const SKILLS = [
  { email: 'alice@company.com', skill: 'React', category: 'FRONTEND', score: 82 },
  { email: 'alice@company.com', skill: 'Node.js', category: 'BACKEND', score: 76 },
  { email: 'alice@company.com', skill: 'PostgreSQL', category: 'DATABASE', score: 68 },
  { email: 'alice@company.com', skill: 'Testing', category: 'TESTING', score: 42 },
  { email: 'alice@company.com', skill: 'Security', category: 'SECURITY', score: 38 },
  { email: 'carol@company.com', skill: 'Python', category: 'BACKEND', score: 80 },
  { email: 'carol@company.com', skill: 'Pandas', category: 'DATA', score: 84 },
  { email: 'carol@company.com', skill: 'SQL', category: 'DATABASE', score: 79 },
  { email: 'carol@company.com', skill: 'Docker', category: 'DEVOPS', score: 34 },
];

async function main() {
  await client.connect();
  console.log('[seed] connected');

  if (force) {
    // Wipe previous demo data so repeated runs stay clean
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

    for (const f of p.files) {
      const buffer = Buffer.from(f.content, 'utf8');
      const s3Key = `projects/${projectId}/${Date.now()}-${Math.random().toString(36).slice(2)}-${f.path}`;
      const lineCount = f.content.split('\n').length;

      // Write the object to local-disk fallback storage layout used by the API
      const storageDir = path.resolve(__dirname, '../.storage');
      const fileDir = path.dirname(path.join(storageDir, s3Key.replace(/\.\./g, '_')));
      fs.mkdirSync(fileDir, { recursive: true });
      fs.writeFileSync(path.join(storageDir, s3Key.replace(/\.\./g, '_')), buffer);

      await client.query(
        `INSERT INTO project_file (project_id, path, size, mime_type, s3_key, line_count, language, is_entry_point)
         VALUES ($1,$2,$3,$4,$5,$6,$7,false)`,
        [projectId, f.path, buffer.length, 'text/plain', s3Key, lineCount, f.language],
      );
    }
    console.log(`[seed]   ${p.files.length} file(s) written to storage`);
  }

  // Review for the decision gate flow
  const review = REVIEW;
  const projectId = projectIds[review.projectTitle];
  const reviewerId = userIds[review.reviewerEmail];
  await client.query(
    `INSERT INTO review (project_id, reviewer_id, review_type, scores_json, comments, overall_feedback, recommendation, status)
     VALUES ($1,$2,'PEER',$3::jsonb,$4::jsonb,$5,$6,'PENDING_APPROVAL')`,
    [projectId, reviewerId, JSON.stringify(review.scores), JSON.stringify(review.comments), review.overallFeedback, review.recommendation],
  );
  console.log(`[seed] peer review by ${review.reviewerEmail} (PENDING_APPROVAL)`);

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

main().catch(async (err) => {
  console.error('[seed] failed:', err.message);
  try { await client.end(); } catch {}
  process.exit(1);
});
