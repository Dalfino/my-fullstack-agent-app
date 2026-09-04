import Link from 'next/link';
import { Project } from '@talentshowcase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthedImage } from '@/components/showcase/authed-image';
import { TYPE_GRADIENTS, TYPE_LABELS } from '@/components/hero-carousel';

const typeColors: Record<string, string> = {
  FULLSTACK: 'bg-blue-500/10 text-blue-600',
  DATA_ANALYSIS: 'bg-emerald-500/10 text-emerald-600',
  ML_MODEL: 'bg-purple-500/10 text-purple-600',
  API: 'bg-amber-500/10 text-amber-600',
  SCRIPT: 'bg-slate-500/10 text-slate-600',
  DESIGN: 'bg-pink-500/10 text-pink-600',
};

/**
 * Discover grid card. `heroFileId` (optional) turns the card into a visual
 * tile that leads with a screenshot/chart; without it we render a
 * kind-branded gradient band so the grid still reads like a gallery.
 */
export function ProjectCard({
  project,
  heroFileId,
}: {
  project: Project;
  heroFileId?: string | null;
}) {
  const score = project.aiScore ?? null;

  return (
    <Link href={`/projects/${project.id}`} className="block h-full">
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-shadow hover:shadow-md">
        {/* hero visual */}
        <div className="relative h-32 w-full shrink-0">
          {heroFileId ? (
            <AuthedImage
              projectId={project.id}
              fileId={heroFileId}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${
                TYPE_GRADIENTS[project.type] ?? 'from-slate-700 to-slate-600'
              }`}
            >
              <span className="text-xs font-semibold uppercase tracking-widest text-white/90">
                {TYPE_LABELS[project.type] ?? project.type}
              </span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Badge className={`${typeColors[project.type] ?? ''} backdrop-blur`}>
              {project.type}
            </Badge>
          </div>
          {score !== null && (
            <span className="absolute right-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-xs font-semibold text-white backdrop-blur">
              {Number(score)}/100
            </span>
          )}
        </div>

        <CardHeader className="flex-1">
          <CardTitle className="line-clamp-1 text-base leading-snug">{project.title}</CardTitle>
          <p className="line-clamp-2 text-sm text-muted-foreground">{project.description}</p>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-1.5">
            {(project.techStack ?? []).slice(0, 4).map((tech) => (
              <Badge key={tech} variant="secondary" className="text-xs">
                {tech}
              </Badge>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>{project.owner?.name ?? 'Unknown'}</span>
            <span>{new Date(project.createdAt).toLocaleDateString()}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
