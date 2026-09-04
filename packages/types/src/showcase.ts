import { z } from 'zod';
import { ProjectType } from './enums';
import type { Project } from './project';

/**
 * Showcase (Phase A) — type-aware visual storytelling for submitted work.
 *
 * Every project renders as an ordered list of visual "blocks". Block payloads
 * are validated with zod on both write (API) and read (web) paths so a bad
 * payload can never break a render.
 */

/** Kinds of visual blocks that compose a project's Showcase tab. */
export const ShowcaseBlockKind = {
  STORY: 'STORY',
  GALLERY: 'GALLERY',
  NOTEBOOK: 'NOTEBOOK',
  TERMINAL: 'TERMINAL',
  OPENAPI: 'OPENAPI',
} as const;
export type ShowcaseBlockKind = (typeof ShowcaseBlockKind)[keyof typeof ShowcaseBlockKind];

/** Who produced a block: pipeline scan, AI agent, or the user by hand. */
export const ShowcaseBlockSource = {
  AUTO: 'AUTO',
  AI: 'AI',
  USER: 'USER',
} as const;
export type ShowcaseBlockSource = (typeof ShowcaseBlockSource)[keyof typeof ShowcaseBlockSource];

/* ----------------------------- payloads ----------------------------- */

/** AI/plain-language summary: the "explain it to anyone" block. */
export const StoryBlockPayloadSchema = z.object({
  headline: z.string().max(200),
  bullets: z.array(z.string().max(400)).min(1).max(5),
  audienceNote: z.string().max(400).optional(),
});
export type StoryBlockPayload = z.infer<typeof StoryBlockPayloadSchema>;

/** Image gallery backed by files uploaded to the project. */
export const GalleryBlockPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  items: z
    .array(
      z.object({
        fileId: z.string().uuid(),
        caption: z.string().max(300).optional(),
      }),
    )
    .min(1)
    .max(24),
});
export type GalleryBlockPayload = z.infer<typeof GalleryBlockPayloadSchema>;

/** One parsed Jupyter notebook cell (pre-executed outputs only — code is never run). */
export const NotebookOutputSchema = z.object({
  kind: z.enum(['text', 'image', 'html', 'error']),
  text: z.string().max(20_000).optional(),
  mediaType: z.string().max(100).optional(),
  /** base64 payload for image outputs, size-capped by the pipeline. */
  data: z.string().max(400_000).optional(),
});
export type NotebookOutput = z.infer<typeof NotebookOutputSchema>;

export const NotebookCellSchema = z.object({
  type: z.enum(['markdown', 'code']),
  source: z.string().max(8000),
  outputs: z.array(NotebookOutputSchema).max(10).default([]),
});
export type NotebookCell = z.infer<typeof NotebookCellSchema>;

export const NotebookBlockPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  fileId: z.string().uuid(),
  kernelHint: z.string().max(100).optional(),
  truncated: z.boolean().default(false),
  cells: z.array(NotebookCellSchema).min(1).max(40),
});
export type NotebookBlockPayload = z.infer<typeof NotebookBlockPayloadSchema>;

/** Animated terminal replay of a command run / log. */
export const TerminalBlockPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  command: z.string().max(500).optional(),
  lines: z.array(z.string().max(500)).min(1).max(200),
});
export type TerminalBlockPayload = z.infer<typeof TerminalBlockPayloadSchema>;

/** Static OpenAPI/Swagger endpoint explorer (rendered read-only, no live calls). */
export const OpenApiEndpointSchema = z.object({
  method: z.string().max(10),
  path: z.string().max(300),
  summary: z.string().max(300).optional(),
  tags: z.array(z.string().max(60)).max(5).default([]),
});
export type OpenApiEndpoint = z.infer<typeof OpenApiEndpointSchema>;

export const OpenApiBlockPayloadSchema = z.object({
  title: z.string().max(200).optional(),
  version: z.string().max(60).optional(),
  description: z.string().max(1000).optional(),
  specFileId: z.string().uuid(),
  endpoints: z.array(OpenApiEndpointSchema).min(1).max(100),
});
export type OpenApiBlockPayload = z.infer<typeof OpenApiBlockPayloadSchema>;

/** Payload schema per block kind — used by API writes and web reads. */
export const BLOCK_PAYLOAD_SCHEMAS: Record<ShowcaseBlockKind, z.ZodTypeAny> = {
  STORY: StoryBlockPayloadSchema,
  GALLERY: GalleryBlockPayloadSchema,
  NOTEBOOK: NotebookBlockPayloadSchema,
  TERMINAL: TerminalBlockPayloadSchema,
  OPENAPI: OpenApiBlockPayloadSchema,
};

/** Validate a block payload against its kind. Throws zod error on mismatch. */
export function parseBlockPayload(kind: string, payload: unknown): unknown {
  const schema = BLOCK_PAYLOAD_SCHEMAS[kind as ShowcaseBlockKind];
  if (!schema) throw new Error(`Unknown showcase block kind "${kind}"`);
  return schema.parse(payload);
}

/* ------------------------------ entity ------------------------------ */

export interface ShowcaseBlock {
  id: string;
  projectId: string;
  position: number;
  kind: ShowcaseBlockKind;
  payload: Record<string, unknown>;
  source: ShowcaseBlockSource;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ShowcaseView {
  projectId: string;
  kind: ProjectType;
  blocks: ShowcaseBlock[];
}

/* --------------------------- API contracts -------------------------- */

export const ReorderShowcaseSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(50),
});
export type ReorderShowcaseInput = z.infer<typeof ReorderShowcaseSchema>;

export const SetShowcaseKindSchema = z.object({
  kind: z.nativeEnum(ProjectType),
});
export type SetShowcaseKindInput = z.infer<typeof SetShowcaseKindSchema>;

export const CreateShowcaseBlockSchema = z.object({
  kind: z.enum([
    ShowcaseBlockKind.GALLERY,
    ShowcaseBlockKind.TERMINAL,
  ]),
  payload: z.unknown(),
});
export type CreateShowcaseBlockInput = z.infer<typeof CreateShowcaseBlockSchema>;

/** Featured project entry for the Discover hybrid hero carousel. */
export interface FeaturedProject {
  project: Project;
  heroFileId?: string | null;
}
