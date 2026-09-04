/**
 * k6 load test for TalentShowcase (Phase 3 performance gate).
 *
 * Simulates the primary user journeys against the API:
 *   1. login (auth path, bcrypt cost dominated)
 *   2. browse projects (visibility-filtered list)
 *   3. project detail + files
 *   4. job status polling
 *
 * Usage:
 *   k6 run load/smoke.js
 *   BASE_URL=http://staging:4000 k6 run load/smoke.js
 *   k6 run -e VUS=100 -e DURATION=2m load/smoke.js
 */
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000/api/v1';
const VUS = __ENV.VUS || '50';
const DURATION = __ENV.DURATION || '30s';

const loginDuration = new Trend('login_duration', true);
const listDuration = new Trend('projects_list_duration', true);
const loginFailureRate = new Rate('login_failures');

export const options = {
  stages: [
    { duration: '10s', target: Math.ceil(Number(VUS) / 2) }, // ramp up
    { duration: DURATION, target: Number(VUS) }, // steady state
    { duration: '10s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_failed: ['rate<0.01'], // <1% errors
    http_req_duration: ['p(95)<1500'], // 95% under 1.5s (PERF-2)
    'http_req_duration{group:::browse}': ['p(95)<800'],
  },
};

const USERS = [
  { email: 'alice@company.com', password: 'password123' },
  { email: 'carol@company.com', password: 'password123' },
  { email: 'dave@company.com', password: 'password123' },
  { email: 'bob@company.com', password: 'password123' },
];

export function setup() {
  // Warm up + verify the API is alive before load
  const res = http.get(`${BASE_URL}/health`);
  check(res, { 'health is 200': (r) => r.status === 200 });
}

export default function () {
  const user = USERS[__VU % USERS.length];

  group('auth', () => {
    const res = http.post(
      `${BASE_URL}/auth/login`,
      JSON.stringify(user),
      { headers: { 'Content-Type': 'application/json' } },
    );
    loginDuration.add(res.timings.duration);
    const ok = check(res, {
      'login 201/200': (r) => r.status === 200 || r.status === 201,
      'token issued': (r) => !!r.json('accessToken'),
    });
    loginFailureRate.add(!ok);
    if (!ok) return;

    const token = res.json('accessToken');

    group('browse', () => {
      const list = http.get(`${BASE_URL}/projects?page=1&pageSize=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      listDuration.add(list.timings.duration);
      check(list, {
        'projects 200': (r) => r.status === 200,
        'paginated shape': (r) => r.json('items') !== undefined,
      });

      const items = list.json('items') || [];
      if (items.length > 0) {
        const projectId = items[0].id;
        const detail = http.get(`${BASE_URL}/projects/${projectId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(detail, { 'detail 200': (r) => r.status === 200 });

        const files = http.get(`${BASE_URL}/projects/${projectId}/files`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(files, { 'files 200': (r) => r.status === 200 });

        const reviews = http.get(`${BASE_URL}/projects/${projectId}/reviews`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        check(reviews, { 'reviews 200': (r) => r.status === 200 });
      }
    });

    group('jobs', () => {
      const jobs = http.get(`${BASE_URL}/jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      check(jobs, { 'jobs 200': (r) => r.status === 200 });
    });
  });

  sleep(1);
}
