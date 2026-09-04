import { z } from 'zod';

/** Inline comment anchored to a specific line range of a project file. */
export interface Comment {
  id: string;
  fileId: string;
  projectId: string;
  authorId: string;
  parentCommentId?: string | null;
  body: string;
  lineNumber: number | null;
  endLineNumber: number | null;
  resolved: boolean;
  resolvedById?: string | null;
  resolvedAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  author?: {
    id: string;
    name: string;
    role: string;
  } | null;
}

export const CreateCommentSchema = z.object({
  fileId: z.string().uuid(),
  body: z.string().min(1).max(2000),
  lineNumber: z.number().int().min(1).optional(),
  endLineNumber: z.number().int().min(1).optional(),
  parentCommentId: z.string().uuid().optional(),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  body: z.string().min(1).max(2000).optional(),
  resolved: z.boolean().optional(),
});

export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;

export interface CommentThread {
  root: Comment;
  replies: Comment[];
}
