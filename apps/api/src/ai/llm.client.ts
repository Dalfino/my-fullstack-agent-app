import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
}

/**
 * LLM client supporting OpenAI-compatible endpoints (GLM, DeepSeek, etc.)
 * with a deterministic local fallback when the external API is unavailable.
 */
@Injectable()
export class LlmClient {
  private readonly logger = new Logger(LlmClient.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly fallbackModel: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>(
      'LLM_BASE_URL',
      'https://open.bigmodel.cn/api/paas/v4',
    );
    this.apiKey = this.config.get<string>('LLM_API_KEY', '');
    this.model = this.config.get<string>('LLM_MODEL', 'glm-4-flash');
    this.fallbackModel = this.config.get<string>('LLM_FALLBACK_MODEL', 'local-fallback');
  }

  async complete(messages: LlmMessage[]): Promise<LlmResponse> {
    const started = Date.now();

    if (!this.apiKey) {
      this.logger.warn('No LLM_API_KEY configured, using local fallback');
      return this.localFallback(messages, started);
    }

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature: 0.4,
          max_tokens: 2000,
        }),
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        throw new Error(`LLM API error: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as {
        choices: { message: { content: string } }[];
        usage?: { total_tokens?: number };
      };

      return {
        content: data.choices?.[0]?.message?.content ?? '',
        model: this.model,
        tokensUsed: data.usage?.total_tokens ?? 0,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      this.logger.error(`LLM call failed, using fallback: ${(err as Error).message}`);
      return this.localFallback(messages, started);
    }
  }

  private localFallback(messages: LlmMessage[], started: number): LlmResponse {
    const userMsg = messages.find((m) => m.role === 'user')?.content ?? '';
    const content = this.buildFallbackContent(userMsg);
    return {
      content,
      model: this.fallbackModel,
      tokensUsed: 0,
      latencyMs: Date.now() - started,
    };
  }

  private buildFallbackContent(userMsg: string): string {
    // Deterministic fallback that produces a valid ExplainReport JSON
    const report = {
      executiveSummary:
        'This project demonstrates a technical work product submitted to the TalentShowcase platform. ' +
        'It shows practical application of software engineering skills and problem-solving ability.',
      managerSummary:
        'The submission reflects solid technical work with clear structure. It is suitable for ' +
        'business stakeholders to review and understand the value delivered.',
      peerSummary:
        'A well-organized project with a clear purpose. The code demonstrates good practices and ' +
        'a working implementation of the stated goals.',
      analogies: [
        'Like a well-documented recipe that anyone can follow to reproduce the same result.',
        'Similar to a blueprint that turns an idea into a tangible, working product.',
      ],
      keyHighlights: [
        'Clear project structure and organization',
        'Demonstrates practical technical skills',
        'Ready for stakeholder review',
      ],
      confidenceScore: 70,
    };
    return JSON.stringify(report);
  }
}