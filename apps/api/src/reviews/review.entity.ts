import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import {
  ReviewRecommendation,
  ReviewStatus,
  ReviewType,
  ReviewScores,
} from '@talentshowcase/types';
import { Project } from '../projects/project.entity';
import { User } from '../users/user.entity';

@Entity('review')
export class Review {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId: string;

  @ManyToOne(() => Project)
  @JoinColumn({ name: 'project_id' })
  project: Project;

  @Column({ name: 'reviewer_id', type: 'uuid', nullable: true })
  reviewerId?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'reviewer_id' })
  reviewer?: User;

  @Column({ name: 'review_type', type: 'text' })
  reviewType: ReviewType;

  @Column({ name: 'scores_json', type: 'jsonb' })
  scoresJson: ReviewScores;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  comments: string[];

  @Column({ name: 'overall_feedback', type: 'text', nullable: true })
  overallFeedback?: string;

  @Column({ type: 'text' })
  recommendation: ReviewRecommendation;

  @Column({ type: 'text', default: ReviewStatus.PENDING_APPROVAL })
  status: ReviewStatus;

  @Column({ name: 'acted_by', type: 'uuid', nullable: true })
  actedBy?: string;

  @Column({ name: 'acted_at', type: 'timestamptz', nullable: true })
  actedAt?: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}