import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';
import { Review } from '../reviews/review.entity';
import { LlmClient } from './llm.client';
import { ExplainAgent } from './agents/explain.agent';
import { CodeAnalystAgent } from './agents/code-analyst.agent';
import { SecurityScannerAgent } from './agents/security-scanner.agent';
import { EvaluationAgent } from './agents/evaluation.agent';
import { CareerAdvisorAgent } from './agents/career-advisor.agent';
import { AiService } from './ai.service';
import { AiController, CareerAdvisorController } from './ai.controller';
import { ProjectsModule } from '../projects/projects.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AssessmentsModule } from '../assessments/assessments.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AiReport, AiInteraction, Review]),
    ProjectsModule,
    ReviewsModule,
    AssessmentsModule,
    UsersModule,
  ],
  providers: [
    LlmClient,
    ExplainAgent,
    CodeAnalystAgent,
    SecurityScannerAgent,
    EvaluationAgent,
    CareerAdvisorAgent,
    AiService,
  ],
  controllers: [AiController, CareerAdvisorController],
  exports: [AiService, LlmClient],
})
export class AiModule {}
