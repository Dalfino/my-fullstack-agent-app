import { z } from 'zod';
import { ReviewRecommendation, ReviewStatus, ReviewType } from './enums';

export interface ReviewScores {
  innovation: number;
  technicalDepth: number;
  quality: number;
  documentation: number;
  businessValue: number;
}

export interface Review {
  id: string;
  projectId: string;
  reviewerId?: string | null;
  reviewType: ReviewType;
  scoresJson: ReviewScores;
  comments: string[];
  overallFeedback?: string | null;
  recommendation: ReviewRecommendation;
  status: ReviewStatus;
  actedBy?: string | null;
  actedAt?: string | Date | null;
  createdAt: string | Date;
}

export const ReviewScoresSchema = z.object({
  innovation: z.number().min(0).max(100),
  technicalDepth: z.number().min(0).max(100),
  quality: z.number().min(0).max(100),
  documentation: z.number().min(0).max(100),
  businessValue: z.number().min(0).max(100),
});

export const CreateReviewSchema = z.object({
  projectId: z.string().uuid(),
  reviewType: z.nativeEnum(ReviewType).default(ReviewType.PEER),
  scoresJson: ReviewScoresSchema,
  comments: z.array(z.string().max(2000)).max(100).default([]),
  overallFeedback: z.string().max(5000).optional(),
  recommendation: z.nativeEnum(ReviewRecommendation),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

export const ReviewDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  note: z.string().max(2000).optional(),
});

export type ReviewDecisionInput = z.infer<typeof ReviewDecisionSchema>;