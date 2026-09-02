import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AiService } from './ai.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';

@Controller('projects/:projectId/ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('explain')
  @HttpCode(HttpStatus.ACCEPTED)
  async generateExplain(@Param('projectId') projectId: string): Promise<{ queued: boolean }> {
    // In Phase 1 this runs synchronously; Phase 2 moves to RabbitMQ async.
    await this.aiService.generateExplainReport(projectId);
    return { queued: true };
  }

  @Get('report')
  async getReport(@Param('projectId') projectId: string): Promise<AiReport> {
    return this.aiService.getReport(projectId);
  }

  @Get('interactions')
  async getInteractions(@Param('projectId') projectId: string): Promise<AiInteraction[]> {
    return this.aiService.getInteractions(projectId);
  }
}