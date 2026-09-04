import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Project } from './project.entity';
import { ProjectFile } from './project-file.entity';
import { Review } from '../reviews/review.entity';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { FilesController } from './files.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Project, ProjectFile, Review])],
  providers: [ProjectsService],
  controllers: [ProjectsController, FilesController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
