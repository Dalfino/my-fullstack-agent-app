'use client';

import { ShowcaseBlock } from '@talentshowcase/types';

export const BLOCK_META: Record<string, { label: string; icon: string }> = {
  STORY: { label: 'Story', icon: '✦' },
  GALLERY: { label: 'Gallery', icon: '🖼' },
  NOTEBOOK: { label: 'Notebook', icon: '📓' },
  TERMINAL: { label: 'Terminal', icon: '▮' },
  OPENAPI: { label: 'API Explorer', icon: '{ }' },
};

/** Consistent chrome around every showcase block (badge, drag handle, delete). */
export function BlockCard({
  block,
  editMode,
  dragging,
  onDragStart,
  onDragEnter,
  onDrop,
  onDelete,
  children,
}: {
  block: ShowcaseBlock;
  editMode: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDrop?: () => void;
  onDelete?: () => void;
  children: React.ReactNode;
}) {
  const meta = BLOCK_META[block.kind] ?? { label: block.kind, icon: '▪' };
  return (
    <div
      draggable={editMode}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => editMode && e.preventDefault()}
      onDragEnd={onDrop}
      className={`group relative rounded-lg border bg-card transition-shadow ${
        editMode ? 'cursor-grab hover:shadow-md active:cursor-grabbing' : ''
      } ${dragging ? 'opacity-50 ring-2 ring-primary' : ''}`}
    >
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <span aria-hidden>{meta.icon}</span>
          {meta.label}
          {block.source === 'AI' && (
            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
              AI
            </span>
          )}
          {block.source === 'USER' && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">custom</span>
          )}
        </div>
        {editMode && (
          <div className="flex items-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
              drag
            </span>
            <button
              className="rounded px-1.5 py-0.5 text-xs text-destructive hover:bg-destructive/10"
              onClick={onDelete}
              title="Remove block"
            >
              Remove
            </button>
          </div>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
