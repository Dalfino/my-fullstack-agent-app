import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  CreateCommentInput,
  CreateCommentSchema,
  UpdateCommentInput,
  UpdateCommentSchema,
  UserRole,
} from '@talentshowcase/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { CommentsService, CommentActor, CommentThreadPair } from './comments.service';
import { Comment } from './comment.entity';

interface AuthedRequest {
  user: { sub: string; email: string; role: UserRole };
}

@Controller('projects/:projectId/comments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  async create(
    @Param('projectId') projectId: string,
    @Request() req: AuthedRequest,
    @Body() body: CreateCommentInput,
  ): Promise<Comment> {
    const input = CreateCommentSchema.parse(body);
    return this.commentsService.create(projectId, this.actor(req), input);
  }

  @Get()
  async threads(
    @Param('projectId') projectId: string,
    @Query('fileId') fileId: string,
  ): Promise<CommentThreadPair[]> {
    return this.commentsService.threadsForFile(projectId, fileId);
  }

  @Patch(':commentId')
  async update(
    @Param('commentId') commentId: string,
    @Request() req: AuthedRequest,
    @Body() body: UpdateCommentInput,
  ): Promise<Comment> {
    const input = UpdateCommentSchema.parse(body);
    return this.commentsService.update(commentId, this.actor(req), input);
  }

  @Delete(':commentId')
  async remove(
    @Param('commentId') commentId: string,
    @Request() req: AuthedRequest,
  ): Promise<{ deleted: boolean }> {
    return this.commentsService.remove(commentId, this.actor(req));
  }

  private actor(req: AuthedRequest): CommentActor {
    return { sub: req.user.sub, email: req.user.email, role: req.user.role };
  }
}
