import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { AgentType } from '@talentshowcase/types';
import { Project } from '../projects/project.entity';

@Entity('ai_report')
export class AiReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Null for user-scoped reports (career advisor). */
  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId?: string | null;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  /** Owning user when the report is user-scoped (career advisor). */
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId?: string | null;

  @Column({ name: 'agent_type', type: 'text' })
  agentType: AgentType;

  @Column({ name: 'report_json', type: 'jsonb' })
  reportJson: Record<string, unknown>;

  @Column({ name: 'confidence_score', type: 'numeric', nullable: true })
  confidenceScore?: number;

  @Column({ name: 'source_refs', type: 'jsonb', nullable: true })
  sourceRefs?: Record<string, unknown>;

  @Column({ name: 'model_version', nullable: true })
  modelVersion?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}