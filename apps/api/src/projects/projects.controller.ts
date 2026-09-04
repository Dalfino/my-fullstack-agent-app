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
import { ProjectsService, ProjectStatusAction } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  AuditAction,
  CreateProjectInput,
  CreateProjectSchema,
  Paginated,
  Project,
  ProjectQuery,
  ProjectQuerySchema,
  UpdateProjectInput,
  UpdateProjectSchema,
} from '@talentshowcase/types';

@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectsController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

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

  /** Phase 3 status transitions with decision gate (approve). */
  @Post(':id/status')
  async changeStatus(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; email: string; role: string } },
    @Body() body: { action: string; note?: string },
  ) {
    const action = body?.action as ProjectStatusAction;
    const result = await this.projectsService.changeStatus(id, action, req.user, body?.note);

    await this.audit.log({
      actorId: req.user.sub,
      actorEmail: req.user.email,
      action: AuditAction.PROJECT_STATUS_CHANGED,
      entityType: 'project',
      entityId: id,
      context: { from: result.previousStatus, to: result.project.status, action, note: body?.note },
    });

    await this.notifications.notifyUser(result.project.ownerId, 'project:status', {
      projectId: id,
      from: result.previousStatus,
      to: result.project.status,
      by: req.user.email,
    });
    await this.notifications.notifyProject(id, 'status-changed', {
      from: result.previousStatus,
      to: result.project.status,
    });

    return result.project;
  }

  @Get(':id/files')
  async getFiles(@Param('id') id: string) {
    return this.projectsService.getFiles(id);
  }
}