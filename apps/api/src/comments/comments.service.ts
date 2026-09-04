import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AuditAction,
  CreateCommentInput,
  UpdateCommentInput,
  UserRole,
} from '@talentshowcase/types';
import { Comment as CommentEntity } from './comment.entity';
import { ProjectsService } from '../projects/projects.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../audit/audit.service';

export interface CommentActor {
  sub: string;
  email: string;
  role: UserRole;
}

export interface CommentThreadPair {
  root: CommentEntity;
  replies: CommentEntity[];
}

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(CommentEntity)
    private readonly repo: Repository<CommentEntity>,
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  async create(projectId: string, actor: CommentActor, input: CreateCommentInput): Promise<CommentEntity> {
    await this.projectsService.getFile(projectId, input.fileId);
    const project = await this.projectsService.findById(projectId);

    if (input.parentCommentId) {
      const parent = await this.repo.findOneBy({ id: input.parentCommentId });
      if (!parent || parent.fileId !== input.fileId) {
        throw new NotFoundException('Parent comment not found on this file');
      }
    }

    let comment = this.repo.create({
      projectId,
      fileId: input.fileId,
      authorId: actor.sub,
      parentCommentId: input.parentCommentId ?? null,
      body: input.body,
      lineNumber: input.lineNumber ?? null,
      endLineNumber: input.endLineNumber ?? input.lineNumber ?? null,
    });
    comment = await this.repo.save(comment);

    await this.audit.log({
      actorId: actor.sub,
      actorEmail: actor.email,
      action: AuditAction.COMMENT_CREATED,
      entityType: 'comment',
      entityId: comment.id,
      context: { projectId, fileId: input.fileId, lineNumber: comment.lineNumber },
    });

    if (project.ownerId !== actor.sub) {
      await this.notifications.notifyUser(project.ownerId, 'comment:created', {
        projectId,
        fileId: input.fileId,
        commentId: comment.id,
        by: actor.email,
      });
    }

    return this.hydrate(comment.id);
  }

  /** All comments for a file, grouped into threads (root + replies). */
  async threadsForFile(projectId: string, fileId: string): Promise<CommentThreadPair[]> {
    await this.projectsService.getFile(projectId, fileId);
    const comments = await this.repo.find({
      where: { fileId },
      relations: ['author'],
      order: { createdAt: 'ASC' },
    });

    const roots = comments.filter((c) => !c.parentCommentId);
    return roots.map((root) => ({
      root,
      replies: comments.filter((c) => c.parentCommentId === root.id),
    }));
  }

  async update(commentId: string, actor: CommentActor, input: UpdateCommentInput): Promise<CommentEntity> {
    const comment = await this.getOrThrow(commentId);
    if (input.body !== undefined) {
      if (comment.authorId !== actor.sub) {
        throw new ForbiddenException('Only the author can edit a comment');
      }
      comment.body = input.body;
    }
    if (input.resolved !== undefined) {
      if (!this.canResolve(actor)) {
        throw new ForbiddenException('Not allowed to resolve this comment');
      }
      comment.resolved = input.resolved;
      comment.resolvedById = input.resolved ? actor.sub : null;
      comment.resolvedAt = input.resolved ? new Date() : null;

      await this.audit.log({
        actorId: actor.sub,
        actorEmail: actor.email,
        action: AuditAction.COMMENT_RESOLVED,
        entityType: 'comment',
        entityId: comment.id,
        context: { projectId: comment.projectId, resolved: input.resolved },
      });
    }
    await this.repo.save(comment);
    return this.hydrate(comment.id);
  }

  async remove(commentId: string, actor: CommentActor): Promise<{ deleted: boolean }> {
    const comment = await this.getOrThrow(commentId);
    const privileged = actor.role === UserRole.HR_ADMIN || actor.role === UserRole.DEPT_HEAD;
    if (comment.authorId !== actor.sub && !privileged) {
      throw new ForbiddenException('Only the author or an admin can delete a comment');
    }
    await this.repo.delete(commentId);
    return { deleted: true };
  }

  private canResolve(actor: CommentActor): boolean {
    return (
      actor.role === UserRole.REVIEWER ||
      actor.role === UserRole.HR_ADMIN ||
      actor.role === UserRole.DEPT_HEAD
    );
  }

  private async getOrThrow(commentId: string): Promise<CommentEntity> {
    const comment = await this.repo.findOneBy({ id: commentId });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }

  /** Reload with author relation attached. */
  private async hydrate(commentId: string): Promise<CommentEntity> {
    const full = await this.repo.findOne({
      where: { id: commentId },
      relations: ['author'],
    });
    return full ?? (await this.getOrThrow(commentId));
  }
}
