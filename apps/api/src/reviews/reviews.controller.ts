import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@talentshowcase/types';
import {
  CreateReviewSchema,
  ReviewDecisionSchema,
  CreateReviewInput,
  ReviewDecisionInput,
  Review,
} from '@talentshowcase/types';

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Post('projects/:projectId/reviews')
  async create(
    @Request() req: { user: { sub: string } },
    @Param('projectId') projectId: string,
    @Body() body: CreateReviewInput,
  ): Promise<Review> {
    const parsed = CreateReviewSchema.parse({ ...body, projectId });
    return this.reviewsService.create(req.user.sub, parsed);
  }

  @Get('projects/:projectId/reviews')
  async findByProject(@Param('projectId') projectId: string): Promise<Review[]> {
    return this.reviewsService.findByProject(projectId);
  }

  @Roles(UserRole.HR_ADMIN, UserRole.DEPT_HEAD)
  @Post('reviews/:id/decide')
  async decide(
    @Request() req: { user: { sub: string } },
    @Param('id') id: string,
    @Body() body: ReviewDecisionInput,
  ): Promise<Review> {
    const parsed = ReviewDecisionSchema.parse(body);
    return this.reviewsService.decide(id, req.user.sub, parsed);
  }
}