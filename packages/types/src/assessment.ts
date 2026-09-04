import { z } from 'zod';
import { SkillCategory } from './enums';

/**
 * Per-skill competency score (0-100) derived from AI evaluations and human
 * reviews. Powers the skill radar and career advisor gap analysis.
 */
export interface SkillAssessment {
  id: string;
  userId: string;
  skill: string; // free-form, e.g. "React", aligned to SkillCategory where possible
  category: SkillCategory;
  score: number; // 0-100
  evidenceCount: number; // how many evaluations contributed
  lastEvaluatedAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export const SkillAssessmentSchema = z.object({
  skill: z.string().min(1).max(100),
  category: z.nativeEnum(SkillCategory),
  score: z.number().min(0).max(100),
});

export type SkillAssessmentInput = z.infer<typeof SkillAssessmentSchema>;

/** Radar chart payload: one axis per category, averaged from skill scores. */
export interface SkillRadar {
  userId: string;
  userName?: string;
  axes: Array<{
    category: SkillCategory;
    score: number;
    skills: Array<{ skill: string; score: number }>;
  }>;
  overallScore: number;
  strengths: string[];
  gaps: string[];
  generatedAt: string;
}

export interface RadarComparison {
  userA: { userId: string; userName?: string; radar: SkillRadar };
  userB: { userId: string; userName?: string; radar: SkillRadar };
  delta: Array<{ category: SkillCategory; a: number; b: number; diff: number }>;
}
