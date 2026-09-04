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
import { ShowcaseBlockKind, ShowcaseBlockSource } from '@talentshowcase/types';
import { Project } from '../projects/project.entity';

/**
 * One visual block in a project's Showcase tab. Payload shape depends on
 * `kind` and is validated with the zod schemas in @talentshowcase/types.
 */
@Entity('showcase_block')
@Index(['projectId', 'position'])
export class ShowcaseBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ type: 'int', default: 0 })
  position: number;

  @Column({ type: 'text' })
  kind: ShowcaseBlockKind;

  @Column({ type: 'jsonb' })
  payload: Record<string, unknown>;

  @Column({ type: 'text', default: ShowcaseBlockSource.AUTO })
  source: ShowcaseBlockSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
