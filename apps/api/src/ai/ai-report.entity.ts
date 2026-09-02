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

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

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