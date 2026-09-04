'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Project,
  ProjectFile,
  AiReport,
  ExplainReport,
  CodeAnalystReport,
  SecurityScanReport,
  EvaluationReport,
  Review,
  ReviewScores,
} from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient, waitForJob } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { FileViewer } from '@/components/file-viewer';
import { ShowcaseView } from '@/components/showcase/showcase-view';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type Tab = 'showcase' | 'overview' | 'ai' | 'files' | 'reviews';

const AGENTS = [
  { key: 'explain', label: 'Explain', endpoint: 'explain' },
  { key: 'code-analysis', label: 'Code Analyst', endpoint: 'code-analysis' },
  { key: 'security-scan', label: 'Security Scan', endpoint: 'security-scan' },
  { key: 'evaluation', label: 'Evaluation', endpoint: 'evaluation' },
] as const;

const EMPTY_SCORES: ReviewScores = {
  innovation: 60,
  technicalDepth: 60,
  quality: 60,
  documentation: 60,
  businessValue: 60,
};

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { token, loading, user } = useAuth();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [files, setFiles] = useState<ProjectFile[]>([]);
  const [reports, setReports] = useState<AiReport[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [tab, setTab] = useState<Tab>('showcase');
  const [busyAgent, setBusyAgent] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<ProjectFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewScores, setReviewScores] = useState<ReviewScores>(EMPTY_SCORES);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewRecommendation, setReviewRecommendation] = useState<'PROMOTE' | 'DEVELOP' | 'REJECT'>('DEVELOP');

  const isOwner = user && project && project.ownerId === user.id;
  const isExec = user?.role === 'HR_ADMIN' || user?.role === 'DEPT_HEAD';
  const isReviewer = user?.role === 'REVIEWER' || isExec;

  const refresh = useCallback(async () => {
    if (!token || !id) return;
    try {
      const [p, f, r, rv] = await Promise.all([
        apiClient.get<Project>(`/projects/${id}`, token),
        apiClient.get<ProjectFile[]>(`/projects/${id}/files`, token).catch(() => []),
        apiClient.get<AiReport[]>(`/projects/${id}/ai/reports`, token).catch(() => []),
        apiClient.get<Review[]>(`/projects/${id}/reviews`, token).catch(() => []),
      ]);
      setProject(p);
      setFiles(f);
      setReports(r);
      setReviews(rv);
    } catch {
      setError('Failed to load project');
    }
  }, [token, id]);

  useEffect(() => {
    if (!loading && !token) router.push('/login');
  }, [loading, token, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function runAgent(agentKey: string, endpoint: string) {
    if (!token) return;
    setBusyAgent(agentKey);
    setError('');
    try {
      const { jobId } = await apiClient.post<{ jobId: string }>(
        `/projects/${id}/ai/${endpoint}`,
        {},
        token,
      );
      const job = await waitForJob(jobId, token);
      if (job.status === 'FAILED') {
        setError(`Agent run failed: ${job.error ?? 'unknown error'}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Agent run failed');
    } finally {
      setBusyAgent(null);
    }
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || !token) return;
    setUploading(true);
    setError('');
    try {
      await apiClient.upload(`/projects/${id}/files`, Array.from(fileList), token);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function deleteFile(fileId: string) {
    if (!token) return;
    await apiClient.del(`/projects/${id}/files/${fileId}`, token).catch(() => undefined);
    setSelectedFile(null);
    await refresh();
  }

  async function statusAction(action: string) {
    if (!token) return;
    setStatusError('');
    try {
      await apiClient.post(`/projects/${id}/status`, { action }, token);
      await refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Status change failed');
    }
  }

  async function decideReview(reviewId: string, decision: 'APPROVE' | 'REJECT') {
    if (!token) return;
    await apiClient.post(`/reviews/${reviewId}/decide`, { decision }, token).catch(() => undefined);
    await refresh();
  }

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !user) return;
    try {
      await apiClient.post(
        '/reviews',
        {
          projectId: id,
          reviewType: 'PEER',
          scoresJson: reviewScores,
          comments: [],
          overallFeedback: reviewFeedback,
          recommendation: reviewRecommendation,
        },
        token,
      );
      setShowReviewForm(false);
      setReviewScores(EMPTY_SCORES);
      setReviewFeedback('');
      await refresh();
    } catch (err) {
      setStatusError(err instanceof Error ? err.message : 'Review failed');
    }
  }

  if (loading || !project) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  const reportFor = (agentType: string) =>
    reports.find((r) => r.agentType === agentType) ?? null;
  const explain = reportFor('EXPLAIN')?.reportJson as unknown as ExplainReport | undefined;
  const codeReport = reportFor('CODE_ANALYST')?.reportJson as unknown as CodeAnalystReport | undefined;
  const secReport = reportFor('SECURITY_SCANNER')?.reportJson as unknown as SecurityScanReport | undefined;
  const evalReport = reportFor('REVIEW_EVALUATION')?.reportJson as unknown as EvaluationReport | undefined;

  const tabs: Array<{ key: Tab; label: string }> = [
    { key: 'showcase', label: '✦ Showcase' },
    { key: 'overview', label: 'Overview' },
    { key: 'ai', label: `AI Reports (${reports.length})` },
    { key: 'files', label: `Files (${files.length})` },
    { key: 'reviews', label: `Reviews (${reviews.length})` },
  ];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-2">
            <Badge>{project.type}</Badge>
            <Badge variant="secondary">{project.status}</Badge>
            <Badge variant="outline">{project.visibility}</Badge>
          </div>
          <div className="mt-3 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold">{project.title}</h1>
              <p className="mt-1 text-muted-foreground">{project.owner?.name} · {project.description}</p>
            </div>
            {project.aiScore != null && (
              <div className="text-right">
                <div className="text-4xl font-bold text-primary">{project.aiScore}</div>
                <div className="text-xs text-muted-foreground">AI Score</div>
              </div>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {(project.techStack ?? []).map((tech) => (
              <Badge key={tech} variant="secondary">{tech}</Badge>
            ))}
          </div>
          {isReviewer && (
            <div className="mt-4 flex flex-wrap gap-2">
              {project.status === 'SUBMITTED' && (
                <Button size="sm" variant="outline" onClick={() => statusAction('start-review')}>
                  Start review
                </Button>
              )}
              {project.status === 'UNDER_REVIEW' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => statusAction('needs-work')}>
                    Send back (needs work)
                  </Button>
                  {isExec && (
                    <Button size="sm" onClick={() => statusAction('approve')} title="Requires at least one approved human review">
                      Approve (decision gate)
                    </Button>
                  )}
                </>
              )}
              {(project.status === 'APPROVED' && (isExec || isOwner)) && (
                <Button size="sm" variant="outline" onClick={() => statusAction('archive')}>
                  Archive
                </Button>
              )}
            </div>
          )}
          {statusError && <p className="mt-2 text-sm text-destructive">{statusError}</p>}
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 border-b">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

        {/* Showcase — type-aware visual story (first tab) */}
        {tab === 'showcase' && (
          <ShowcaseView
            projectId={id}
            canEdit={Boolean(isOwner || isExec)}
            imageFiles={files.filter((f) => /\.(png|jpe?g|gif|webp|svg|bmp)$/i.test(f.path))}
          />
        )}

        {/* Overview */}
        {tab === 'overview' && (
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>AI Summary</CardTitle>
                <CardDescription>Generated by the Explain agent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {explain ? (
                  <>
                    <p>{explain.executiveSummary}</p>
                    <div>
                      <h4 className="mb-1 font-semibold">For Managers</h4>
                      <p className="text-muted-foreground">{explain.managerSummary}</p>
                    </div>
                    <div>
                      <h4 className="mb-1 font-semibold">Key Highlights</h4>
                      <ul className="list-disc pl-5 text-muted-foreground">
                        {explain.keyHighlights.map((h, i) => <li key={i}>{h}</li>)}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground">No summary yet — run the Explain agent in the AI Reports tab.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* AI Reports */}
        {tab === 'ai' && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {AGENTS.map((a) => {
                const r = reports.find((x) => x.agentType === AGENT_TYPE_MAP[a.key]);
                return (
                  <Card key={a.key} className="flex flex-col justify-between">
                    <CardContent className="pt-4">
                      <div className="font-medium">{a.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {r ? `confidence ${r.confidenceScore ?? '—'} · ${new Date(r.createdAt).toLocaleDateString()}` : 'not run yet'}
                      </div>
                    </CardContent>
                    <CardContent className="pb-4">
                      <Button
                        size="sm"
                        className="w-full"
                        disabled={busyAgent !== null}
                        onClick={() => runAgent(a.key, a.endpoint)}
                      >
                        {busyAgent === a.key ? 'Running...' : r ? 'Re-run' : 'Run agent'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {codeReport && (
              <Card>
                <CardHeader>
                  <CardTitle>Code Analyst</CardTitle>
                  <CardDescription>{codeReport.architectureOverview}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{codeReport.executiveSummary}</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <Stat label="Files" value={codeReport.repoStats.totalFiles} />
                    <Stat label="Lines" value={codeReport.repoStats.totalLines} />
                    <Stat label="Avg complexity" value={`${codeReport.repoStats.avgComplexity}/10`} />
                    <Stat label="Languages" value={Object.keys(codeReport.repoStats.languages).length} />
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Strengths</h4>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {codeReport.strengths.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Improvement areas</h4>
                    <ul className="list-disc pl-5 text-muted-foreground">
                      {codeReport.improvementAreas.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )}

            {secReport && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Security Scanner</CardTitle>
                    <Badge
                      variant={
                        secReport.riskRating === 'CLEAN' || secReport.riskRating === 'LOW'
                          ? 'secondary'
                          : 'destructive'
                      }
                    >
                      Risk: {secReport.riskRating}
                    </Badge>
                  </div>
                  <CardDescription>
                    {secReport.scannedFiles} files / {secReport.scannedLines} lines scanned ·{' '}
                    {secReport.totalFindings} findings
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{secReport.executiveSummary}</p>
                  {secReport.findings.slice(0, 10).map((f) => (
                    <div key={f.id} className="rounded border p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={f.severity === 'CRITICAL' || f.severity === 'HIGH' ? 'destructive' : 'secondary'}>
                          {f.severity}
                        </Badge>
                        <span className="font-mono text-xs">{f.filePath}{f.lineNumber ? `:${f.lineNumber}` : ''}</span>
                      </div>
                      <p className="mt-1">{f.description}</p>
                      <p className="text-xs text-muted-foreground">Fix: {f.remediation}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {evalReport && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Evaluation</CardTitle>
                    <Badge>{evalReport.recommendation}</Badge>
                  </div>
                  <CardDescription>{evalReport.executiveSummary}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {Object.entries(evalReport.scores).map(([k, v]) => (
                      <Stat key={k} label={k} value={v as number} />
                    ))}
                  </div>
                  <div>
                    <h4 className="mb-1 font-semibold">Detected skills</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {evalReport.detectedSkills.map((s) => (
                        <Badge key={s.skill} variant="secondary">{s.skill} · {s.score}</Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Files */}
        {tab === 'files' && (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <Card className="h-fit">
              <CardHeader>
                <CardTitle>Project Files</CardTitle>
                <CardDescription>{files.length} file(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {(isOwner || isExec) && (
                  <div className="mb-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUpload(e.target.files)}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full"
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploading ? 'Uploading...' : 'Upload files'}
                    </Button>
                  </div>
                )}
                <ul className="space-y-1">
                  {files.map((f) => (
                    <li key={f.id}>
                      <button
                        className={`w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent ${
                          selectedFile?.id === f.id ? 'bg-accent' : ''
                        }`}
                        onClick={() => setSelectedFile(f)}
                      >
                        <div className="font-mono text-xs">{f.path}</div>
                        <div className="text-xs text-muted-foreground">
                          {f.language ?? 'unknown'} · {f.lineCount ?? 0} lines
                        </div>
                      </button>
                    </li>
                  ))}
                  {files.length === 0 && (
                    <li className="text-sm text-muted-foreground">No files yet.</li>
                  )}
                </ul>
                {selectedFile && (isOwner || isExec) && (
                  <Button
                    size="sm"
                    variant="destructive"
                    className="mt-3 w-full"
                    onClick={() => deleteFile(selectedFile.id)}
                  >
                    Delete selected file
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                {selectedFile ? (
                  <FileViewer projectId={id} file={selectedFile} />
                ) : (
                  <p className="text-sm text-muted-foreground">Select a file to preview it and join the discussion.</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Reviews */}
        {tab === 'reviews' && (
          <div className="space-y-4">
            {isReviewer && (
              <Button size="sm" onClick={() => setShowReviewForm((v) => !v)}>
                {showReviewForm ? 'Cancel' : 'Write a review'}
              </Button>
            )}
            {showReviewForm && (
              <Card>
                <CardHeader>
                  <CardTitle>New Review</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitReview} className="space-y-3">
                    {(
                      Object.keys(reviewScores) as Array<keyof ReviewScores>
                    ).map((k) => (
                      <div key={k} className="flex items-center gap-3">
                        <label className="w-36 text-sm capitalize">{k.replace(/([A-Z])/g, ' $1')}</label>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={reviewScores[k]}
                          onChange={(e) =>
                            setReviewScores((s) => ({ ...s, [k]: Number(e.target.value) }))
                          }
                          className="flex-1"
                        />
                        <span className="w-10 text-sm text-right">{reviewScores[k]}</span>
                      </div>
                    ))}
                    <div className="flex items-center gap-3">
                      <label className="w-36 text-sm">Recommendation</label>
                      <select
                        value={reviewRecommendation}
                        onChange={(e) => setReviewRecommendation(e.target.value as never)}
                        className="rounded border border-input bg-background px-2 py-1 text-sm"
                      >
                        <option value="PROMOTE">PROMOTE</option>
                        <option value="DEVELOP">DEVELOP</option>
                        <option value="REJECT">REJECT</option>
                      </select>
                    </div>
                    <textarea
                      className="w-full rounded border border-input bg-background px-3 py-2 text-sm"
                      rows={3}
                      placeholder="Overall feedback"
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                    />
                    <Button type="submit" size="sm">Submit review</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {reviews.map((r) => (
              <Card key={r.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {r.reviewType === 'AI' ? 'AI review' : (r as { reviewer?: { name?: string } }).reviewer?.name ?? 'Reviewer'}
                    </CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="secondary">{r.recommendation}</Badge>
                      <Badge variant={r.status === 'PENDING_APPROVAL' ? 'outline' : 'secondary'}>
                        {r.status}
                      </Badge>
                    </div>
                  </div>
                  {r.overallFeedback && <CardDescription>{r.overallFeedback}</CardDescription>}
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {Object.entries(r.scoresJson ?? {}).map(([k, v]) => (
                      <Stat key={k} label={k} value={v as number} />
                    ))}
                  </div>
                  {isExec && r.status === 'PENDING_APPROVAL' && r.reviewType !== 'AI' && (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decideReview(r.id, 'APPROVE')}>Approve review</Button>
                      <Button size="sm" variant="outline" onClick={() => decideReview(r.id, 'REJECT')}>Reject review</Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {reviews.length === 0 && (
              <p className="text-sm text-muted-foreground">No reviews yet.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded border p-2 text-center">
      <div className="text-lg font-semibold">{value}</div>
      <div className="text-xs capitalize text-muted-foreground">{label.replace(/([A-Z])/g, ' $1')}</div>
    </div>
  );
}

const AGENT_TYPE_MAP: Record<string, string> = {
  explain: 'EXPLAIN',
  'code-analysis': 'CODE_ANALYST',
  'security-scan': 'SECURITY_SCANNER',
  evaluation: 'REVIEW_EVALUATION',
};
