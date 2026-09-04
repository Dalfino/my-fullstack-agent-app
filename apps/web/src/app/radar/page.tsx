'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SkillRadar, RadarComparison } from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient, waitForJob } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { RadarChart } from '@/components/radar-chart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface UserOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function RadarPage() {
  const { token, user, loading } = useAuth();
  const router = useRouter();
  const [radar, setRadar] = useState<SkillRadar | null>(null);
  const [compareRadar, setCompareRadar] = useState<SkillRadar | null>(null);
  const [careerReport, setCareerReport] = useState<Record<string, unknown> | null>(null);
  const [people, setPeople] = useState<UserOption[]>([]);
  const [compareWith, setCompareWith] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !token) router.push('/login');
  }, [loading, token, router]);

  const loadRadar = useCallback(async () => {
    if (!token || !user) return;
    try {
      const r = await apiClient.get<SkillRadar>(`/users/${user.id}/skill-radar`, token);
      setRadar(r);
    } catch {
      setError('Failed to load skill radar');
    }
  }, [token, user]);

  const loadCareer = useCallback(async () => {
    if (!token || !user) return;
    try {
      const r = await apiClient.get<Record<string, unknown>>(
        `/ai/career-advisor/latest?userId=${user.id}`,
        token,
      );
      setCareerReport((r.reportJson ?? null) as Record<string, unknown> | null);
    } catch {
      setCareerReport(null);
    }
  }, [token, user]);

  useEffect(() => {
    void loadRadar();
    void loadCareer();
    // Admin endpoint lists all users; non-admins fall back to empty list
    if (token && user) {
      apiClient
        .get<{ items: UserOption[] }>('/admin/users?pageSize=100', token)
        .then((res) => setPeople(res.items))
        .catch(() => setPeople([]));
    }
  }, [token, user, loadRadar, loadCareer]);

  async function runCareerAdvisor() {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      const { jobId } = await apiClient.post<{ jobId: string }>(
        '/ai/career-advisor',
        { userId: user?.id },
        token,
      );
      const job = await waitForJob(jobId, token);
      if (job.status === 'FAILED') setError(`Advisor failed: ${job.error}`);
      else await loadCareer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advisor failed');
    } finally {
      setBusy(false);
    }
  }

  async function runCompare() {
    if (!token || !user || !compareWith) return;
    setBusy(true);
    setError('');
    try {
      const cmp = await apiClient.get<RadarComparison>(
        `/skill-radar/compare?userA=${user.id}&userB=${compareWith}`,
        token,
      );
      setCompareRadar(cmp.userB.radar);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Comparison failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const roadmap = (careerReport?.learningRoadmap ?? []) as Array<{
    step: number;
    title: string;
    description: string;
    suggestedResources: string[];
    estimatedWeeks: number;
  }>;
  const careerPaths = (careerReport?.careerPaths ?? []) as Array<{
    title: string;
    fitScore: number;
    rationale: string;
  }>;
  const gaps = (careerReport?.gaps ?? []) as Array<{ area: string; detail: string; priority: string }>;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-3xl font-bold">Skill Radar</h1>
        <p className="mt-1 text-muted-foreground">
          Competency overview built from AI evaluations of your submitted projects.
        </p>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Your Radar</CardTitle>
              <CardDescription>
                Overall score: {radar?.overallScore ?? '—'}/100
                {radar?.strengths?.length
                  ? ` · strengths: ${radar.strengths.slice(0, 2).join(', ').toLowerCase()}`
                  : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              {radar ? <RadarChart data={radar} compare={compareRadar} /> : <p>Loading...</p>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Compare with a colleague</CardTitle>
                <CardDescription>Overlay their radar on yours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <select
                  className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
                  value={compareWith}
                  onChange={(e) => setCompareWith(e.target.value)}
                >
                  <option value="">Select a person…</option>
                  {people
                    .filter((p) => p.id !== user.id)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.email})
                      </option>
                    ))}
                </select>
                <Button size="sm" disabled={!compareWith || busy} onClick={runCompare}>
                  Compare
                </Button>
                {compareRadar && (
                  <Button size="sm" variant="ghost" onClick={() => setCompareRadar(null)}>
                    Clear overlay
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Career Advisor</CardTitle>
                  <Button size="sm" onClick={runCareerAdvisor} disabled={busy}>
                    {busy ? 'Analyzing…' : careerReport ? 'Refresh plan' : 'Generate plan'}
                  </Button>
                </div>
                <CardDescription>
                  {careerReport
                    ? String(careerReport.executiveSummary ?? '')
                    : 'AI-generated development plan based on your skill radar.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {gaps.length > 0 && (
                  <div>
                    <h4 className="mb-1 font-semibold">Priority gaps</h4>
                    {gaps.map((g) => (
                      <p key={g.area} className="text-muted-foreground">
                        <Badge variant="outline" className="mr-1">{g.priority}</Badge>
                        {g.area} — {g.detail}
                      </p>
                    ))}
                  </div>
                )}
                {roadmap.map((step) => (
                  <div key={step.step} className="rounded border p-3">
                    <div className="flex items-center gap-2">
                      <Badge>Step {step.step}</Badge>
                      <span className="font-medium">{step.title}</span>
                      <span className="ml-auto text-xs text-muted-foreground">~{step.estimatedWeeks}w</span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{step.description}</p>
                    {step.suggestedResources?.length > 0 && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Resources: {step.suggestedResources.join(' · ')}
                      </p>
                    )}
                  </div>
                ))}
                {careerPaths.length > 0 && (
                  <div>
                    <h4 className="mb-1 font-semibold">Career path fits</h4>
                    {careerPaths.map((c) => (
                      <p key={c.title} className="text-muted-foreground">
                        {c.title} — fit {c.fitScore}/100
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
