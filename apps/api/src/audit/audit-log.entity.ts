import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuditAction } from '@talentshowcase/types';

@Entity('audit_log')
@Index('idx_audit_action', ['action'])
@Index('idx_audit_created_at', ['createdAt'])
@Index('idx_audit_actor', ['actorId'])
@Index('idx_audit_entity', ['entityType', 'entityId'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'actor_id', type: 'uuid', nullable: true })
  actorId?: string;

  @Column({ name: 'actor_email', nullable: true })
  actorEmail?: string;

  @Column({ type: 'varchar', length: 64 })
  action: AuditAction;

  @Column({ name: 'entity_type', nullable: true })
  entityType?: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId?: string;

  @Column({ type: 'jsonb', default: {} })
  context: Record<string, unknown>;

  @Column({ name: 'ip_address', nullable: true })
  ipAddress?: string;

  @Column({ name: 'user_agent', nullable: true })
  userAgent?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
