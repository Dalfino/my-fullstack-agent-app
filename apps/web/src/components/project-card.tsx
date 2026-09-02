import Link from 'next/link';
import { Project } from '@talentshowcase/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const typeColors: Record<string, string> = {
  FULLSTACK: 'bg-blue-500/10 text-blue-600',
  DATA_ANALYSIS: 'bg-emerald-500/10 text-emerald-600',
  ML_MODEL: 'bg-purple-500/10 text-purple-600',
  API: 'bg-amber-500/10 text-amber-600',
  SCRIPT: 'bg-slate-500/10 text-slate-600',
  DESIGN: 'bg-pink-500/10 text-pink-600',
};

export function ProjectCard({ project }: { project: Project }) {
  const score = project.aiScore ?? null;

  return (
    <Link href={`/projects/${project.id}`} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between gap-2">
            <Badge className={typeColors[project.type] ?? ''}>{project.type}</Badge>
            {score !== null && (
              <span className="text-sm font-semibold text-primary">{score}/100</span>
            )}
          </div>
          <CardTitle className="text-lg leading-snug">{project.title}</CardTitle>
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        </CardHeader>
        <CardContent>
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