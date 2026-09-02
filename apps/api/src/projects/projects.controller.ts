import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectQuerySchema,
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQuery,
  Paginated,
  Project,
} from '@talentshowcase/types';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  async create(
    @Request() req: { user: { sub: string } },
    @Body() body: CreateProjectInput,
  ): Promise<Project> {
    const parsed = CreateProjectSchema.parse(body);
    return this.projectsService.create(req.user.sub, parsed);
  }

  @Get()
  async findAll(
    @Request() req: { user: { sub: string; role: string } },
    @Query() query: ProjectQuery,
  ): Promise<Paginated<Project>> {
    const parsed = ProjectQuerySchema.parse(query);
    return this.projectsService.findAll(parsed, req.user.sub, req.user.role);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<Project> {
    return this.projectsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateProjectInput,
  ): Promise<Project> {
    const parsed = UpdateProjectSchema.parse(body);
    return this.projectsService.update(id, parsed);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.ACCEPTED)
  async submit(@Param('id') id: string): Promise<Project> {
    return this.projectsService.submit(id);
  }

  @Get(':id/files')
  async getFiles(@Param('id') id: string) {
    return this.projectsService.getFiles(id);
  }
}