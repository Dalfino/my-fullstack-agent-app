'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Project, Paginated } from '@talentshowcase/types';
import { useAuth } from '@/lib/auth-context';
import { apiClient } from '@/lib/api';
import { Navbar } from '@/components/navbar';
import { ProjectCard } from '@/components/project-card';
import { HeroCarousel } from '@/components/hero-carousel';
import { Button } from '@/components/ui/button';

export default function DiscoverPage() {
  const { token, loading } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [heroes, setHeroes] = useState<Record<string, string | null>>({});
  const [search, setSearch] = useState('');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !token) {
      router.push('/login');
    }
  }, [loading, token, router]);

  useEffect(() => {
    if (!token) return;
    setFetching(true);
    const params = new URLSearchParams({ page: String(page), pageSize: '24' });
    if (search) params.set('search', search);
    if (type) params.set('type', type);
    apiClient
      .get<Paginated<Project>>(`/projects?${params.toString()}`, token)
      .then(async (res) => {
        setProjects(res.items);
        setTotalPages(res.totalPages);
        const ids = res.items.map((p) => p.id).join(',');
        if (ids) {
          const map = await apiClient
            .get<Record<string, string | null>>(`/showcase/hero-images?ids=${ids}`, token)
            .catch(() => ({}));
          setHeroes(map ?? {});
        } else {
          setHeroes({});
        }
      })
      .catch(() => setProjects([]))
      .finally(() => setFetching(false));
  }, [token, search, type, page]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center">Loading...</div>;
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Discover Talent</h1>
            <p className="text-muted-foreground">
              Every project told visually — screenshots, notebooks, API explorers and terminal replays
            </p>
          </div>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search projects..."
              className="w-64 rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">All types</option>
              <option value="FULLSTACK">Fullstack</option>
              <option value="DATA_ANALYSIS">Data Analysis</option>
              <option value="ML_MODEL">ML Model</option>
              <option value="API">API</option>
              <option value="SCRIPT">Script</option>
              <option value="DESIGN">Design</option>
            </select>
          </div>
        </div>

        {/* Featured hero carousel */}
        {!search && !type && (
          <div className="mb-8">
            <HeroCarousel />
          </div>
        )}

        {fetching ? (
          <div className="py-20 text-center text-muted-foreground">Loading projects...</div>
        ) : projects.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            No projects found. Be the first to submit one!
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                heroFileId={heroes[project.id] ?? null}
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="mt-8 flex items-center justify-center gap-4">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}