import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { JobStatus, JobType } from '@talentshowcase/types';

@Entity('queue_job')
@Index('idx_queue_job_status', ['status'])
@Index('idx_queue_job_project', ['projectId'])
@Index('idx_queue_job_created_at', ['createdAt'])
export class QueueJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 64 })
  type: JobType;

  @Column({ type: 'varchar', length: 32, default: JobStatus.QUEUED })
  status: JobStatus;

  @Column({ type: 'jsonb', default: {} })
  payload: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  result?: Record<string, any> | null;

  @Column({ type: 'text', nullable: true })
  error?: string | null;

  @Column({ default: 0 })
  attempts: number;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string | null;

  @Column({ name: 'requested_by_id', type: 'uuid', nullable: true })
  requestedById?: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt?: Date | null;
}
