import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SkillCategory } from '@talentshowcase/types';

@Entity('skill_assessment')
@Index('idx_skill_user', ['userId'])
@Index('idx_skill_user_skill', ['userId', 'skill'], { unique: true })
export class SkillAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column()
  skill: string;

  @Column({ type: 'varchar', length: 32 })
  category: SkillCategory;

  /** 0-100 competency score, averaged across contributing evaluations. */
  @Column({ type: 'real' })
  score: number;

  @Column({ name: 'evidence_count', default: 1 })
  evidenceCount: number;

  @Column({ name: 'last_evaluated_at', type: 'timestamptz', default: () => 'NOW()' })
  lastEvaluatedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
