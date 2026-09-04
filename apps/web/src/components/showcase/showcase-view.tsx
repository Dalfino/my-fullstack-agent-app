'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BLOCK_PAYLOAD_SCHEMAS,
  ProjectFile,
  ProjectType,
  ShowcaseBlock,
  ShowcaseBlockKind,
  ShowcaseView as ShowcaseViewDto,
} from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient, waitForJob } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { BlockCard } from './block-card';
import { StoryBlock } from './story-block';
import { GalleryBlock } from './gallery-block';
import { NotebookBlock } from './notebook-block';
import { TerminalBlock } from './terminal-block';
import { OpenApiBlock } from './openapi-block';

const KIND_LABELS: Record<ProjectType, string> = {
  FULLSTACK: 'Fullstack app',
  DATA_ANALYSIS: 'Data analysis',
  ML_MODEL: 'ML model',
  API: 'API',
  SCRIPT: 'Script / CLI',
  DESIGN: 'Design',
};

/** Validate a block payload on read so one bad row can never break the page. */
function safePayload(block: ShowcaseBlock): Record<string, unknown> | null {
  const schema = BLOCK_PAYLOAD_SCHEMAS[block.kind as ShowcaseBlockKind];
  if (!schema) return null;
  const res = schema.safeParse(block.payload);
  return res.success ? (res.data as Record<string, unknown>) : null;
}

export function ShowcaseView({
  projectId,
  canEdit,
  imageFiles,
}: {
  projectId: string;
  canEdit: boolean;
  imageFiles: ProjectFile[];
}) {
  const { token } = useAuth();
  const [view, setView] = useState<ShowcaseViewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState('');
  const [showAddTerminal, setShowAddTerminal] = useState(false);
  const [showAddGallery, setShowAddGallery] = useState(false);

  // drag state
  const dragIndex = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [order, setOrder] = useState<ShowcaseBlock[] | null>(null);

  const fetchView = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiClient.get<ShowcaseViewDto>(`/projects/${projectId}/showcase`, token);
      setView(data);
      setOrder(data.blocks);
    } catch {
      setError('Failed to load showcase');
    } finally {
      setLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    void fetchView();
  }, [fetchView]);

  async function regenerate() {
    if (!token) return;
    setBusy('regenerate');
    setError('');
    try {
      const { jobId } = await apiClient.post<{ jobId: string }>(
        `/projects/${projectId}/showcase/generate`,
        {},
        token,
      );
      const job = await waitForJob(jobId, token, { timeoutMs: 90_000 });
      if (job.status === 'FAILED') setError(`Showcase build failed: ${job.error ?? 'unknown'}`);
      await fetchView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Showcase build failed');
    } finally {
      setBusy(null);
    }
  }

  async function deleteBlock(blockId: string) {
    if (!token) return;
    await apiClient.del(`/projects/${projectId}/showcase/blocks/${blockId}`, token).catch(() => undefined);
    await fetchView();
  }

  async function changeKind(kind: ProjectType) {
    if (!token) return;
    setBusy('kind');
    setError('');
    try {
      const fresh = await apiClient.put<ShowcaseViewDto>(
        `/projects/${projectId}/showcase/kind`,
        { kind },
        token,
      );
      setView(fresh);
      setOrder(fresh.blocks);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kind change failed');
    } finally {
      setBusy(null);
    }
  }

  async function commitReorder() {
    if (!order || !token || !view) return;
    setBusy('reorder');
    try {
      const blocks = await apiClient.put<ShowcaseBlock[]>(
        `/projects/${projectId}/showcase/reorder`,
        { orderedIds: order.map((b) => b.id) },
        token,
      );
      setOrder(blocks);
      setView({ ...view, blocks });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reorder failed');
      await fetchView();
    } finally {
      setBusy(null);
      dragIndex.current = null;
      setDraggingIdx(null);
    }
  }

  function onDragEnter(idx: number) {
    if (dragIndex.current === null || !order) return;
    const from = dragIndex.current;
    if (from === idx) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(idx, 0, moved);
    dragIndex.current = idx;
    setDraggingIdx(idx);
    setOrder(next);
  }

  async function addTerminal(title: string, command: string, linesText: string) {
    if (!token) return;
    const lines = linesText.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim() !== '');
    if (lines.length === 0) return;
    setBusy('add');
    try {
      await apiClient.post(
        `/projects/${projectId}/showcase/blocks`,
        {
          kind: 'TERMINAL',
          payload: { title: title || undefined, command: command || undefined, lines },
        },
        token,
      );
      setShowAddTerminal(false);
      await fetchView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add block');
    } finally {
      setBusy(null);
    }
  }

  async function addGallery(fileIds: string[]) {
    if (!token || fileIds.length === 0) return;
    setBusy('add');
    try {
      await apiClient.post(
        `/projects/${projectId}/showcase/blocks`,
        {
          kind: 'GALLERY',
          payload: {
            title: 'Selected visuals',
            items: fileIds.map((fileId) => ({ fileId })),
          },
        },
        token,
      );
      setShowAddGallery(false);
      await fetchView();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add gallery');
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading showcase…</div>;
  }

  const blocks = order ?? view?.blocks ?? [];
  const isEmpty = blocks.length === 0;

  return (
    <div className="space-y-4">
      {/* toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {view && (
            <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
              {KIND_LABELS[view.kind] ?? view.kind}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {isEmpty ? 'No visual story yet' : `${blocks.length} block${blocks.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded border border-input bg-background px-2 py-1.5 text-xs"
              value={view?.kind ?? ''}
              disabled={busy !== null}
              onChange={(e) => changeKind(e.target.value as ProjectType)}
              title="Showcase profile — drives how the project is presented"
            >
              {Object.entries(KIND_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setShowAddTerminal((v) => !v)}>
              + Terminal
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null || imageFiles.length === 0} onClick={() => setShowAddGallery((v) => !v)}>
              + Gallery
            </Button>
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={regenerate}>
              {busy === 'regenerate' ? 'Building…' : '↻ Rebuild with AI'}
            </Button>
            {!isEmpty && (
              <Button
                size="sm"
                variant={editMode ? 'default' : 'ghost'}
                onClick={() => {
                  setEditMode((v) => !v);
                  dragIndex.current = null;
                  setDraggingIdx(null);
                }}
              >
                {editMode ? 'Done reordering' : 'Reorder'}
              </Button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* add-terminal form */}
      {showAddTerminal && canEdit && (
        <TerminalForm
          busy={busy === 'add'}
          onCancel={() => setShowAddTerminal(false)}
          onSubmit={addTerminal}
        />
      )}

      {/* add-gallery picker */}
      {showAddGallery && canEdit && (
        <GalleryPicker files={imageFiles} busy={busy === 'add'} onCancel={() => setShowAddGallery(false)} onSubmit={addGallery} />
      )}

      {/* blocks */}
      {isEmpty ? (
        <div className="rounded-lg border border-dashed py-14 text-center">
          <p className="text-sm text-muted-foreground">
            The showcase is generated from this project&apos;s files — screenshots, notebooks,
            API specs and logs become visual blocks automatically.
          </p>
          {canEdit && (
            <Button size="sm" className="mt-4" disabled={busy !== null} onClick={regenerate}>
              {busy === 'regenerate' ? 'Building…' : '✦ Generate showcase'}
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {blocks.map((block, idx) => {
            const payload = safePayload(block);
            return (
              <BlockCard
                key={block.id}
                block={block}
                editMode={editMode}
                dragging={draggingIdx === idx}
                onDragStart={() => {
                  dragIndex.current = idx;
                  setDraggingIdx(idx);
                }}
                onDragEnter={() => onDragEnter(idx)}
                onDrop={commitReorder}
                onDelete={() => deleteBlock(block.id)}
              >
                {payload === null ? (
                  <p className="text-xs text-muted-foreground">This block has an unsupported payload.</p>
                ) : block.kind === ShowcaseBlockKind.STORY ? (
                  <StoryBlock payload={payload as never} />
                ) : block.kind === ShowcaseBlockKind.GALLERY ? (
                  <GalleryBlock projectId={projectId} payload={payload as never} />
                ) : block.kind === ShowcaseBlockKind.NOTEBOOK ? (
                  <NotebookBlock payload={payload as never} />
                ) : block.kind === ShowcaseBlockKind.TERMINAL ? (
                  <TerminalBlock payload={payload as never} />
                ) : block.kind === ShowcaseBlockKind.OPENAPI ? (
                  <OpenApiBlock payload={payload as never} />
                ) : null}
              </BlockCard>
            );
          })}
          {editMode && (
            <p className="text-center text-xs text-muted-foreground">
              Drag blocks to reorder — the order saves automatically when you drop.
            </p>
          )}
        </div>
      )}
    </div>
  );
}


/* ---------------------------- add-block forms --------------------------- */

function TerminalForm({
  busy,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  onCancel: () => void;
  onSubmit: (title: string, command: string, lines: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState('');
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-semibold">Add terminal replay</p>
      <p className="text-xs text-muted-foreground">
        Paste the captured output of a CLI run — viewers see it typed out like a live terminal.
      </p>
      <input
        className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
        placeholder="Title (e.g. csv_cleaner demo)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <input
        className="w-full rounded border border-input bg-background px-3 py-1.5 font-mono text-sm"
        placeholder="$ command that produced this output"
        value={command}
        onChange={(e) => setCommand(e.target.value)}
      />
      <textarea
        className="h-40 w-full rounded border border-input bg-background px-3 py-2 font-mono text-xs"
        placeholder="Paste terminal output here…"
        value={lines}
        onChange={(e) => setLines(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !lines.trim()} onClick={() => onSubmit(title, command, lines)}>
          {busy ? 'Adding…' : 'Add block'}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function GalleryPicker({
  files,
  busy,
  onCancel,
  onSubmit,
}: {
  files: ProjectFile[];
  busy: boolean;
  onCancel: () => void;
  onSubmit: (fileIds: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-2 rounded-lg border p-4">
      <p className="text-sm font-semibold">Add gallery from uploaded images</p>
      <div className="grid max-h-48 grid-cols-2 gap-2 overflow-auto sm:grid-cols-4">
        {files.map((f) => {
          const on = selected.has(f.id);
          return (
            <button
              key={f.id}
              className={`truncate rounded border px-2 py-1.5 text-left text-xs transition-colors ${
                on ? 'border-primary bg-primary/10' : 'hover:bg-accent'
              }`}
              onClick={() =>
                setSelected((s) => {
                  const next = new Set(s);
                  if (next.has(f.id)) next.delete(f.id);
                  else next.add(f.id);
                  return next;
                })
              }
              title={f.path}
            >
              {f.path.split('/').pop()}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || selected.size === 0} onClick={() => onSubmit([...selected])}>
          {busy ? 'Adding…' : `Add gallery (${selected.size})`}
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
