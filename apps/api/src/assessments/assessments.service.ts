import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SkillRadar, RadarComparison, SkillCategory } from '@talentshowcase/types';
import { SkillAssessment } from './skill-assessment.entity';
import { UsersService } from '../users/users.service';

const ALL_CATEGORIES = Object.values(SkillCategory) as SkillCategory[];

/**
 * Skill assessments: continuously-updated competency scores derived from AI
 * evaluation runs (and admin overrides). Provides radar aggregation and
 * pairwise comparison for the Phase 3 skill radar screens.
 */
@Injectable()
export class AssessmentsService {
  constructor(
    @InjectRepository(SkillAssessment)
    private readonly repo: Repository<SkillAssessment>,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Upsert skill scores from an evaluation run. New scores are averaged with
   * existing evidence so one outlier cannot swing the radar.
   */
  async upsertFromEvaluation(
    userId: string,
    detected: Array<{ skill: string; category: string; score: number }>,
  ): Promise<void> {
    for (const d of detected) {
      const category = (Object.values(SkillCategory) as string[]).includes(d.category)
        ? (d.category as SkillCategory)
        : SkillCategory.BACKEND;
      const existing = await this.repo.findOneBy({ userId, skill: d.skill });

      if (existing) {
        const total = existing.score * existing.evidenceCount + d.score;
        existing.evidenceCount += 1;
        existing.score = Math.round(total / existing.evidenceCount);
        existing.lastEvaluatedAt = new Date();
        existing.category = category;
        await this.repo.save(existing);
      } else {
        await this.repo.save(
          this.repo.create({
            userId,
            skill: d.skill.slice(0, 100),
            category,
            score: Math.round(d.score),
            evidenceCount: 1,
          }),
        );
      }
    }
  }

  async radarFor(userId: string): Promise<SkillRadar> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const skills = await this.repo.find({ where: { userId } });

    const axes = ALL_CATEGORIES.map((category) => {
      const inCategory = skills.filter((s) => s.category === category);
      const score = inCategory.length
        ? Math.round(inCategory.reduce((acc, s) => acc + s.score, 0) / inCategory.length)
        : 0;
      return {
        category,
        score,
        skills: inCategory
          .sort((a, b) => b.score - a.score)
          .map((s) => ({ skill: s.skill, score: Math.round(s.score) })),
      };
    });

    const scored = axes.filter((a) => a.skills.length > 0);
    const overallScore = scored.length
      ? Math.round(scored.reduce((acc, a) => acc + a.score, 0) / scored.length)
      : 0;

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    return {
      userId,
      userName: user.name,
      axes,
      overallScore,
      strengths: sorted.slice(0, 3).map((a) => a.category),
      gaps: [...scored].sort((a, b) => a.score - b.score).slice(0, 3).map((a) => a.category),
      generatedAt: new Date().toISOString(),
    };
  }

  async compare(userAId: string, userBId: string): Promise<RadarComparison> {
    const [radarA, radarB] = await Promise.all([this.radarFor(userAId), this.radarFor(userBId)]);
    return {
      userA: { userId: userAId, userName: radarA.userName, radar: radarA },
      userB: { userId: userBId, userName: radarB.userName, radar: radarB },
      delta: ALL_CATEGORIES.map((category) => {
        const a = radarA.axes.find((x) => x.category === category)?.score ?? 0;
        const b = radarB.axes.find((x) => x.category === category)?.score ?? 0;
        return { category, a, b, diff: a - b };
      }),
    };
  }

  async listForUser(userId: string): Promise<SkillAssessment[]> {
    return this.repo.find({ where: { userId }, order: { score: 'DESC' } });
  }
}
