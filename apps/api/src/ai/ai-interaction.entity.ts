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

@Entity('ai_interaction')
export class AiInteraction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'agent_type', type: 'text' })
  agentType: AgentType;

  @Column({ name: 'prompt_hash', nullable: true })
  promptHash?: string;

  @Column({ name: 'response_hash', nullable: true })
  responseHash?: string;

  @Column({ name: 'tokens_used', nullable: true })
  tokensUsed?: number;

  @Column({ name: 'latency_ms', nullable: true })
  latencyMs?: number;

  @Column({ name: 'model_version', nullable: true })
  modelVersion?: string;

  @Column({ name: 'audit_trail', type: 'jsonb', nullable: true })
  auditTrail?: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}