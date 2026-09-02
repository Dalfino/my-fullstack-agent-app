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