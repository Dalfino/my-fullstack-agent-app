import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { QueueJob } from './queue-job.entity';
import { QueueService } from './queue.service';

/** Job observability: poll status of async AI / scan pipelines. */
@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QueueController {
  constructor(
    @InjectRepository(QueueJob)
    private readonly repo: Repository<QueueJob>,
    private readonly queue: QueueService,
  ) {}

  @Get(':id')
  async get(@Param('id') id: string): Promise<QueueJob> {
    return this.repo.findOneByOrFail({ id });
  }

  @Get()
  async recent(): Promise<{ transport: string; jobs: QueueJob[] }> {
    const jobs = await this.repo.find({ order: { createdAt: 'DESC' }, take: 50 });
    return { transport: this.queue.transport, jobs };
  }
}
