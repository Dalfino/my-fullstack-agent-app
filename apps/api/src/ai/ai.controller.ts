import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { AgentType } from '@talentshowcase/types';
import { AiService } from './ai.service';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';
import { QueueJob } from '../queue/queue-job.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { UserRole } from '@talentshowcase/types';

interface AuthedRequest {
  user: { sub: string; email: string; role: UserRole };
}

/**
 * AI agent endpoints (Phase 2/3). All agent runs are asynchronous: the POST
 * endpoints enqueue a job and return it immediately; clients poll
 * GET /jobs/:id or subscribe to the `ai:report-ready` socket event.
 */
@Controller('projects/:projectId/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('explain')
  @HttpCode(HttpStatus.ACCEPTED)
  async explain(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ jobId: string; queued: true }> {
    const job = await this.aiService.enqueueExplain(projectId, req.user.sub);
    return { jobId: job.id, queued: true };
  }

  @Post('code-analysis')
  @HttpCode(HttpStatus.ACCEPTED)
  async codeAnalysis(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ jobId: string; queued: true }> {
    const job = await this.aiService.enqueueCodeAnalyst(projectId, req.user.sub);
    return { jobId: job.id, queued: true };
  }

  @Post('security-scan')
  @HttpCode(HttpStatus.ACCEPTED)
  async securityScan(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ jobId: string; queued: true }> {
    const job = await this.aiService.enqueueSecurityScan(projectId, req.user.sub);
    return { jobId: job.id, queued: true };
  }

  @Post('evaluation')
  @HttpCode(HttpStatus.ACCEPTED)
  async evaluation(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ jobId: string; queued: true }> {
    const job = await this.aiService.enqueueEvaluation(projectId, req.user.sub);
    return { jobId: job.id, queued: true };
  }

  @Get('reports')
  async reports(@Param('projectId') projectId: string): Promise<AiReport[]> {
    return this.aiService.getReports(projectId);
  }

  @Get('report')
  async report(
    @Param('projectId') projectId: string,
    @Query('agentType') agentType: AgentType = AgentType.EXPLAIN,
  ): Promise<AiReport> {
    return this.aiService.getReport(projectId, agentType);
  }

  @Get('interactions')
  async interactions(@Param('projectId') projectId: string): Promise<AiInteraction[]> {
    return this.aiService.getInteractions(projectId);
  }
}

/** User-level AI endpoint: the Career Advisor (Phase 3). */
@Controller('ai/career-advisor')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CareerAdvisorController {
  constructor(private readonly aiService: AiService) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  async generate(
    @Request() req: AuthedRequest,
    @Body() body: { userId?: string },
  ): Promise<{ jobId: string; queued: true }> {
    // HR can run it for anyone; users only for themselves
    const target = body.userId ?? req.user.sub;
    if (target !== req.user.sub && req.user.role !== UserRole.HR_ADMIN && req.user.role !== UserRole.DEPT_HEAD) {
      throw new ForbiddenException('You can only run the career advisor for yourself');
    }
    const job = await this.aiService.enqueueCareerAdvisor(target, req.user.sub);
    return { jobId: job.id, queued: true };
  }

  @Get('latest')
  async latest(@Request() req: AuthedRequest, @Query('userId') userId?: string): Promise<AiReport> {
    const target = userId ?? req.user.sub;
    if (target !== req.user.sub && req.user.role !== UserRole.HR_ADMIN && req.user.role !== UserRole.DEPT_HEAD) {
      throw new ForbiddenException('Not allowed to view this career advisor report');
    }
    return this.aiService.getLatestCareerReport(target);
  }
}
