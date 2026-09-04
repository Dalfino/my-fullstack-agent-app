import { Injectable, Logger } from '@nestjs/common';
import { CareerAdvisorReport, CareerAdvisorReportSchema, SkillRadar } from '@talentshowcase/types';
import { LlmClient } from '../llm.client';

export interface CareerAdvisorInput {
  userName: string;
  role: string;
  careerLevel?: string;
  radar: SkillRadar;
  topProjects: Array<{ title: string; type: string; aiScore?: number | null }>;
}

/**
 * AGENT: CAREER ADVISOR (Phase 3)
 * Consumes the user's skill radar + project history and produces a personalized
 * development plan: strengths, gaps, a step-by-step learning roadmap and
 * career-path fits. Deterministic fallback keeps the shape valid offline.
 */
@Injectable()
export class CareerAdvisorAgent {
  private readonly logger = new Logger(CareerAdvisorAgent.name);

  constructor(private readonly llm: LlmClient) {}

  async generate(input: CareerAdvisorInput): Promise<CareerAdvisorReport> {
    const fallback = this.deterministicReport(input);
    const narrative = await this.narrative(input, fallback);

    return CareerAdvisorReportSchema.parse({
      ...fallback,
      executiveSummary: narrative.executiveSummary,
      strengths: narrative.strengths.length ? narrative.strengths : fallback.strengths,
      gaps: narrative.gaps.length ? narrative.gaps : fallback.gaps,
      learningRoadmap: narrative.roadmap.length ? narrative.roadmap : fallback.learningRoadmap,
      careerPaths: narrative.careerPaths.length ? narrative.careerPaths : fallback.careerPaths,
    });
  }

  /* -------------------- deterministic scaffold -------------------- */

  private deterministicReport(input: CareerAdvisorInput): CareerAdvisorReport {
    const levelFor = (score: number) =>
      score >= 80 ? 'advanced' : score >= 60 ? 'proficient' : score >= 35 ? 'developing' : 'novice';

    const axes = [...input.radar.axes].sort((a, b) => b.score - a.score);
    const strengths = axes
      .filter((a) => a.score >= 55)
      .slice(0, 3)
      .map((a) => ({
        area: a.category,
        detail: `Average score ${a.score}/100 across ${a.skills.length} skill(s): ${a.skills
          .slice(0, 3)
          .map((s) => s.skill)
          .join(', ')}.`,
      }));

    const gaps = axes
      .filter((a) => a.score < 55)
      .slice(0, 3)
      .map((a) => ({
        area: a.category,
        detail: `Average score ${a.score}/100 — focused practice would close the gap.`,
        priority: (a.score < 25 ? 'high' : a.score < 40 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      }));

    const roadmap = [
      {
        step: 1,
        title: `Deepen your strongest area (${axes[0]?.category ?? 'core engineering'})`,
        description:
          'Build a small portfolio project that pushes beyond your current comfort zone in your best category.',
        suggestedResources: ['Advanced documentation tracks', 'Open-source contribution'],
        estimatedWeeks: 4,
      },
      {
        step: 2,
        title: `Close the biggest gap (${gaps[0]?.area ?? 'broad fundamentals'})`,
        description: `Structured practice in ${gaps[0]?.area ?? 'fundamentals'} — target a 20-point radar improvement in one quarter.`,
        suggestedResources: ['Interactive courses', 'Internal mentoring program'],
        estimatedWeeks: 6,
      },
      {
        step: 3,
        title: 'Ship an end-to-end showcase project',
        description:
          'Combine your strengths and newly-learned skills in a single project and submit it for review to lift your overall radar score.',
        suggestedResources: ['TalentShowcase submission guide', 'Peer review cycles'],
        estimatedWeeks: 8,
      },
    ];

    const careerPaths = [
      {
        title: `${input.role === 'TALENT' ? 'Senior Engineer' : 'Technical Lead'} track`,
        fitScore: clamp(input.radar.overallScore + 8),
        rationale: `Overall radar score of ${input.radar.overallScore}/100 with strength in ${axes[0]?.category ?? 'engineering'}.`,
      },
      {
        title: 'Specialist track',
        fitScore: clamp((axes[0]?.score ?? 50) + 5),
        rationale: `Depth in ${axes[0]?.skills[0]?.skill ?? 'a niche area'} supports a specialist career path.`,
      },
    ];

    return {
      executiveSummary: '',
      skillRadarSummary: input.radar.axes.map((a) => ({
        category: a.category,
        score: a.score,
        level: levelFor(a.score),
      })),
      strengths,
      gaps,
      learningRoadmap: roadmap,
      careerPaths,
      confidenceScore: 70,
    };
  }

  /* -------------------------- LLM narrative ------------------------- */

  private async narrative(
    input: CareerAdvisorInput,
    fallback: CareerAdvisorReport,
  ): Promise<{
    executiveSummary: string;
    strengths: CareerAdvisorReport['strengths'];
    gaps: CareerAdvisorReport['gaps'];
    roadmap: CareerAdvisorReport['learningRoadmap'];
    careerPaths: CareerAdvisorReport['careerPaths'];
  }> {
    const radarDigest = input.radar.axes
      .map((a) => `${a.category}: ${a.score}/100 (${a.skills.map((s) => `${s.skill}@${s.score}`).join(', ')})`)
      .join('\n');

    const prompt = [
      `Career advisor session for ${input.userName} (role: ${input.role}${input.careerLevel ? `, level: ${input.careerLevel}` : ''}).`,
      '',
      'Skill radar:',
      radarDigest,
      `Overall score: ${input.radar.overallScore}/100`,
      '',
      input.topProjects.length
        ? `Recent projects: ${input.topProjects.map((p) => `${p.title} (${p.type}${p.aiScore ? `, AI score ${p.aiScore}` : ''})`).join('; ')}`
        : 'Recent projects: none submitted yet',
      '',
      'Return JSON with exactly these fields:',
      '- executiveSummary: 2-3 sentence personalized career narrative',
      '- strengths: array of {area, detail} (3 items max, based on the radar)',
      '- gaps: array of {area, detail, priority} (3 items max, priority: high|medium|low)',
      '- learningRoadmap: array of {step, title, description, suggestedResources[], estimatedWeeks} (3-4 steps)',
      '- careerPaths: array of {title, fitScore (0-100), rationale} (2 items)',
    ].join('\n');

    const response = await this.llm.complete([
      {
        role: 'system',
        content:
          'You are the Career Advisor Agent for an enterprise talent showcase platform. ' +
          'You give constructive, specific, encouraging career development advice grounded in the provided skill data. ' +
          'Respond ONLY with valid JSON matching the schema. Never invent skills not present in the radar.',
      },
      { role: 'user', content: prompt },
    ]);

    try {
      const cleaned = response.content.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);
      if (!parsed.executiveSummary) throw new Error('missing summary');
      return {
        executiveSummary: String(parsed.executiveSummary),
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.slice(0, 3) : [],
        gaps: Array.isArray(parsed.gaps) ? parsed.gaps.slice(0, 3) : [],
        roadmap: Array.isArray(parsed.learningRoadmap) ? parsed.learningRoadmap.slice(0, 4) : [],
        careerPaths: Array.isArray(parsed.careerPaths) ? parsed.careerPaths.slice(0, 2) : [],
      };
    } catch {
      const fallbackSummary =
        `${input.userName} shows an overall competency score of ${input.radar.overallScore}/100. ` +
        (fallback.strengths[0]
          ? `Strongest performance is in ${fallback.strengths[0].area}. `
          : '') +
        (fallback.gaps[0]
          ? `The priority development area is ${fallback.gaps[0].area}, addressed in step 2 of the roadmap.`
          : 'The profile is well-balanced across all categories.');
      return {
        executiveSummary: fallbackSummary,
        strengths: [],
        gaps: [],
        roadmap: [],
        careerPaths: [],
      };
    }
  }
}

function clamp(n: number): number {
  return Math.round(Math.max(0, Math.min(100, n)));
}
