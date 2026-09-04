import { Injectable, Logger } from '@nestjs/common';
import { ExplainReport, ExplainReportSchema } from '@talentshowcase/types';
import { LlmClient } from '../llm.client';

export interface ExplainContext {
  title: string;
  description?: string;
  type: string;
  techStack: string[];
  tags: string[];
  fileSummary: string;
}

/**
 * AGENT 3: EXPLAIN AGENT (Non-Tech Translator)
 * Converts technical implementation into business-friendly narrative
 * with multi-tier explanations (Executive / Manager / Peer levels).
 */
@Injectable()
export class ExplainAgent {
  private readonly logger = new Logger(ExplainAgent.name);

  constructor(private readonly llm: LlmClient) {}

  async generate(context: ExplainContext): Promise<ExplainReport> {
    const prompt = this.buildPrompt(context);
    const response = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are the Explain Agent for an enterprise talent showcase platform. ' +
          'You translate technical work into clear, business-friendly language for ' +
          'non-technical stakeholders (HR, department heads, executives). ' +
          'Always respond with valid JSON matching the required schema. ' +
          'Never invent facts not present in the input. Be concise and professional.',
      },
      { role: 'user', content: prompt },
    ]);

    const report = this.parseReport(response.content);
    this.logger.log(
      `Generated explain report for "${context.title}" (${response.model}, ${response.latencyMs}ms)`,
    );
    return report;
  }

  private buildPrompt(context: ExplainContext): string {
    return [
      'Generate a multi-tier explanation report for the following technical project.',
      '',
      `Title: ${context.title}`,
      `Type: ${context.type}`,
      `Description: ${context.description ?? 'N/A'}`,
      `Tech Stack: ${context.techStack.join(', ') || 'N/A'}`,
      `Tags: ${context.tags.join(', ') || 'N/A'}`,
      `Files: ${context.fileSummary}`,
      '',
      'Return JSON with exactly these fields:',
      '- executiveSummary: 2-3 sentences for executives (business value, impact)',
      '- managerSummary: 2-3 sentences for managers (scope, effort, outcomes)',
      '- peerSummary: 2-3 sentences for technical peers (approach, quality)',
      '- analogies: array of 2-3 analogies explaining the technical concept simply',
      '- keyHighlights: array of 3-5 notable strengths',
      '- confidenceScore: number 0-100 representing your confidence in this analysis',
    ].join('\n');
  }

  private parseReport(content: string): ExplainReport {
    try {
      const cleaned = content
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();
      const parsed = JSON.parse(cleaned);
      return ExplainReportSchema.parse(parsed);
    } catch (err) {
      this.logger.warn(`Failed to parse LLM explain output, using fallback: ${(err as Error).message}`);
      return {
        executiveSummary:
          'This project demonstrates a technical work product submitted to the TalentShowcase platform.',
        managerSummary:
          'The submission reflects solid technical work with clear structure and business value.',
        peerSummary:
          'A well-organized project with a clear purpose and working implementation.',
        analogies: [
          'Like a well-documented recipe that anyone can follow to reproduce the same result.',
        ],
        keyHighlights: ['Clear project structure', 'Demonstrates practical technical skills'],
        confidenceScore: 60,
      };
    }
  }
}