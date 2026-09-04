'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface FileLine {
  number: number;
  content: string;
}

interface CommentDto {
  id: string;
  fileId: string;
  projectId: string;
  authorId: string;
  parentCommentId?: string | null;
  body: string;
  lineNumber?: number | null;
  endLineNumber?: number | null;
  resolved: boolean;
  resolvedAt?: string | null;
  createdAt: string;
  author?: { id: string; name: string; role: string } | null;
}

interface ThreadPair {
  root: CommentDto;
  replies: CommentDto[];
}

interface FileViewerProps {
  projectId: string;
  file: { id: string; path: string; language?: string | null; lineCount?: number | null };
}

/** Code preview with line numbers and inline comment threads. */
export function FileViewer({ projectId, file }: FileViewerProps) {
  const { token, user } = useAuth();
  const [lines, setLines] = useState<FileLine[]>([]);
  const [threads, setThreads] = useState<ThreadPair[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [commentBody, setCommentBody] = useState('');
  const [replyBodies, setReplyBodies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const content = await apiClient.get<{ lines: FileLine[] }>(
        `/projects/${projectId}/files/${file.id}/content`,
        token,
      );
      setLines(content.lines);
      const t = await apiClient.get<ThreadPair[]>(
        `/projects/${projectId}/comments?fileId=${file.id}`,
        token,
      );
      setThreads(t);
    } catch {
      setLines([{ number: 1, content: '(failed to load file content)' }]);
    } finally {
      setLoading(false);
    }
  }, [token, projectId, file.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const commentsAt = (line: number) =>
    threads.filter((t) => (t.root.lineNumber ?? -1) === line);

  async function postComment(line: number | null, parentCommentId?: string, body?: string) {
    if (!token) return;
    const text = body ?? commentBody;
    if (!text.trim()) return;
    setBusy(true);
    try {
      await apiClient.post(
        `/projects/${projectId}/comments`,
        {
          fileId: file.id,
          body: text.trim(),
          lineNumber: line ?? undefined,
          parentCommentId,
        },
        token,
      );
      if (!parentCommentId) setCommentBody('');
      else setReplyBodies((r) => ({ ...r, [parentCommentId]: '' }));
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function toggleResolve(thread: ThreadPair) {
    if (!token) return;
    setBusy(true);
    try {
      await apiClient.patch(
        `/projects/${projectId}/comments/${thread.root.id}`,
        { resolved: !thread.root.resolved },
        token,
      );
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="py-6 text-sm text-muted-foreground">Loading file...</p>;

  const resolvedCount = threads.filter((t) => t.root.resolved).length;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-mono text-sm font-semibold">{file.path}</h3>
          <p className="text-xs text-muted-foreground">
            {file.language ?? 'plaintext'} · {file.lineCount ?? lines.length} lines ·{' '}
            {threads.length - resolvedCount} open thread(s)
          </p>
        </div>
        <Badge variant="secondary">click a line number to comment</Badge>
      </div>

      <div className="overflow-x-auto rounded-md border">
        {lines.map((line) => {
          const atLine = commentsAt(line.number);
          return (
            <div key={line.number}>
              <div
                className={`flex text-xs leading-6 ${
                  selectedLine === line.number ? 'bg-accent/40' : ''
                } ${atLine.some((t) => !t.root.resolved) ? 'bg-amber-50' : ''}`}
              >
                <button
                  className="w-12 shrink-0 select-none border-r px-2 text-right text-muted-foreground hover:bg-accent"
                  onClick={() => setSelectedLine(selectedLine === line.number ? null : line.number)}
                  title="Add comment"
                >
                  {line.number}
                </button>
                <pre className="flex-1 whitespace-pre-wrap px-3 font-mono">{line.content}</pre>
              </div>

              {atLine.map((thread) => (
                <div
                  key={thread.root.id}
                  className={`border-y bg-muted/40 px-4 py-2 text-xs ${
                    thread.root.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p>
                      <span className="font-semibold">{thread.root.author?.name ?? 'user'}</span>
                      <span className="ml-2 text-muted-foreground">{thread.root.body}</span>
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      {thread.root.resolved && <Badge>resolved</Badge>}
                      {user && (
                        <Button variant="ghost" size="sm" onClick={() => toggleResolve(thread)} disabled={busy}>
                          {thread.root.resolved ? 'Reopen' : 'Resolve'}
                        </Button>
                      )}
                    </div>
                  </div>
                  {thread.replies.map((r) => (
                    <p key={r.id} className="ml-4 mt-1 border-l-2 pl-2 text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.author?.name ?? 'user'}</span> {r.body}
                    </p>
                  ))}
                  {user && (
                    <div className="ml-4 mt-1 flex gap-1">
                      <input
                        className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                        placeholder="Reply..."
                        value={replyBodies[thread.root.id] ?? ''}
                        onChange={(e) =>
                          setReplyBodies((r) => ({ ...r, [thread.root.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && (replyBodies[thread.root.id] ?? '').trim()) {
                            void postComment(
                              thread.root.lineNumber ?? line.number,
                              thread.root.id,
                              replyBodies[thread.root.id],
                            );
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busy || !(replyBodies[thread.root.id] ?? '').trim()}
                        onClick={() =>
                          postComment(
                            thread.root.lineNumber ?? line.number,
                            thread.root.id,
                            replyBodies[thread.root.id],
                          )
                        }
                      >
                        Reply
                      </Button>
                    </div>
                  )}
                </div>
              ))}

              {selectedLine === line.number && user && (
                <div className="border-y bg-accent/20 px-4 py-2">
                  <div className="flex gap-2">
                    <input
                      autoFocus
                      className="flex-1 rounded border border-input bg-background px-2 py-1 text-xs"
                      placeholder={`Comment on line ${line.number}...`}
                      value={commentBody}
                      onChange={(e) => setCommentBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && commentBody.trim()) {
                          void postComment(line.number);
                        }
                      }}
                    />
                    <Button
                      size="sm"
                      disabled={busy || !commentBody.trim()}
                      onClick={() => postComment(line.number)}
                    >
                      Comment
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
