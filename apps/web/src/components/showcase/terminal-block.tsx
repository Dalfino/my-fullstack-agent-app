'use client';

import { useEffect, useRef, useState } from 'react';
import { TerminalBlockPayload } from '@talentshowcase/types';

/**
 * Animated terminal replay: types out captured CLI output line by line.
 * Respects prefers-reduced-motion (renders instantly instead).
 */
export function TerminalBlock({ payload }: { payload: TerminalBlockPayload }) {
  const [shown, setShown] = useState(0);
  const [playing, setPlaying] = useState(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setShown(payload.lines.length);
      setPlaying(false);
      return;
    }
    if (!playing) return;
    // Batch lines so the whole replay never takes more than ~8 seconds.
    const perLineMs = Math.max(20, Math.min(120, 8000 / Math.max(payload.lines.length, 1)));
    timer.current = setInterval(() => {
      setShown((s) => {
        if (s >= payload.lines.length) {
          if (timer.current) clearInterval(timer.current);
          setPlaying(false);
          return s;
        }
        return s + 1;
      });
    }, perLineMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, payload.lines.length]);

  useEffect(() => {
    boxRef.current?.scrollTo({ top: boxRef.current.scrollHeight });
  }, [shown]);

  const done = shown >= payload.lines.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {payload.title && (
          <p className="font-mono text-xs text-muted-foreground">{payload.title}</p>
        )}
        {done && (
          <button
            className="rounded border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            onClick={() => {
              setShown(0);
              setPlaying(true);
            }}
          >
            ↻ Replay
          </button>
        )}
      </div>
      {payload.command && (
        <div className="flex items-start gap-2 rounded bg-slate-900 px-3 py-2 font-mono text-xs text-emerald-300">
          <span className="select-none text-emerald-500">$</span>
          <span className="break-all">{payload.command}</span>
        </div>
      )}
      <div
        ref={boxRef}
        className="max-h-80 overflow-auto rounded bg-slate-900 p-3 font-mono text-xs leading-relaxed text-slate-200"
      >
        {payload.lines.slice(0, shown).map((line, i) => (
          <div key={i} className="whitespace-pre-wrap break-all">
            {line || '\u00A0'}
          </div>
        ))}
        {!done && <span className="inline-block h-3 w-2 animate-pulse bg-emerald-400" />}
      </div>
    </div>
  );
}
