import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLogQueryInput, Paginated } from '@talentshowcase/types';
import { AuditLog } from './audit-log.entity';

export interface AuditEntry {
  actorId?: string;
  actorEmail?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  context?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Append-only audit trail. Every sensitive action across the platform flows
 * through here. Logging never breaks the primary business flow: failures are
 * swallowed and reported to the logger.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  async log(entry: AuditEntry): Promise<void> {
    try {
      await this.repo.save(
        this.repo.create({
          actorId: entry.actorId,
          actorEmail: entry.actorEmail,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          context: entry.context ?? {},
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        }),
      );
    } catch (err) {
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async query(filter: AuditLogQueryInput): Promise<Paginated<AuditLog>> {
    const qb = this.repo.createQueryBuilder('log');

    if (filter.actorId) qb.andWhere('log.actorId = :actorId', { actorId: filter.actorId });
    if (filter.action) qb.andWhere('log.action = :action', { action: filter.action });
    if (filter.entityType) qb.andWhere('log.entityType = :entityType', { entityType: filter.entityType });
    if (filter.entityId) qb.andWhere('log.entityId = :entityId', { entityId: filter.entityId });
    if (filter.from) qb.andWhere('log.createdAt >= :from', { from: filter.from });
    if (filter.to) qb.andWhere('log.createdAt <= :to', { to: filter.to });

    const total = await qb.getCount();
    const items = await qb
      .orderBy('log.createdAt', 'DESC')
      .skip((filter.page - 1) * filter.pageSize)
      .take(filter.pageSize)
      .getMany();

    return {
      items,
      total,
      page: filter.page,
      pageSize: filter.pageSize,
      totalPages: Math.ceil(total / filter.pageSize),
    };
  }

  /** Aggregated counts by action over the last N days (admin dashboard). */
  async stats(days = 30): Promise<Array<{ action: string; count: number }>> {
    const since = new Date(Date.now() - days * 24 * 3600 * 1000);
    return this.repo
      .createQueryBuilder('log')
      .select('log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('log.createdAt >= :since', { since })
      .groupBy('log.action')
      .orderBy('count', 'DESC')
      .getRawMany();
  }
}
