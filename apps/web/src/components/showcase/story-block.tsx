'use client';

import { StoryBlockPayload } from '@talentshowcase/types';

/** The AI/plain-language story that opens every showcase. */
export function StoryBlock({ payload }: { payload: StoryBlockPayload }) {
  return (
    <div className="space-y-4">
      <h3 className="text-xl font-semibold leading-snug">{payload.headline}</h3>
      <ul className="space-y-2">
        {payload.bullets.map((b, i) => (
          <li key={i} className="flex gap-3 text-sm text-muted-foreground">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
              {i + 1}
            </span>
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
      {payload.audienceNote && (
        <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
          {payload.audienceNote}
        </p>
      )}
    </div>
  );
}
