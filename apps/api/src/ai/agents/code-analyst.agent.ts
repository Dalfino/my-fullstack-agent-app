import { Injectable, Logger } from '@nestjs/common';
import { CodeAnalystReport, CodeAnalystReportSchema } from '@talentshowcase/types';
import { LlmClient } from '../llm.client';

export interface AnalyzedFile {
  path: string;
  language: string;
  content: string;
  lineCount: number;
}

/**
 * AGENT: CODE ANALYST (Phase 2)
 * Deterministic repo statistics (files, languages, complexity heuristics)
 * enriched with an LLM architecture narrative. Degrades gracefully to a
 * fully deterministic report when the LLM is unavailable.
 */
@Injectable()
export class CodeAnalystAgent {
  private readonly logger = new Logger(CodeAnalystAgent.name);
  private static readonly MAX_FILES = 40;

  constructor(private readonly llm: LlmClient) {}

  async analyze(files: AnalyzedFile[]): Promise<CodeAnalystReport> {
    const stats = this.computeStats(files);
    const narrative = await this.narrative(files, stats);

    const report: CodeAnalystReport = {
      executiveSummary: narrative.executiveSummary,
      architectureOverview: narrative.architectureOverview,
      fileBreakdown: files.slice(0, 30).map((f) => ({
        path: f.path,
        language: f.language,
        lineCount: f.lineCount,
        complexity: this.fileComplexity(f.content),
        notes: this.fileNotes(f),
      })),
      repoStats: stats,
      strengths: narrative.strengths,
      improvementAreas: narrative.improvementAreas,
      confidenceScore: narrative.deterministic ? 75 : 88,
    };

    // Validate shape; on LLM-related drift fall back to deterministic copy
    try {
      return CodeAnalystReportSchema.parse(report);
    } catch {
      this.logger.warn('Code analyst report failed schema validation, using deterministic report');
      return CodeAnalystReportSchema.parse({
        ...report,
        executiveSummary: this.deterministicSummary(files, stats),
        architectureOverview: this.deterministicArchitecture(files, stats),
      });
    }
  }

  /* ---------------------- deterministic core ---------------------- */

  private computeStats(files: AnalyzedFile[]): CodeAnalystReport['repoStats'] {
    const languages: Record<string, number> = {};
    let totalLines = 0;
    for (const f of files.slice(0, CodeAnalystAgent.MAX_FILES)) {
      languages[f.language] = (languages[f.language] ?? 0) + f.lineCount;
      totalLines += f.lineCount;
    }
    const largestFiles = [...files]
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 5)
      .map((f) => ({ path: f.path, lineCount: f.lineCount }));

    const complexityScores = files.map((f) => this.complexityScore(f.content));
    const avgComplexity = complexityScores.length
      ? Math.round((complexityScores.reduce((a, b) => a + b, 0) / complexityScores.length) * 10) / 10
      : 0;

    return {
      totalFiles: files.length,
      totalLines,
      languages,
      largestFiles,
      avgComplexity,
    };
  }

  /** Heuristic 0-10 complexity score from indentation depth, branches, file size. */
  private complexityScore(content: string): number {
    const lines = content.split('\n');
    const branchMatches = content.match(/\b(if|else|for|while|switch|case|catch)\b/g);
    const branchDensity = (branchMatches?.length ?? 0) / Math.max(lines.length, 1);
    const maxIndent = Math.max(
      0,
      ...lines
        .slice(0, 500)
        .map((l) => Math.floor((l.match(/^[\t ]*/)?.[0].replace(/\t/g, '  ').length ?? 0) / 2)),
    );
    const score = branchDensity * 30 + maxIndent * 0.8 + (lines.length > 300 ? 1.5 : 0);
    return Math.round(Math.min(score, 10) * 10) / 10;
  }

  private fileComplexity(content: string): 'low' | 'medium' | 'high' {
    const s = this.complexityScore(content);
    if (s < 3) return 'low';
    if (s < 6) return 'medium';
    return 'high';
  }

  private fileNotes(f: AnalyzedFile): string {
    const hasTests = /test|spec/i.test(f.path);
    const hasDocs = /readme|doc/i.test(f.path);
    const hasTypes = /\b(interface|type\s+\w+\s*=)\b/.test(f.content);
    const notes: string[] = [];
    if (hasTests) notes.push('test coverage file');
    if (hasDocs) notes.push('documentation');
    if (hasTypes) notes.push('typed contracts');
    const exported = (f.content.match(/export\s+/g) ?? []).length;
    if (exported > 5) notes.push(`${exported} exports`);
    return notes.length ? notes.join(', ') : 'implementation module';
  }

  /* ------------------------- LLM narrative ------------------------- */

  private async narrative(
    files: AnalyzedFile[],
    stats: CodeAnalystReport['repoStats'],
  ): Promise<{
    executiveSummary: string;
    architectureOverview: string;
    strengths: string[];
    improvementAreas: string[];
    deterministic: boolean;
  }> {
    const topFiles = [...files]
      .sort((a, b) => b.lineCount - a.lineCount)
      .slice(0, 12)
      .map((f) => `${f.path} (${f.language}, ${f.lineCount} lines)`);

    const prompt = [
      'Analyze this codebase structure and produce an architecture review.',
      '',
      `Total files: ${stats.totalFiles}`,
      `Total lines: ${stats.totalLines}`,
      `Languages: ${JSON.stringify(stats.languages)}`,
      `Average complexity (0-10): ${stats.avgComplexity}`,
      `Largest files: ${stats.largestFiles.map((f) => `${f.path} (${f.lineCount})`).join(', ') || 'N/A'}`,
      `Key files: ${topFiles.join(', ')}`,
      '',
      'Return JSON with exactly these fields:',
      '- executiveSummary: 2-3 sentences on what this codebase does and its engineering quality',
      '- architectureOverview: 3-5 sentences describing the likely architecture, layering and patterns',
      '- strengths: array of 3-4 engineering strengths (specific, evidence-based)',
      '- improvementAreas: array of 3-4 concrete improvement opportunities',
    ].join('\n');

    const response = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are the Code Analyst Agent for an enterprise talent showcase platform. ' +
          'You review codebases and produce evidence-based engineering assessments. ' +
          'Respond ONLY with valid JSON matching the requested schema. Never invent files not listed.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.executiveSummary || !parsed.architectureOverview) throw new Error('missing fields');
      return {
        executiveSummary: String(parsed.executiveSummary),
        architectureOverview: String(parsed.architectureOverview),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 6) : [],
        improvementAreas: Array.isArray(parsed.improvementAreas)
          ? parsed.improvementAreas.map(String).slice(0, 6)
          : [],
        deterministic: response.model === 'local-fallback',
      };
    } catch {
      return {
        executiveSummary: this.deterministicSummary(files, stats),
        architectureOverview: this.deterministicArchitecture(files, stats),
        strengths: this.deterministicStrengths(stats),
        improvementAreas: this.deterministicImprovements(files, stats),
        deterministic: true,
      };
    }
  }

  private deterministicSummary(files: AnalyzedFile[], stats: CodeAnalystReport['repoStats']): string {
    const langs = Object.keys(stats.languages)
      .sort((a, b) => stats.languages[b] - stats.languages[a])
      .slice(0, 3)
      .join(', ');
    return (
      `This repository contains ${stats.totalFiles} files and roughly ${stats.totalLines} lines of code, ` +
      `predominantly ${langs || 'mixed languages'}. ` +
      `The average complexity score of ${stats.avgComplexity}/10 indicates ${
        stats.avgComplexity < 4
          ? 'generally simple, readable modules'
          : 'moderately involved logic that benefits from the existing structure'
      }.`
    );
  }

  private deterministicArchitecture(files: AnalyzedFile[], stats: CodeAnalystReport['repoStats']): string {
    const hasRoutes = files.some((f) => /controller|route|router/i.test(f.path));
    const hasServices = files.some((f) => /service|usecase/i.test(f.path));
    const hasModels = files.some((f) => /model|entity|schema/i.test(f.path));
    const hasConfig = files.some((f) => /config|settings/i.test(f.path));
    const layers = [
      hasRoutes && 'request handling (controllers/routes)',
      hasServices && 'business logic (services)',
      hasModels && 'data models',
      hasConfig && 'configuration',
    ].filter(Boolean) as string[];

    return (
      `The codebase appears organized into ${layers.length || 'a small number of'} logical layers: ` +
      (layers.join(', ') || 'a single-layer utility structure') +
      `. File sizes are ${
        stats.largestFiles[0]?.lineCount && stats.largestFiles[0].lineCount < 400
          ? 'well-bounded, suggesting separation of concerns'
          : 'uneven, with some larger files that may concentrate responsibilities'
      }.`
    );
  }

  private deterministicStrengths(stats: CodeAnalystReport['repoStats']): string[] {
    const strengths: string[] = [];
    if (stats.avgComplexity < 5) strengths.push('Low average complexity keeps modules maintainable');
    if (Object.keys(stats.languages).length > 1)
      strengths.push('Polyglot codebase with clear language boundaries');
    if (stats.totalFiles > 5) strengths.push('Code is split across multiple focused files rather than monoliths');
    strengths.push('Consistent use of the detected language conventions');
    return strengths;
  }

  private deterministicImprovements(files: AnalyzedFile[], stats: CodeAnalystReport['repoStats']): string[] {
    const improvements: string[] = [];
    const hasTests = files.some((f) => /test|spec/i.test(f.path));
    if (!hasTests)
      improvements.push('No test files detected — adding unit tests would raise confidence in correctness');
    if (stats.largestFiles[0]?.lineCount > 300) {
      improvements.push(`Largest file has ${stats.largestFiles[0].lineCount} lines — consider splitting responsibilities`);
    }
    if (stats.avgComplexity >= 6) improvements.push('High average complexity — refactor deeply nested branches');
    improvements.push('Documenting module boundaries in a README improves onboarding');
    return improvements;
  }
}
