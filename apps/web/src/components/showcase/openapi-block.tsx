'use client';

import { useMemo, useState } from 'react';
import { OpenApiBlockPayload } from '@talentshowcase/types';

const METHOD_STYLES: Record<string, string> = {
  GET: 'bg-emerald-100 text-emerald-800',
  POST: 'bg-blue-100 text-blue-800',
  PUT: 'bg-amber-100 text-amber-800',
  PATCH: 'bg-violet-100 text-violet-800',
  DELETE: 'bg-red-100 text-red-800',
  HEAD: 'bg-slate-100 text-slate-700',
  OPTIONS: 'bg-slate-100 text-slate-700',
};

/**
 * Static, read-only OpenAPI/Swagger explorer: every endpoint as a card with
 * method badge, path and summary. Non-technical viewers instantly see the
 * surface of an API without touching Swagger UI.
 */
export function OpenApiBlock({ payload }: { payload: OpenApiBlockPayload }) {
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? payload.endpoints.filter(
          (e) =>
            e.path.toLowerCase().includes(q) ||
            (e.summary ?? '').toLowerCase().includes(q) ||
            e.method.toLowerCase().includes(q),
        )
      : payload.endpoints;
    return expanded ? list : list.slice(0, 8);
  }, [payload.endpoints, query, expanded]);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const e of payload.endpoints) c[e.method] = (c[e.method] ?? 0) + 1;
    return c;
  }, [payload.endpoints]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          {payload.title && <p className="text-sm font-semibold">{payload.title}</p>}
          <p className="text-xs text-muted-foreground">
            {payload.endpoints.length} endpoints
            {payload.version ? ` · v${payload.version}` : ''} · read-only explorer
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {Object.entries(counts).map(([m, n]) => (
            <span
              key={m}
              className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${METHOD_STYLES[m] ?? 'bg-muted'}`}
            >
              {m} {n}
            </span>
          ))}
        </div>
      </div>

      {payload.description && (
        <p className="text-sm text-muted-foreground">{payload.description}</p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter endpoints…"
        className="w-full rounded border border-input bg-background px-3 py-1.5 text-sm"
      />

      <div className="divide-y rounded border">
        {filtered.map((e, i) => (
          <div key={i} className="flex items-start gap-3 px-3 py-2">
            <span
              className={`mt-0.5 w-14 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold ${
                METHOD_STYLES[e.method] ?? 'bg-muted'
              }`}
            >
              {e.method}
            </span>
            <div className="min-w-0">
              <p className="break-all font-mono text-xs">{e.path}</p>
              {e.summary && (
                <p className="mt-0.5 text-xs text-muted-foreground">{e.summary}</p>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matching endpoints.</p>
        )}
      </div>

      {payload.endpoints.length > 8 && !query && (
        <button
          className="text-xs font-medium text-primary hover:underline"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Show less' : `Show all ${payload.endpoints.length} endpoints`}
        </button>
      )}
    </div>
  );
}
