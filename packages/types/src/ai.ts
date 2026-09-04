import { z } from 'zod';
import { AgentType } from './enums';

export interface AiReport {
  id: string;
  projectId: string;
  agentType: AgentType;
  reportJson: Record<string, unknown>;
  confidenceScore?: number | null;
  sourceRefs?: Record<string, unknown> | null;
  modelVersion?: string | null;
  createdAt: string | Date;
}

export interface AiInteraction {
  id: string;
  projectId: string;
  agentType: AgentType;
  promptHash?: string | null;
  responseHash?: string | null;
  tokensUsed?: number | null;
  latencyMs?: number | null;
  modelVersion?: string | null;
  auditTrail?: Record<string, unknown> | null;
  createdAt: string | Date;
}

export interface ExplainReport {
  executiveSummary: string;
  managerSummary: string;
  peerSummary: string;
  analogies: string[];
  keyHighlights: string[];
  confidenceScore: number;
}

export const ExplainReportSchema = z.object({
  executiveSummary: z.string(),
  managerSummary: z.string(),
  peerSummary: z.string(),
  analogies: z.array(z.string()),
  keyHighlights: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
});

export type ExplainReportInput = z.infer<typeof ExplainReportSchema>;

/* ------------------------------------------------------------------ */
/* Code Analyst agent (Phase 2)                                        */
/* ------------------------------------------------------------------ */

export interface CodeAnalystReport {
  executiveSummary: string;
  architectureOverview: string;
  fileBreakdown: Array<{
    path: string;
    language: string;
    lineCount: number;
    complexity: 'low' | 'medium' | 'high';
    notes: string;
  }>;
  repoStats: {
    totalFiles: number;
    totalLines: number;
    languages: Record<string, number>;
    largestFiles: Array<{ path: string; lineCount: number }>;
    avgComplexity: number;
  };
  strengths: string[];
  improvementAreas: string[];
  confidenceScore: number;
}

export const CodeAnalystReportSchema = z.object({
  executiveSummary: z.string(),
  architectureOverview: z.string(),
  fileBreakdown: z.array(
    z.object({
      path: z.string(),
      language: z.string(),
      lineCount: z.number(),
      complexity: z.enum(['low', 'medium', 'high']),
      notes: z.string(),
    }),
  ),
  repoStats: z.object({
    totalFiles: z.number(),
    totalLines: z.number(),
    languages: z.record(z.number()),
    largestFiles: z.array(z.object({ path: z.string(), lineCount: z.number() })),
    avgComplexity: z.number(),
  }),
  strengths: z.array(z.string()),
  improvementAreas: z.array(z.string()),
  confidenceScore: z.number().min(0).max(100),
});

/* ------------------------------------------------------------------ */
/* Security Scanner agent (Phase 2)                                    */
/* ------------------------------------------------------------------ */

export const SeveritySchema = z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFO']);
export type Severity = z.infer<typeof SeveritySchema>;

export interface SecurityFinding {
  id: string;
  severity: Severity;
  category: string; // e.g. hardcoded-secret, sql-injection, xss
  filePath: string;
  lineNumber: number | null;
  snippet: string;
  description: string;
  remediation: string;
}

export interface SecurityScanReport {
  executiveSummary: string;
  riskRating: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'CLEAN';
  totalFindings: number;
  findings: SecurityFinding[];
  scannedFiles: number;
  scannedLines: number;
  confidenceScore: number;
}

export const SecurityScanReportSchema = z.object({
  executiveSummary: z.string(),
  riskRating: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'CLEAN']),
  totalFindings: z.number(),
  findings: z.array(
    z.object({
      id: z.string(),
      severity: SeveritySchema,
      category: z.string(),
      filePath: z.string(),
      lineNumber: z.number().nullable(),
      snippet: z.string(),
      description: z.string(),
      remediation: z.string(),
    }),
  ),
  scannedFiles: z.number(),
  scannedLines: z.number(),
  confidenceScore: z.number().min(0).max(100),
});

/* ------------------------------------------------------------------ */
/* Evaluation agent (Phase 2/3)                                        */
/* ------------------------------------------------------------------ */

export const EvaluationCriterionSchema = z.enum([
  'innovation',
  'technicalDepth',
  'quality',
  'documentation',
  'businessValue',
]);

export interface EvaluationReport {
  executiveSummary: string;
  scores: {
    innovation: number;
    technicalDepth: number;
    quality: number;
    documentation: number;
    businessValue: number;
    overall: number;
  };
  criterionRationale: Record<string, string>;
  detectedSkills: Array<{ skill: string; category: string; score: number; evidence: string }>;
  recommendation: 'PROMOTE' | 'DEVELOP' | 'REJECT';
  recommendationRationale: string;
  confidenceScore: number;
}

export const EvaluationReportSchema = z.object({
  executiveSummary: z.string(),
  scores: z.object({
    innovation: z.number().min(0).max(100),
    technicalDepth: z.number().min(0).max(100),
    quality: z.number().min(0).max(100),
    documentation: z.number().min(0).max(100),
    businessValue: z.number().min(0).max(100),
    overall: z.number().min(0).max(100),
  }),
  criterionRationale: z.record(z.string()),
  detectedSkills: z.array(
    z.object({
      skill: z.string(),
      category: z.string(),
      score: z.number().min(0).max(100),
      evidence: z.string(),
    }),
  ),
  recommendation: z.enum(['PROMOTE', 'DEVELOP', 'REJECT']),
  recommendationRationale: z.string(),
  confidenceScore: z.number().min(0).max(100),
});

/* ------------------------------------------------------------------ */
/* Career Advisor agent (Phase 3)                                      */
/* ------------------------------------------------------------------ */

export interface CareerAdvisorReport {
  executiveSummary: string;
  skillRadarSummary: Array<{ category: string; score: number; level: string }>;
  strengths: Array<{ area: string; detail: string }>;
  gaps: Array<{ area: string; detail: string; priority: 'high' | 'medium' | 'low' }>;
  learningRoadmap: Array<{
    step: number;
    title: string;
    description: string;
    suggestedResources: string[];
    estimatedWeeks: number;
  }>;
  careerPaths: Array<{ title: string; fitScore: number; rationale: string }>;
  confidenceScore: number;
}

export const CareerAdvisorReportSchema = z.object({
  executiveSummary: z.string(),
  skillRadarSummary: z.array(z.object({ category: z.string(), score: z.number(), level: z.string() })),
  strengths: z.array(z.object({ area: z.string(), detail: z.string() })),
  gaps: z.array(
    z.object({
      area: z.string(),
      detail: z.string(),
      priority: z.enum(['high', 'medium', 'low']),
    }),
  ),
  learningRoadmap: z.array(
    z.object({
      step: z.number(),
      title: z.string(),
      description: z.string(),
      suggestedResources: z.array(z.string()),
      estimatedWeeks: z.number(),
    }),
  ),
  careerPaths: z.array(z.object({ title: z.string(), fitScore: z.number(), rationale: z.string() })),
  confidenceScore: z.number().min(0).max(100),
});