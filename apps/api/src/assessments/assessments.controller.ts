import { Controller, ForbiddenException, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import { UserRole } from '@talentshowcase/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AssessmentsService } from './assessments.service';
import { SkillAssessment } from './skill-assessment.entity';

interface AuthedRequest {
  user: { sub: string; role: UserRole };
}

/** Skill radar endpoints (Phase 3 career development screens). */
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssessmentsController {
  constructor(private readonly assessments: AssessmentsService) {}

  @Get('users/:userId/skill-radar')
  async radar(@Param('userId') userId: string, @Request() req: AuthedRequest) {
    this.assertCanView(userId, req);
    return this.assessments.radarFor(userId);
  }

  @Get('users/:userId/skill-assessments')
  async list(@Param('userId') userId: string, @Request() req: AuthedRequest): Promise<SkillAssessment[]> {
    this.assertCanView(userId, req);
    return this.assessments.listForUser(userId);
  }

  @Get('skill-radar/compare')
  async compare(
    @Query('userA') userA: string,
    @Query('userB') userB: string,
    @Request() req: AuthedRequest,
  ) {
    // Anyone may compare themselves with someone they can see; execs can compare anyone
    const exec = req.user.role === UserRole.HR_ADMIN || req.user.role === UserRole.DEPT_HEAD;
    if (!exec && req.user.sub !== userA && req.user.sub !== userB) {
      throw new ForbiddenException('You can only compare your own radar with another user');
    }
    return this.assessments.compare(userA, userB);
  }

  private assertCanView(userId: string, req: AuthedRequest): void {
    const exec = req.user.role === UserRole.HR_ADMIN || req.user.role === UserRole.DEPT_HEAD;
    if (req.user.sub !== userId && !exec) {
      throw new ForbiddenException('You can only view your own skill radar');
    }
  }
}
