import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Project } from '../projects/project.entity';
import { ProjectFile } from '../projects/project-file.entity';
import { User } from '../users/user.entity';

@Entity('comment')
@Index('idx_comment_file', ['fileId'])
@Index('idx_comment_project', ['projectId'])
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'file_id', type: 'uuid' })
  fileId: string;

  @ManyToOne(() => ProjectFile)
  @JoinColumn({ name: 'file_id' })
  file: ProjectFile;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'author_id', type: 'uuid' })
  authorId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'author_id' })
  author: User;

  @Column({ name: 'parent_comment_id', type: 'uuid', nullable: true })
  parentCommentId?: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'line_number', type: 'int', nullable: true })
  lineNumber?: number | null;

  @Column({ name: 'end_line_number', type: 'int', nullable: true })
  endLineNumber?: number | null;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolved_by_id', type: 'uuid', nullable: true })
  resolvedById?: string | null;

  @Column({ name: 'resolved_at', type: 'timestamptz', nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
