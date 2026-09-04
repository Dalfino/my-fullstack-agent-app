import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { AuditAction, CreateReviewInput, ReviewDecisionInput, ReviewStatus } from '@talentshowcase/types';
import { ProjectsService } from '../projects/projects.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
    private readonly projectsService: ProjectsService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(reviewerId: string, input: CreateReviewInput): Promise<Review> {
    const review = this.reviewRepo.create({
      ...input,
      reviewerId,
      status: ReviewStatus.PENDING_APPROVAL,
    });
    const saved = await this.reviewRepo.save(review);

    const project = await this.projectsService.findById(input.projectId);
    await this.audit.log({
      actorId: reviewerId,
      action: AuditAction.REVIEW_CREATED,
      entityType: 'review',
      entityId: saved.id,
      context: { projectId: input.projectId, recommendation: input.recommendation },
    });
    await this.notifications.notifyUser(project.ownerId, 'review:created', {
      projectId: input.projectId,
      reviewId: saved.id,
      recommendation: input.recommendation,
    });

    return saved;
  }

  async findByProject(projectId: string): Promise<Review[]> {
    return this.reviewRepo.find({
      where: { projectId },
      relations: ['reviewer'],
      order: { createdAt: 'DESC' },
    });
  }

  async decide(id: string, actorId: string, input: ReviewDecisionInput): Promise<Review> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) {
      throw new NotFoundException('Review not found');
    }
    if (review.status !== ReviewStatus.PENDING_APPROVAL) {
      throw new ForbiddenException('Review already decided');
    }
    review.status =
      input.decision === 'APPROVE' ? ReviewStatus.APPROVED : ReviewStatus.REJECTED;
    review.actedBy = actorId;
    review.actedAt = new Date();
    const saved = await this.reviewRepo.save(review);

    await this.audit.log({
      actorId,
      action: AuditAction.REVIEW_DECIDED,
      entityType: 'review',
      entityId: id,
      context: { decision: input.decision, note: input.note },
    });
    if (review.projectId) {
      await this.notifications.notifyProject(review.projectId, 'review:decided', {
        reviewId: id,
        decision: input.decision,
      });
    }

    return saved;
  }
}
