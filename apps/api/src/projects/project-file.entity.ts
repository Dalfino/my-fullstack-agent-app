import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Project } from './project.entity';

@Entity('project_file')
export class ProjectFile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column()
  path: string;

  @Column({ type: 'bigint', nullable: true })
  size?: number;

  @Column({ name: 'mime_type', nullable: true })
  mimeType?: string;

  @Column({ name: 's3_key' })
  s3Key: string;

  @Column({ name: 'is_entry_point', default: false })
  isEntryPoint: boolean;

  @Column({ name: 'line_count', nullable: true })
  lineCount?: number;

  @Column({ nullable: true })
  language?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}