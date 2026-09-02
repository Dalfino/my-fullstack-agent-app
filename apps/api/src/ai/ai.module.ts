import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';
import { LlmClient } from './llm.client';
import { ExplainAgent } from './explain.agent';
import { AiService } from './ai.service';
import { AiController } from './ai.controller';
import { ProjectsModule } from '../projects/projects.module';

@Module({
  imports: [TypeOrmModule.forFeature([AiReport, AiInteraction]), ProjectsModule],
  providers: [LlmClient, ExplainAgent, AiService],
  controllers: [AiController],
  exports: [AiService],
})
export class AiModule {}