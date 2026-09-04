'use client';

import { useMemo, useState } from 'react';
import { NotebookBlockPayload, NotebookOutput } from '@talentshowcase/types';

/**
 * Read-only Jupyter notebook renderer. Shows markdown + code cells and the
 * SAVED outputs of the notebook (text, tables, images) — code is never
 * executed by the platform.
 */

/** Minimal, dependency-free markdown renderer (headings, lists, emphasis, code). */
function renderMarkdown(src: string): string {
  const esc = src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/^### (.*)$/gm, '<h4 class="mt-3 font-semibold text-sm">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 class="mt-3 font-semibold">$1</h3>')
    .replace(/^# (.*)$/gm, '<h2 class="mt-2 text-lg font-bold">$1</h2>')
    .replace(/```([\s\S]*?)```/g, '<pre class="my-2 overflow-x-auto rounded bg-muted p-2 text-xs"><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code class="rounded bg-muted px-1 py-0.5 text-xs">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^\s*[-*] (.*)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .split(/\n{2,}/)
    .map((p) => (p.trim().startsWith('<') ? p : `<p class="my-1 text-sm leading-relaxed">${p.replace(/\n/g, '<br/>')}</p>`))
    .join('');
}

function OutputView({ output }: { output: NotebookOutput }) {
  if (output.kind === 'image' && output.data) {
    return (
      <div className="flex justify-center rounded bg-white p-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:${output.mediaType ?? 'image/png'};base64,${output.data}`}
          alt="notebook output"
          className="max-w-full"
        />
      </div>
    );
  }
  if (output.kind === 'html' && output.text) {
    // Sandboxed iframe: scripts are NOT allowed (sandbox attr omits allow-scripts)
    return (
      <iframe
        title="notebook html output"
        sandbox=""
        srcDoc={`<style>body{font-family:ui-sans-serif,system-ui;font-size:12px;margin:6px;}table{border-collapse:collapse}td,th{border:1px solid #ddd;padding:3px 8px}</style>${output.text}`}
        className="h-64 w-full overflow-hidden rounded border bg-white"
      />
    );
  }
  if (output.kind === 'error') {
    return (
      <pre className="overflow-x-auto rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
        {output.text}
      </pre>
    );
  }
  return (
    <pre className="overflow-x-auto rounded bg-muted p-2 text-xs leading-relaxed">
      {output.text}
    </pre>
  );
}

export function NotebookBlock({ payload }: { payload: NotebookBlockPayload }) {
  const [showAll, setShowAll] = useState(false);
  const visible = useMemo(
    () => (showAll ? payload.cells : payload.cells.slice(0, 8)),
    [payload.cells, showAll],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        {payload.title && (
          <p className="font-mono text-xs text-muted-foreground">{payload.title}</p>
        )}
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          {payload.kernelHint && <span>{payload.kernelHint}</span>}
          <span>saved outputs · code not executed here</span>
        </div>
      </div>
      <div className="space-y-3">
        {visible.map((cell, i) => (
          <div key={i} className="space-y-2">
            {cell.type === 'markdown' ? (
              <div
                className="px-1"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(cell.source) }}
              />
            ) : (
              <pre className="overflow-x-auto rounded border-l-4 border-primary/50 bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
                <code>{cell.source}</code>
              </pre>
            )}
            {cell.outputs.map((o, j) => (
              <OutputView key={j} output={o} />
            ))}
          </div>
        ))}
      </div>
      {payload.cells.length > 8 && (
        <button
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setShowAll((v) => !v)}
        >
          {showAll ? 'Show less' : `Show all ${payload.cells.length} cells`}
        </button>
      )}
      {payload.truncated && (
        <p className="text-xs text-amber-600">Some outputs were too large and were truncated.</p>
      )}
    </div>
  );
}
