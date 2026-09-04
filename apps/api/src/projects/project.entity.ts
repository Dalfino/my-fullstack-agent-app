import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ProjectStatus, ProjectType, ProjectVisibility } from '@talentshowcase/types';
import { User } from '../users/user.entity';

@Entity('project')
export class Project {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'text' })
  type: ProjectType;

  @Column({ name: 'owner_id', type: 'uuid' })
  ownerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'owner_id' })
  owner: User;

  @Column({ type: 'text', default: ProjectStatus.DRAFT })
  status: ProjectStatus;

  @Column({ type: 'text', default: ProjectVisibility.PRIVATE })
  visibility: ProjectVisibility;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  tags: string[];

  @Column({ name: 'tech_stack', type: 'jsonb', default: () => "'[]'" })
  techStack: string[];

  @Column({ name: 'repository_url', nullable: true })
  repositoryUrl?: string;

  @Column({ name: 'demo_url', nullable: true })
  demoUrl?: string;

  @Column({ name: 'preview_sandbox_id', type: 'uuid', nullable: true })
  previewSandboxId?: string;

  @Column({ name: 'ai_summary', type: 'text', nullable: true })
  aiSummary?: string;

  @Column({ name: 'ai_score', type: 'numeric', nullable: true })
  aiScore?: number;

  @Column({ name: 'ai_report_json', type: 'jsonb', nullable: true })
  aiReportJson?: Record<string, unknown>;

  /** Visual showcase profile (auto-detected, user-overridable). */
  @Column({ name: 'showcase_kind', type: 'text', nullable: true })
  showcaseKind?: ProjectType | null;

  @Column({ default: 1 })
  version: number;

  @Column({ name: 'parent_project_id', type: 'uuid', nullable: true })
  parentProjectId?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}