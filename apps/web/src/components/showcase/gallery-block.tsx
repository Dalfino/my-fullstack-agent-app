'use client';

import { useState } from 'react';
import { GalleryBlockPayload } from '@talentshowcase/types';
import { AuthedImage } from './authed-image';

/** Image gallery backed by project files (fetched through JWT-authed raw endpoint). */
export function GalleryBlock({
  projectId,
  payload,
}: {
  projectId: string;
  payload: GalleryBlockPayload;
}) {
  const [active, setActive] = useState(0);
  const item = payload.items[active];

  return (
    <div className="space-y-3">
      {payload.title && (
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {payload.title}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border bg-muted/30">
        <AuthedImage
          projectId={projectId}
          fileId={item.fileId}
          alt={item.caption ?? 'project image'}
          className="max-h-[420px] w-full object-contain bg-white"
        />
      </div>
      {item.caption && <p className="text-center text-xs text-muted-foreground">{item.caption}</p>}
      {payload.items.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2">
          {payload.items.map((it, i) => (
            <button
              key={it.fileId}
              onClick={() => setActive(i)}
              className={`h-14 w-20 overflow-hidden rounded border transition-all ${
                i === active ? 'border-primary ring-2 ring-primary/40' : 'opacity-70 hover:opacity-100'
              }`}
              title={it.caption}
            >
              <AuthedImage
                projectId={projectId}
                fileId={it.fileId}
                alt={it.caption ?? ''}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
