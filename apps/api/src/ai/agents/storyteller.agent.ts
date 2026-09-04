import { Injectable, Logger } from '@nestjs/common';
import { StoryBlockPayload, StoryBlockPayloadSchema } from '@talentshowcase/types';
import { LlmClient } from '../llm.client';

export interface StorytellerContext {
  title: string;
  type: string;
  description?: string;
  techStack: string[];
  fileNames: string[];
  /** Short summary of what visual blocks were generated, e.g. "2 galleries, 1 notebook". */
  blockSummary: string;
}

/**
 * AGENT 6: STORYTELLER (Showcase narrator)
 * Writes the plain-language story block that opens every project's Showcase:
 * one headline + three bullets a non-technical teammate can understand.
 * Falls back to deterministic copywriting per project kind when no LLM key
 * is configured, so the showcase pipeline always yields a story.
 */
@Injectable()
export class StorytellerAgent {
  private readonly logger = new Logger(StorytellerAgent.name);

  constructor(private readonly llm: LlmClient) {}

  async generate(context: StorytellerContext): Promise<StoryBlockPayload> {
    const prompt = this.buildPrompt(context);
    try {
      const response = await this.llm.complete([
        {
          role: 'system',
          content:
            'You are the Storyteller Agent for an enterprise talent showcase platform. ' +
            'You write short, vivid, plain-language stories about technical projects so ' +
            'that ANY teammate (HR, sales, design, executives) understands what the work ' +
            'does and why it matters. No jargon, no acronyms without explanation. ' +
            'Always respond with valid JSON matching the required schema. ' +
            'Never invent facts or metrics not present in the input.',
        },
        { role: 'user', content: prompt },
      ]);
      return this.parse(response.content);
    } catch (err) {
      this.logger.warn(`LLM storytelling failed, using fallback: ${(err as Error).message}`);
      return this.fallback(context);
    }
  }

  private buildPrompt(context: StorytellerContext): string {
    return [
      'Write the story block for this project showcase.',
      '',
      `Title: ${context.title}`,
      `Type: ${context.type}`,
      `Description: ${context.description ?? 'N/A'}`,
      `Tech stack: ${context.techStack.join(', ') || 'N/A'}`,
      `Files: ${context.fileNames.slice(0, 20).join(', ') || 'N/A'}`,
      `Visual blocks generated: ${context.blockSummary || 'none'}`,
      '',
      'Return JSON with exactly these fields:',
      '- headline: one punchy sentence (max 12 words) saying what this IS, e.g. "A dashboard that turns customer rants into product decisions"',
      '- bullets: exactly 3 strings, each ONE sentence a non-technical teammate understands: (1) what it does, (2) how it was built, (3) what value it delivers',
      '- audienceNote: one short sentence telling viewers what to look at first in the showcase below',
    ].join('\n');
  }

  private parse(content: string): StoryBlockPayload {
    try {
      const cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
      return StoryBlockPayloadSchema.parse(JSON.parse(cleaned));
    } catch (err) {
      this.logger.warn(`Failed to parse storyteller output: ${(err as Error).message}`);
      // Re-throw to caller so it can decide to use the deterministic fallback.
      throw new Error('storyteller parse failed');
    }
  }

  /** Deterministic copy per project kind — good enough to always look presentable. */
  private fallback(context: StorytellerContext): StoryBlockPayload {
    const whatByKind: Record<string, string> = {
      FULLSTACK: 'a working web application, from interface to database',
      DATA_ANALYSIS: 'a data pipeline that turns raw records into answers',
      ML_MODEL: 'a machine-learning model trained to make predictions',
      API: 'a documented API that other software can build on',
      SCRIPT: 'an automation script that removes repetitive work',
      DESIGN: 'a set of polished design deliverables',
    };
    const what = whatByKind[context.type] ?? 'a technical work product';
    const stack = context.techStack.slice(0, 3).join(', ');
    const fileCount = context.fileNames.length;
    return StoryBlockPayloadSchema.parse({
      headline: `${context.title}: ${what.replace(/^a /, '')}`.slice(0, 200),
      bullets: [
        `This project is ${what}${context.description ? ' — ' + context.description.split(/[.!?]/)[0].toLowerCase().slice(0, 160) : ''}.`,
        stack
          ? `Built with ${stack}${fileCount ? `, organised across ${fileCount} file${fileCount === 1 ? '' : 's'}` : ''}.`
          : fileCount
            ? `Organised across ${fileCount} file${fileCount === 1 ? '' : 's'} with a clear structure.`
            : 'Structured as a self-contained submission.',
        'Submitted to the showcase for peer review and cross-team visibility.',
      ],
      audienceNote:
        context.blockSummary
          ? `Scroll on — the showcase includes ${context.blockSummary}.`
          : 'Scroll on to explore the project files and AI reports.',
    });
  }
}
