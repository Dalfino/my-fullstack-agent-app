import { z } from 'zod';
import { ProjectStatus, ProjectType, ProjectVisibility } from './enums';

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  type: ProjectType;
  ownerId: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  tags: string[];
  techStack: string[];
  repositoryUrl?: string | null;
  demoUrl?: string | null;
  previewSandboxId?: string | null;
  aiSummary?: string | null;
  aiScore?: number | null;
  aiReportJson?: Record<string, unknown> | null;
  /** Visual showcase profile — may differ from `type` when overridden by the owner. */
  showcaseKind?: ProjectType | null;
  version: number;
  parentProjectId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  owner?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  type: z.nativeEnum(ProjectType),
  visibility: z.nativeEnum(ProjectVisibility).default(ProjectVisibility.PRIVATE),
  tags: z.array(z.string().max(50)).max(20).default([]),
  techStack: z.array(z.string().max(50)).max(20).default([]),
  repositoryUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
  parentProjectId: z.string().uuid().optional(),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.extend({
  aiSummary: z.string().max(5000).optional(),
  aiScore: z.number().min(0).max(100).optional(),
  aiReportJson: z.record(z.unknown()).optional(),
  showcaseKind: z.nativeEnum(ProjectType).optional(),
}).partial();

export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

export const SubmitProjectSchema = z.object({
  entryPoint: z.string().max(500).optional(),
});

export type SubmitProjectInput = z.infer<typeof SubmitProjectSchema>;

export interface ProjectFile {
  id: string;
  projectId: string;
  path: string;
  size?: number | null;
  mimeType?: string | null;
  s3Key: string;
  isEntryPoint: boolean;
  lineCount?: number | null;
  language?: string | null;
  createdAt: string;
}

export const ProjectQuerySchema = z.object({
  type: z.nativeEnum(ProjectType).optional(),
  status: z.nativeEnum(ProjectStatus).optional(),
  visibility: z.nativeEnum(ProjectVisibility).optional(),
  search: z.string().max(200).optional(),
  ownerId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(['createdAt', 'aiScore', 'title']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ProjectQuery = z.infer<typeof ProjectQuerySchema>;

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}