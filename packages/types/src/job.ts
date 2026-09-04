import { z } from 'zod';
import { JobStatus, JobType } from './enums';

/** A queued unit of async work (AI pipelines, virus scans). */
export interface QueueJob {
  id: string;
  type: JobType;
  status: JobStatus;
  payload: Record<string, unknown>;
  result?: Record<string, unknown> | null;
  error?: string | null;
  attempts: number;
  projectId?: string | null;
  requestedById?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  startedAt?: string | Date | null;
  finishedAt?: string | Date | null;
}

export const EnqueueJobSchema = z.object({
  type: z.nativeEnum(JobType),
  projectId: z.string().uuid().optional(),
  payload: z.record(z.unknown()).default({}),
});

export type EnqueueJobInput = z.infer<typeof EnqueueJobSchema>;
