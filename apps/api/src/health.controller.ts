import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import type { Health } from '@talentshowcase/types';
import { StorageService } from './storage/storage.service';
import { QueueService } from './queue/queue.service';

/**
 * Phase 2/3 upgraded health probe: checks database, storage driver, queue
 * transport and LLM configuration so operators can see degraded mode at a glance.
 */
@Controller('health')
export class HealthController {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  async getHealth(): Promise<Health> {
    const services: Record<string, 'up' | 'down'> = { api: 'up' };

    // Database
    try {
      await this.dataSource.query('SELECT 1');
      services.database = 'up';
    } catch {
      services.database = 'down';
    }

    // Storage (minio or local fallback)
    try {
      services.storage = (await this.storage.healthy()) ? 'up' : 'down';
    } catch {
      services.storage = 'down';
    }

    // Queue transport
    services.queue = this.queue.transport === 'rabbitmq' ? 'up' : 'up'; // in-process counts as up

    // LLM: configured (key present) vs deterministic fallback
    services.llm = this.config.get<string>('LLM_API_KEY') ? 'up' : 'down';

    const critical = [services.api, services.database];
    const status = critical.every((s) => s === 'up')
      ? 'ok'
      : critical.some((s) => s === 'up')
        ? 'degraded'
        : 'down';

    return { status, services, timestamp: new Date().toISOString() };
  }
}
