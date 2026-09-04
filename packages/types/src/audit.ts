import { z } from 'zod';
import { AuditAction } from './enums';

/** Immutable audit trail entry written for every sensitive action. */
export interface AuditLog {
  id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  action: AuditAction;
  entityType?: string | null;
  entityId?: string | null;
  context: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: string | Date;
}

export interface AuditLogQuery {
  actorId?: string;
  action?: AuditAction;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  page: number;
  pageSize: number;
}

export const AuditLogQuerySchema = z.object({
  actorId: z.string().uuid().optional(),
  action: z.nativeEnum(AuditAction).optional(),
  entityType: z.string().max(100).optional(),
  entityId: z.string().max(100).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AuditLogQueryInput = z.infer<typeof AuditLogQuerySchema>;
