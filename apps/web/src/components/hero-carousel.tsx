'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FeaturedProject, ProjectType } from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { AuthedImage } from './showcase/authed-image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TYPE_GRADIENTS: Record<ProjectType, string> = {
  FULLSTACK: 'from-blue-600 to-indigo-500',
  DATA_ANALYSIS: 'from-emerald-600 to-teal-500',
  ML_MODEL: 'from-purple-600 to-fuchsia-500',
  API: 'from-amber-500 to-orange-500',
  SCRIPT: 'from-slate-600 to-slate-500',
  DESIGN: 'from-pink-500 to-rose-500',
};

const TYPE_LABELS: Record<ProjectType, string> = {
  FULLSTACK: 'Fullstack app',
  DATA_ANALYSIS: 'Data analysis',
  ML_MODEL: 'ML model',
  API: 'API',
  SCRIPT: 'Script',
  DESIGN: 'Design',
};

/**
 * Discover hybrid hero: auto-rotating featured carousel (3 highlighted
 * projects) rendered above the compact grid. Each slide leads with the
 * project's hero visual so non-technical viewers see the work first.
 */
export function HeroCarousel() {
  const { token } = useAuth();
  const [items, setItems] = useState<FeaturedProject[]>([]);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiClient
      .get<FeaturedProject[]>(`/showcase/featured?limit=3`, token)
      .then((res) => setItems(res ?? []))
      .catch(() => setItems([]));
  }, [token]);

  useEffect(() => {
    if (items.length <= 1 || paused) return;
    const t = setInterval(() => setActive((a) => (a + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length, paused]);

  if (items.length === 0) return null;
  const slide = items[active];
  const project = slide.project;

  return (
    <section
      className="relative overflow-hidden rounded-xl border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${TYPE_GRADIENTS[project.type] ?? 'from-slate-700 to-slate-600'} opacity-90`} />
      {slide.heroFileId ? (
        <div className="absolute inset-0">
          <AuthedImage
            projectId={project.id}
            fileId={slide.heroFileId}
            alt=""
            className="h-full w-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-black/10" />
      )}

      <div className="relative flex min-h-[280px] flex-col justify-end gap-3 p-6 md:min-h-[320px] md:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
            ✦ Featured
          </span>
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
            {TYPE_LABELS[project.type] ?? project.type}
          </span>
          {project.aiScore != null && (
            <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white backdrop-blur">
              Score {Number(project.aiScore)}/100
            </span>
          )}
        </div>
        <h2 className="max-w-2xl text-2xl font-bold text-white md:text-3xl">{project.title}</h2>
        <p className="line-clamp-2 max-w-2xl text-sm text-white/80">{project.description}</p>
        <div className="mt-1 flex items-center gap-3">
          <Link href={`/projects/${project.id}`}>
            <Button size="sm" className="bg-white text-slate-900 hover:bg-white/90">
              View showcase
            </Button>
          </Link>
          <span className="text-xs text-white/70">{project.owner?.name}</span>
        </div>

        {items.length > 1 && (
          <div className="absolute bottom-4 right-6 flex gap-1.5">
            {items.map((it, i) => (
              <button
                key={it.project.id}
                aria-label={`Slide ${i + 1}`}
                className={`h-2 rounded-full transition-all ${
                  i === active ? 'w-6 bg-white' : 'w-2 bg-white/50 hover:bg-white/80'
                }`}
                onClick={() => setActive(i)}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

export { TYPE_GRADIENTS, TYPE_LABELS };
