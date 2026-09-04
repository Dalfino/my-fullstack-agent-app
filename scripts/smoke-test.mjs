#!/usr/bin/env node
/**
 * End-to-end API smoke tests for TalentShowcase Phase 2/3.
 * Requires: DB running + API listening on :4000.
 * Usage: node scripts/smoke-test.mjs
 */
const BASE = 'http://localhost:4000/api/v1';
let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  ✗ ${name} ${detail ? '— ' + detail : ''}`);
  }
}

async function req(method, path, { token, body, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (raw) return res;
  try {
    return { status: res.status, data: await res.json() };
  } catch {
    return { status: res.status, data: null };
  }
}

async function waitJob(jobId, token) {
  for (let i = 0; i < 60; i++) {
    const { data } = await req('GET', `/jobs/${jobId}`, { token });
    if (data?.status === 'DONE') return data;
    if (data?.status === 'FAILED') return data;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { status: 'TIMEOUT' };
}

async function main() {
  console.log('\n== Health ==');
  const health = await req('GET', '/health');
  check('health ok', health.status === 200 && health.data.status === 'ok', JSON.stringify(health.data));
  check('database up', health.data?.services?.database === 'up');
  check('storage up', health.data?.services?.storage === 'up');
  check('queue transport reported', !!health.data?.services?.queue);

  console.log('\n== Auth ==');
  const badLogin = await req('POST', '/auth/login', { body: { email: 'alice@company.com', password: 'wrongpass' } });
  check('bad login rejected', badLogin.status === 401);

  const login = await req('POST', '/auth/login', { body: { email: 'alice@company.com', password: 'password123' } });
  check('talent login', login.status === 201 || login.status === 200, JSON.stringify(login.data));
  const aliceToken = login.data?.accessToken;
  const aliceId = login.data?.user?.id;
  check('tokens issued', !!aliceToken);

  const hrLogin = await req('POST', '/auth/login', { body: { email: 'bob@company.com', password: 'password123' } });
  const hrToken = hrLogin.data?.accessToken;
  const hrId = hrLogin.data?.user?.id;
  check('hr login', !!hrToken);

  const rvLogin = await req('POST', '/auth/login', { body: { email: 'dave@company.com', password: 'password123' } });
  const daveToken = rvLogin.data?.accessToken;
  const daveId = rvLogin.data?.user?.id;
  check('reviewer login', !!daveToken);

  console.log('\n== Projects & visibility ==');
  const list = await req('GET', '/projects', { token: aliceToken });
  check('project list', list.status === 200 && Array.isArray(list.data?.items));
  const seeded = list.data.items.find((p) => p.title === 'Warehouse Demand Forecasting Pipeline');
  const approved = list.data.items.find((p) => p.title === 'Customer Feedback Analytics Dashboard');
  check('seeded projects visible', !!seeded && !!approved);

  const created = await req('POST', '/projects', {
    token: aliceToken,
    body: {
      title: 'Smoke Test Project',
      description: 'Created by the automated smoke test',
      type: 'API',
      techStack: ['Node.js'],
      tags: ['smoke'],
    },
  });
  check('project created', created.status === 201 || created.status === 200, JSON.stringify(created.data));
  const projectId = created.data?.id;

  console.log('\n== Files: upload, scan, preview, comments ==');
  const uploadRes = await fetch(`${BASE}/projects/${projectId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: (() => {
      const fd = new FormData();
      fd.append('files', new File([Buffer.from("const x = 1;\nconsole.log('hello smoke');\nfunction add(a, b) {\n  if (a > 0) return a + b;\n  return b;\n}\n")], 'src/app.js', { type: 'text/plain' }));
      fd.append('files', new File([Buffer.from('# Smoke Test\n\nA tiny demo file.\n')], 'README.md', { type: 'text/markdown' }));
      return fd;
    })(),
  });
  const upload = await uploadRes.json();
  check('files uploaded', uploadRes.status < 300 && upload.uploaded === 2, JSON.stringify(upload));

  const virusRes = await fetch(`${BASE}/projects/${projectId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: (() => {
      const fd = new FormData();
      fd.append('files', new File([Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')], 'eicar.txt', { type: 'text/plain' }));
      return fd;
    })(),
  });
  const virus = await virusRes.json();
  check('virus scan blocks EICAR', virusRes.status === 400, JSON.stringify(virus));

  const fileList = await req('GET', `/projects/${projectId}/files`, { token: aliceToken });
  const firstFile = fileList.data?.[0];
  check('file list', Array.isArray(fileList.data) && fileList.data.length === 2);
  const content = await req('GET', `/projects/${projectId}/files/${firstFile.id}/content`, { token: aliceToken });
  check('file content preview', content.status === 200 && content.data?.lines?.length === 7, JSON.stringify(content.data?.lineCount));

  const comment = await req('POST', `/projects/${projectId}/comments`, {
    token: daveToken,
    body: { fileId: firstFile.id, body: 'Nice module — consider unit tests.', lineNumber: 1 },
  });
  check('comment created', comment.status === 201 || comment.status === 200, JSON.stringify(comment.data));
  const commentReply = await req('POST', `/projects/${projectId}/comments`, {
    token: aliceToken,
    body: { fileId: firstFile.id, body: 'Agreed, will add tests.', parentCommentId: comment.data?.id, lineNumber: 1 },
  });
  check('comment reply', commentReply.status === 201 || commentReply.status === 200);
  const threads = await req('GET', `/projects/${projectId}/comments?fileId=${firstFile.id}`, { token: aliceToken });
  check('threads grouped', threads.data?.length === 1 && threads.data[0].replies.length === 1, JSON.stringify(threads.data));
  const resolve = await req('PATCH', `/projects/${projectId}/comments/${comment.data.id}`, {
    token: daveToken,
    body: { resolved: true },
  });
  check('comment resolved', resolve.data?.resolved === true);

  console.log('\n== AI agents via async queue ==');
  const explainJob = await req('POST', `/projects/${projectId}/ai/explain`, { token: aliceToken });
  check('explain enqueued', !!explainJob.data?.jobId);
  const explainDone = await waitJob(explainJob.data.jobId, aliceToken);
  check('explain report generated', explainDone.status === 'DONE', explainDone.error ?? explainDone.status);

  const codeJob = await req('POST', `/projects/${projectId}/ai/code-analysis`, { token: aliceToken });
  const codeDone = await waitJob(codeJob.data.jobId, aliceToken);
  check('code analyst report', codeDone.status === 'DONE' && !!codeDone.result?.repoStats, codeDone.error);

  const secJob = await req('POST', `/projects/${projectId}/ai/security-scan`, { token: aliceToken });
  const secDone = await waitJob(secJob.data.jobId, aliceToken);
  check('security scan report', secDone.status === 'DONE' && typeof secDone.result?.riskRating === 'string', secDone.error);

  // Upload a secret-bearing file, then scan should flag it
  await fetch(`${BASE}/projects/${projectId}/files`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${aliceToken}` },
    body: (() => {
      const fd = new FormData();
      fd.append('files', new File([Buffer.from("const config = {\n  api_key: 'sk-live-0123456789abcdef',\n};\n")], 'config.js', { type: 'text/plain' }));
      return fd;
    })(),
  });
  const secJob2 = await req('POST', `/projects/${projectId}/ai/security-scan`, { token: aliceToken });
  const secDone2 = await waitJob(secJob2.data.jobId, aliceToken);
  check('security scanner finds secrets', secDone2.status === 'DONE' && secDone2.result?.totalFindings >= 1, JSON.stringify(secDone2.result?.totalFindings));

  const evalJob = await req('POST', `/projects/${projectId}/ai/evaluation`, { token: aliceToken });
  const evalDone = await waitJob(evalJob.data.jobId, aliceToken);
  check('evaluation report', evalDone.status === 'DONE' && !!evalDone.result?.scores?.overall, evalDone.error);
  check('evaluation wrote AI review', (evalDone.result?.recommendation ?? '') !== '');

  const careerJob = await req('POST', '/ai/career-advisor', { token: aliceToken, body: {} });
  const careerDone = await waitJob(careerJob.data.jobId, aliceToken);
  check('career advisor report', careerDone.status === 'DONE' && !!careerDone.result?.learningRoadmap, careerDone.error);

  const radar = await req('GET', `/users/${aliceId}/skill-radar`, { token: aliceToken });
  check('skill radar built from evaluation', radar.status === 200 && radar.data?.axes?.length === 9, JSON.stringify(radar.data?.axes?.length));

  const compare = await req('GET', `/skill-radar/compare?userA=${aliceId}&userB=${daveId}`, { token: aliceToken });
  check('radar comparison', compare.status === 200 && Array.isArray(compare.data?.delta));

  console.log('\n== Status transitions & decision gate ==');
  const submit = await req('POST', `/projects/${projectId}/status`, { token: aliceToken, body: { action: 'submit' } });
  check('owner submits', submit.data?.status === 'SUBMITTED', JSON.stringify(submit.data));

  const gate = await req('POST', `/projects/${projectId}/status`, { token: hrToken, body: { action: 'approve' } });
  check('decision gate blocks early approve', gate.status === 403, `status ${gate.status}`);
  check('project now UNDER_REVIEW is false positive check', submit.data?.status === 'SUBMITTED');

  const startReview = await req('POST', `/projects/${projectId}/status`, { token: daveToken, body: { action: 'start-review' } });
  check('reviewer starts review', startReview.data?.status === 'UNDER_REVIEW', JSON.stringify(startReview.data));

  // reviewer submits a review, HR approves the review, then decision gate passes
  const review = await req('POST', `/projects/${projectId}/reviews`, {
    token: daveToken,
    body: {
      reviewType: 'PEER',
      scoresJson: { innovation: 70, technicalDepth: 72, quality: 75, documentation: 65, businessValue: 68 },
      comments: ['Good structure'],
      overallFeedback: 'Solid API project.',
      recommendation: 'PROMOTE',
    },
  });
  check('review created', review.status === 201 || review.status === 200, JSON.stringify(review.data));
  const decide = await req('POST', `/reviews/${review.data.id}/decide`, { token: hrToken, body: { decision: 'APPROVE' } });
  check('HR approves review', decide.data?.status === 'APPROVED', JSON.stringify(decide.data));

  const approve = await req('POST', `/projects/${projectId}/status`, { token: hrToken, body: { action: 'approve' } });
  check('decision gate approves after approved review', approve.data?.status === 'APPROVED', JSON.stringify(approve.data ?? approve));

  console.log('\n== Admin, audit, MFA ==');
  const adminDenied = await req('GET', '/admin/stats', { token: aliceToken });
  check('admin blocked for non-HR', adminDenied.status === 403);
  const stats = await req('GET', '/admin/stats', { token: hrToken });
  check('platform stats', stats.status === 200 && stats.data?.users >= 4, JSON.stringify(stats.data));

  const audit = await req('GET', '/admin/audit-logs?pageSize=50', { token: hrToken });
  check('audit log populated', audit.status === 200 && audit.data?.items?.length >= 5, JSON.stringify(audit.data?.items?.length));
  const actions = new Set(audit.data.items.map((a) => a.action));
  check('audit has project + AI events', actions.has('PROJECT_STATUS_CHANGED') && actions.has('AI_REPORT_COMPLETED'), [...actions].join(','));

  // MFA setup + verify flow (generate a valid TOTP code via otplib from api deps)
  const setup = await req('POST', '/auth/mfa/setup', { token: aliceToken });
  check('mfa setup returns QR', setup.status === 200 && setup.data?.qrDataUrl?.startsWith('data:image'), JSON.stringify(setup.data?.secret));
  const { createRequire } = await import('node:module');
  const require2 = createRequire(new URL('../apps/api/package.json', import.meta.url));
  const otplib = require2('otplib');
  const code = otplib.generateSync({ secret: setup.data.secret });
  const enable = await req('POST', '/auth/mfa/enable', { token: aliceToken, body: { secret: setup.data.secret, code } });
  check('mfa enable with valid code', enable.status === 200 && enable.data?.mfaEnabled === true, JSON.stringify(enable.data));

  const loginMfa = await req('POST', '/auth/login', { body: { email: 'alice@company.com', password: 'password123' } });
  check('login requires MFA', loginMfa.data?.mfaRequired === true && !!loginMfa.data?.mfaTicket, JSON.stringify(loginMfa.data));
  const code2 = otplib.generateSync({ secret: setup.data.secret });
  const verify = await req('POST', '/auth/mfa/verify', { body: { ticket: loginMfa.data.mfaTicket, code: code2 } });
  check('mfa verify completes login', !!verify.data?.accessToken, JSON.stringify(verify.data));

  // disable MFA again to leave clean state
  const code3 = otplib.generateSync({ secret: setup.data.secret });
  const disable = await req('POST', '/auth/mfa/disable', { token: verify.data.accessToken, body: { code: code3 } });
  check('mfa disable', disable.data?.mfaEnabled === false);

  console.log('\n== Swagger & docs ==');
  const docs = await fetch('http://localhost:4000/docs').then((r) => r.status);
  check('swagger docs served', docs === 200 || docs === 304, `status ${docs}`);

  console.log(`\n=================================`);
  console.log(`RESULT: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('Failures:', failures.join(' | '));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('smoke test crashed:', err);
  process.exit(1);
});
