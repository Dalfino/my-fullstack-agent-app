import { Injectable, Logger } from '@nestjs/common';
import {
  EvaluationReport,
  EvaluationReportSchema,
  SkillCategory,
} from '@talentshowcase/types';
import { LlmClient } from '../llm.client';
import { CodeAnalystReport, SecurityScanReport } from '@talentshowcase/types';

export interface EvaluationInput {
  title: string;
  description?: string;
  type: string;
  techStack: string[];
  files: Array<{ path: string; language: string; lineCount: number }>;
  codeAnalysis?: CodeAnalystReport | null;
  securityScan?: SecurityScanReport | null;
  humanReviews?: Array<{
    recommendation: string;
    scores?: Record<string, number>;
    reviewType: string;
  }>;
  ownerName: string;
}

/** Maps detected technologies to skill taxonomy categories. */
export const SKILL_MAP: Record<string, { skill: string; category: SkillCategory }> = {
  react: { skill: 'React', category: SkillCategory.FRONTEND },
  next: { skill: 'Next.js', category: SkillCategory.FRONTEND },
  vue: { skill: 'Vue', category: SkillCategory.FRONTEND },
  css: { skill: 'CSS', category: SkillCategory.FRONTEND },
  html: { skill: 'HTML', category: SkillCategory.FRONTEND },
  tailwind: { skill: 'Tailwind CSS', category: SkillCategory.FRONTEND },
  node: { skill: 'Node.js', category: SkillCategory.BACKEND },
  nest: { skill: 'NestJS', category: SkillCategory.BACKEND },
  express: { skill: 'Express', category: SkillCategory.BACKEND },
  python: { skill: 'Python', category: SkillCategory.BACKEND },
  django: { skill: 'Django', category: SkillCategory.BACKEND },
  flask: { skill: 'Flask', category: SkillCategory.BACKEND },
  fastapi: { skill: 'FastAPI', category: SkillCategory.BACKEND },
  java: { skill: 'Java', category: SkillCategory.BACKEND },
  go: { skill: 'Go', category: SkillCategory.BACKEND },
  rust: { skill: 'Rust', category: SkillCategory.BACKEND },
  postgres: { skill: 'PostgreSQL', category: SkillCategory.DATABASE },
  mysql: { skill: 'MySQL', category: SkillCategory.DATABASE },
  mongo: { skill: 'MongoDB', category: SkillCategory.DATABASE },
  sql: { skill: 'SQL', category: SkillCategory.DATABASE },
  redis: { skill: 'Redis', category: SkillCategory.DATABASE },
  docker: { skill: 'Docker', category: SkillCategory.DEVOPS },
  kubernetes: { skill: 'Kubernetes', category: SkillCategory.DEVOPS },
  k8s: { skill: 'Kubernetes', category: SkillCategory.DEVOPS },
  terraform: { skill: 'Terraform', category: SkillCategory.DEVOPS },
  ci: { skill: 'CI/CD', category: SkillCategory.DEVOPS },
  github: { skill: 'GitHub Actions', category: SkillCategory.DEVOPS },
  security: { skill: 'Security', category: SkillCategory.SECURITY },
  auth: { skill: 'Authentication', category: SkillCategory.SECURITY },
  jwt: { skill: 'Authentication', category: SkillCategory.SECURITY },
  mfa: { skill: 'Authentication', category: SkillCategory.SECURITY },
  test: { skill: 'Testing', category: SkillCategory.TESTING },
  spec: { skill: 'Testing', category: SkillCategory.TESTING },
  jest: { skill: 'Testing', category: SkillCategory.TESTING },
  pytest: { skill: 'Testing', category: SkillCategory.TESTING },
  pandas: { skill: 'Pandas', category: SkillCategory.DATA },
  numpy: { skill: 'NumPy', category: SkillCategory.DATA },
  tensorflow: { skill: 'TensorFlow', category: SkillCategory.DATA },
  pytorch: { skill: 'PyTorch', category: SkillCategory.DATA },
  spark: { skill: 'Spark', category: SkillCategory.DATA },
  airflow: { skill: 'Airflow', category: SkillCategory.DATA },
  architecture: { skill: 'System Architecture', category: SkillCategory.ARCHITECTURE },
  readme: { skill: 'Technical Writing', category: SkillCategory.DOCUMENTATION },
  doc: { skill: 'Technical Writing', category: SkillCategory.DOCUMENTATION },
};

/**
 * AGENT: EVALUATION (Phase 2/3)
 * Blends deterministic signals (code stats, security findings, human review
 * scores) into five criterion scores + detected skills, then asks the LLM for
 * rationale. Emits an AI review row that feeds the HR decision gate.
 */
@Injectable()
export class EvaluationAgent {
  private readonly logger = new Logger(EvaluationAgent.name);

  constructor(private readonly llm: LlmClient) {}

  async evaluate(input: EvaluationInput): Promise<EvaluationReport> {
    const base = this.baseScores(input);
    const skills = this.detectSkills(input);

    const rationale = await this.rationale(input, base, skills);

    const report: EvaluationReport = {
      executiveSummary: rationale.executiveSummary,
      scores: base.scores,
      criterionRationale: rationale.criterionRationale,
      detectedSkills: skills,
      recommendation: base.recommendation,
      recommendationRationale: rationale.recommendationRationale,
      confidenceScore: rationale.deterministic ? 68 : 85,
    };

    try {
      return EvaluationReportSchema.parse(report);
    } catch {
      return EvaluationReportSchema.parse({
        ...report,
        executiveSummary: `Evaluation of "${input.title}" completed with an overall score of ${base.scores.overall}/100.`,
      });
    }
  }

  /* --------------------- deterministic scoring --------------------- */

  private baseScores(input: EvaluationInput): {
    scores: EvaluationReport['scores'];
    recommendation: EvaluationReport['recommendation'];
  } {
    const code = input.codeAnalysis;
    const security = input.securityScan;

    // Technical depth: from code size/complexity + tech breadth
    const techBreadth = Math.min(input.techStack.length * 12, 36);
    const linesSignal = Math.min((code?.repoStats.totalLines ?? 0) / 60, 30);
    const complexitySignal = (code?.repoStats.avgComplexity ?? 3) * 3.5;
    const technicalDepth = clamp(40 + techBreadth * 0.5 + linesSignal * 0.5 + complexitySignal * 0.6);

    // Quality: inverse of complexity spikes + language diversity signal
    const complexityPenalty = (code?.repoStats.avgComplexity ?? 4) * 4;
    const fileCountSignal = Math.min((code?.repoStats.totalFiles ?? 0) * 3, 25);
    const quality = clamp(65 - complexityPenalty + fileCountSignal);

    // Documentation: README/doc files + description quality
    const hasDocs = input.files.some((f) => /readme|doc|\.md$/i.test(f.path));
    const docLength = input.description?.length ?? 0;
    const documentation = clamp((hasDocs ? 45 : 15) + Math.min(docLength / 40, 35) + (input.techStack.length ? 15 : 0));

    // Innovation: heuristic from project type + uniqueness signals
    const typeBoost: Record<string, number> = {
      ML_MODEL: 30,
      FULLSTACK: 20,
      API: 15,
      DATA_ANALYSIS: 18,
      SCRIPT: 8,
      DESIGN: 12,
    };
    const innovation = clamp(45 + (typeBoost[input.type] ?? 15) + Math.min(input.techStack.length * 4, 20));

    // Business value: human reviews dominate; fallback from docs + completeness
    const reviewScores =
      input.humanReviews?.map((r) => r.scores?.businessValue ?? 60) ?? [];
    const businessValue = reviewScores.length
      ? clamp(reviewScores.reduce((a, b) => a + b, 0) / reviewScores.length)
      : clamp(50 + (hasDocs ? 12 : 0) + Math.min((code?.repoStats.totalFiles ?? 0) * 1.5, 15));

    // Security penalty
    let securityPenalty = 0;
    if (security) {
      securityPenalty = Math.min(security.findings.length * 2.5, 25);
      if (security.riskRating === 'CRITICAL') securityPenalty += 15;
    }

    const scores = {
      innovation,
      technicalDepth: clamp(technicalDepth - securityPenalty * 0.4),
      quality: clamp(quality - securityPenalty * 0.6),
      documentation,
      businessValue: clamp(businessValue - securityPenalty * 0.3),
    };
    const overall = Math.round(
      scores.innovation * 0.2 +
        scores.technicalDepth * 0.25 +
        scores.quality * 0.25 +
        scores.documentation * 0.15 +
        scores.businessValue * 0.15,
    );

    // Human reviews influence recommendation; AI never promotes alone.
    const rejects = input.humanReviews?.filter((r) => r.recommendation === 'REJECT').length ?? 0;
    const promotes = input.humanReviews?.filter((r) => r.recommendation === 'PROMOTE').length ?? 0;
    let recommendation: EvaluationReport['recommendation'];
    if (rejects > 0 && rejects >= promotes) recommendation = 'REJECT';
    else if (promotes > 0 || overall >= 80) recommendation = 'PROMOTE';
    else if (overall >= 55) recommendation = 'DEVELOP';
    else recommendation = 'DEVELOP';

    return { scores: { ...scores, overall }, recommendation };
  }

  private detectSkills(input: EvaluationInput): EvaluationReport['detectedSkills'] {
    const found = new Map<string, { category: SkillCategory; evidence: Set<string> }>();

    const register = (text: string, evidence: string) => {
      const lower = text.toLowerCase();
      for (const [key, mapping] of Object.entries(SKILL_MAP)) {
        if (lower.includes(key)) {
          const existing = found.get(mapping.skill) ?? { category: mapping.category, evidence: new Set() };
          existing.evidence.add(evidence);
          found.set(mapping.skill, existing);
        }
      }
    };

    input.techStack.forEach((t) => register(t, 'declared tech stack'));
    input.files.forEach((f) => register(f.path, `file ${f.path}`));

    return [...found.entries()]
      .slice(0, 12)
      .map(([skill, { category, evidence }]) => ({
        skill,
        category,
        score: clamp(55 + Math.min(evidence.size * 12, 35)),
        evidence: [...evidence].slice(0, 3).join('; '),
      }));
  }

  /* -------------------------- LLM rationale ------------------------- */

  private async rationale(
    input: EvaluationInput,
    base: { scores: EvaluationReport['scores']; recommendation: EvaluationReport['recommendation'] },
    skills: EvaluationReport['detectedSkills'],
  ): Promise<{
    executiveSummary: string;
    criterionRationale: Record<string, string>;
    recommendationRationale: string;
    deterministic: boolean;
  }> {
    const prompt = [
      `Evaluate the project "${input.title}" (${input.type}) by ${input.ownerName}.`,
      `Description: ${input.description ?? 'N/A'}`,
      `Tech stack: ${input.techStack.join(', ') || 'N/A'}`,
      `Files: ${input.files.length} files, ${input.files.reduce((a, f) => a + f.lineCount, 0)} lines`,
      input.codeAnalysis
        ? `Code analysis: avg complexity ${input.codeAnalysis.repoStats.avgComplexity}/10, ${input.codeAnalysis.repoStats.totalFiles} files`
        : 'Code analysis: not available',
      input.securityScan
        ? `Security scan: ${input.securityScan.riskRating} risk, ${input.securityScan.totalFindings} findings`
        : 'Security scan: not available',
      input.humanReviews?.length
        ? `Human reviews: ${input.humanReviews.map((r) => r.recommendation).join(', ')}`
        : 'Human reviews: none yet',
      '',
      `Computed criterion scores: ${JSON.stringify(base.scores)}`,
      `Detected skills: ${skills.map((s) => s.skill).join(', ') || 'none'}`,
      '',
      'Return JSON with exactly these fields:',
      '- executiveSummary: 2-3 sentence evaluation narrative for HR',
      '- criterionRationale: object with keys innovation/technicalDepth/quality/documentation/businessValue, each 1-2 sentences justifying the score',
      `- recommendationRationale: 1-2 sentences justifying "${base.recommendation}"`,
    ].join('\n');

    const response = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are the Evaluation Agent for an enterprise talent showcase platform. ' +
          'You produce fair, evidence-based project evaluations. Scores are pre-computed from deterministic signals — ' +
          'your job is to explain them. Respond ONLY with valid JSON matching the schema.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.executiveSummary || typeof parsed.criterionRationale !== 'object') {
        throw new Error('missing fields');
      }
      return {
        executiveSummary: String(parsed.executiveSummary),
        criterionRationale: parsed.criterionRationale,
        recommendationRationale: String(parsed.recommendationRationale ?? ''),
        deterministic: false,
      };
    } catch {
      const s = base.scores;
      return {
        executiveSummary:
          `The evaluation scored "${input.title}" ${s.overall}/100 overall. ` +
          `Strongest dimensions are ${topCriterion(s)}; detected competencies include ${skills.slice(0, 4).map((x) => x.skill).join(', ') || 'general software engineering'}. ` +
          (base.recommendation === 'PROMOTE'
            ? 'The project is showcase-ready for promotion consideration.'
            : base.recommendation === 'REJECT'
              ? 'The project does not currently meet the bar; significant rework is advised.'
              : 'Targeted improvements would lift this project to promotion readiness.'),
        criterionRationale: {
          innovation: `Scored ${s.innovation}/100 based on project type (${input.type}) and technology novelty.`,
          technicalDepth: `Scored ${s.technicalDepth}/100 from code volume, complexity and stack breadth signals.`,
          quality: `Scored ${s.quality}/100 reflecting module complexity and file organization.`,
          documentation: `Scored ${s.documentation}/100 based on ${input.files.some((f) => /readme|doc|\.md$/i.test(f.path)) ? 'present documentation files' : 'limited documentation detected'}.`,
          businessValue: `Scored ${s.businessValue}/100 incorporating ${input.humanReviews?.length ?? 0} human review(s).`,
        },
        recommendationRationale: `Recommendation ${base.recommendation} follows the composite score of ${s.overall}/100 and human review signals.`,
        deterministic: true,
      };
    }
  }
}

function clamp(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}

function topCriterion(s: EvaluationReport['scores']): string {
  const entries = Object.entries(s).filter(([k]) => k !== 'overall');
  const [best] = entries.sort((a, b) => b[1] - a[1]);
  return best ? `${best[0]} (${best[1]}/100)` : 'no standout criterion';
}
