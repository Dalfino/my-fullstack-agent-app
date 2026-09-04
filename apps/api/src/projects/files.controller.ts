import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { AuditAction, ProjectStatus, UserRole } from '@talentshowcase/types';
import { ProjectsService } from '../projects/projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { StorageService } from '../storage/storage.service';
import { VirusScanService } from '../storage/virus-scan.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { NotificationsService } from '../notifications/notifications.service';
import { JobType } from '@talentshowcase/types';
import { detectLanguage } from './language.util';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_FILES_PER_UPLOAD = 20;

interface AuthedRequest {
  user: { sub: string; email: string; role: UserRole };
}

/**
 * Project file lifecycle: upload (with virus scan + storage persistence),
 * listing, text content preview (powers the inline-comment viewer) and delete.
 */
@Controller('projects/:projectId/files')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FilesController {
  constructor(
    private readonly projectsService: ProjectsService,
    private readonly storage: StorageService,
    private readonly virusScan: VirusScanService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly notifications: NotificationsService,
  ) {}

  @Post()
  @UseInterceptors(FilesInterceptor('files', MAX_FILES_PER_UPLOAD))
  async upload(
    @Param('projectId') projectId: string,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Request() req: AuthedRequest,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files provided (field name must be "files")');
    }
    const project = await this.projectsService.findById(projectId);
    const isOwner = project.ownerId === req.user.sub;
    const privileged = req.user.role === UserRole.HR_ADMIN || req.user.role === UserRole.DEPT_HEAD;
    if (!isOwner && !privileged) {
      throw new ForbiddenException('Only the project owner can upload files');
    }

    const saved = [];
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(`File "${file.originalname}" exceeds the 5 MB limit`);
      }

      const scan = this.virusScan.scan(file.originalname, file.buffer);
      if (!scan.clean) {
        await this.audit.log({
          actorId: req.user.sub,
          actorEmail: req.user.email,
          action: AuditAction.FILE_SCAN_FAILED,
          entityType: 'project_file',
          entityId: projectId,
          context: { filename: file.originalname, signature: scan.signature, reason: scan.reason },
        });
        throw new BadRequestException(
          `File "${file.originalname}" rejected by security scan: ${scan.reason}`,
        );
      }

      const path = sanitizePath(file.originalname);
      const language = detectLanguage(path);
      const content = file.buffer.toString('utf8');
      const lineCount = content.length ? content.split('\n').length : 0;
      const s3Key = `projects/${projectId}/${Date.now()}-${path}`;

      await this.storage.put(s3Key, file.buffer, file.mimetype || 'text/plain');

      const record = await this.projectsService.addFile(projectId, {
        path,
        size: file.size,
        mimeType: file.mimetype || 'text/plain',
        s3Key,
        lineCount,
        language,
        isEntryPoint: false,
      });
      saved.push(record);

      await this.audit.log({
        actorId: req.user.sub,
        actorEmail: req.user.email,
        action: AuditAction.FILE_UPLOADED,
        entityType: 'project_file',
        entityId: record.id,
        context: { projectId, path, size: file.size, language },
      });
    }

    await this.notifications.notifyUser(project.ownerId, 'files:uploaded', {
      projectId,
      count: saved.length,
      files: saved.map((f) => f.path),
    });

    // Refresh the visual showcase with the new files (async, non-blocking).
    // Enqueued via the global QueueService to avoid a module cycle with
    // ShowcaseModule (which imports ProjectsModule for file access).
    await this.queue
      .enqueue(JobType.SHOWCASE_BUILD, { projectId }, { projectId, requestedById: req.user.sub })
      .catch(() => undefined);

    return { uploaded: saved.length, files: saved };
  }

  @Get()
  async list(@Param('projectId') projectId: string) {
    await this.projectsService.findById(projectId);
    return this.projectsService.getFiles(projectId);
  }

  /**
   * Raw binary download (images for showcase galleries, etc.). Returns the
   * exact stored bytes with the recorded MIME type.
   */
  @Get(':fileId/raw')
  async raw(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Res() res: Response,
  ) {
    const file = await this.projectsService.getFile(projectId, fileId);
    const buffer = await this.storage.get(file.s3Key);
    res.type(file.mimeType || 'application/octet-stream').send(buffer);
  }

  @Get(':fileId/content')
  async content(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Query('from') fromStr?: string,
    @Query('to') toStr?: string,
  ) {
    const file = await this.projectsService.getFile(projectId, fileId);
    const buffer = await this.storage.get(file.s3Key);
    const text = buffer.toString('utf8');
    const allLines = text.split('\n');

    const from = Math.max(1, parseInt(fromStr ?? '1', 10) || 1);
    const to = Math.min(allLines.length, parseInt(toStr ?? String(allLines.length), 10) || allLines.length);

    return {
      fileId: file.id,
      path: file.path,
      language: file.language,
      lineCount: allLines.length,
      truncated: text.length > 400_000,
      lines: allLines.slice(from - 1, to).map((content, i) => ({
        number: from + i,
        content,
      })),
    };
  }

  @Delete(':fileId')
  async delete(
    @Param('projectId') projectId: string,
    @Param('fileId') fileId: string,
    @Request() req: AuthedRequest,
  ) {
    const project = await this.projectsService.findById(projectId);
    const isOwner = project.ownerId === req.user.sub;
    const privileged = req.user.role === UserRole.HR_ADMIN || req.user.role === UserRole.DEPT_HEAD;
    if (!isOwner && !privileged) {
      throw new ForbiddenException('Only the project owner can delete files');
    }
    const file = await this.projectsService.getFile(projectId, fileId);
    await this.storage.remove(file.s3Key);
    await this.projectsService.deleteFile(projectId, fileId);

    await this.audit.log({
      actorId: req.user.sub,
      actorEmail: req.user.email,
      action: AuditAction.FILE_DELETED,
      entityType: 'project_file',
      entityId: fileId,
      context: { projectId, path: file.path },
    });
    return { deleted: true };
  }
}

function sanitizePath(name: string): string {
  return name.replace(/\\/g, '/').replace(/\.\./g, '_').replace(/^\/+/, '').slice(0, 400);
}
