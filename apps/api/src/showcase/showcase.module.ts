import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from '../projects/project.entity';
import { ProjectFile } from '../projects/project-file.entity';
import { ShowcaseBlock } from './showcase-block.entity';
import { ShowcaseService } from './showcase.service';
import { ShowcaseController } from './showcase.controller';
import { StorytellerAgent } from '../ai/agents/storyteller.agent';
import { AiModule } from '../ai/ai.module';
import { ProjectsModule } from '../projects/projects.module';

/**
 * Showcase feature module (Phase A): type-aware visual storytelling.
 * Depends on the global Storage / Queue / Notifications modules plus
 * ProjectsModule (file access + ownership checks) and AiModule (LlmClient
 * for the Storyteller agent).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ShowcaseBlock, Project, ProjectFile]),
    ProjectsModule,
    AiModule,
  ],
  providers: [ShowcaseService, StorytellerAgent],
  controllers: [ShowcaseController],
  exports: [ShowcaseService],
})
export class ShowcaseModule {}
