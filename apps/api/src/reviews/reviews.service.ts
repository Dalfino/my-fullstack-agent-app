import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './review.entity';
import { CreateReviewInput, ReviewStatus, ReviewDecisionInput } from '@talentshowcase/types';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async create(reviewerId: string, input: CreateReviewInput): Promise<Review> {
    const review = this.reviewRepo.create({
      ...input,
      reviewerId,
      status: ReviewStatus.PENDING_APPROVAL,
    });
    return this.reviewRepo.save(review);
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
    return this.reviewRepo.save(review);
  }
}