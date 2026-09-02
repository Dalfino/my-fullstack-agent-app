import { z } from 'zod';

export const ApiErrorSchema = z.object({
  statusCode: z.number(),
  message: z.union([z.string(), z.array(z.string())]),
  error: z.string().optional(),
  timestamp: z.string(),
  path: z.string().optional(),
});

export type ApiError = z.infer<typeof ApiErrorSchema>;

export const HealthSchema = z.object({
  status: z.enum(['ok', 'degraded', 'down']),
  services: z.record(z.string(), z.enum(['up', 'down'])),
  timestamp: z.string(),
});

export type Health = z.infer<typeof HealthSchema>;