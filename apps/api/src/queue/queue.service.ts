import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as amqp from 'amqplib';
import { JobStatus, JobType } from '@talentshowcase/types';
import { QueueJob } from './queue-job.entity';

export type JobHandler = (job: QueueJob) => Promise<Record<string, any>>;

const QUEUE_NAME = 'talentshowcase.jobs';

/**
 * Durable async job queue with two transports:
 *
 *  1. RabbitMQ (preferred, matches docker-compose.yml): jobs are persisted in
 *     Postgres AND published to the broker; the broker drives execution with
 *     ack/nack semantics.
 *  2. In-process fallback (no broker in dev sandboxes / CI): the same Postgres
 *     rows are executed by an embedded worker loop.
 *
 * Consumers only ever talk to `enqueue()` / `registerHandler()` — the
 * transport choice is transparent and visible via `mode` (health endpoint).
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private handlers = new Map<JobType, JobHandler>();
  private connection: amqp.ChannelModel | null = null;
  private channel: amqp.Channel | null = null;
  private mode: 'rabbitmq' | 'in-process' = 'in-process';
  private stopped = false;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(QueueJob)
    private readonly repo: Repository<QueueJob>,
  ) {}

  get transport(): 'rabbitmq' | 'in-process' {
    return this.mode;
  }

  async onModuleInit(): Promise<void> {
    await this.tryConnectRabbit();
    if (this.mode === 'in-process') {
      // Recover any jobs orphaned by a previous crash/restart
      const orphans = await this.repo
        .createQueryBuilder()
        .update(QueueJob)
        .set({ status: JobStatus.QUEUED })
        .where('status = :s', { s: JobStatus.PROCESSING })
        .returning('id')
        .execute();
      if (orphans.affected) {
        this.logger.warn(`Re-queued ${orphans.affected} orphaned PROCESSING job(s)`);
      }
      this.startWorkerLoop();
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch {
      /* already closed */
    }
  }

  registerHandler(type: JobType, handler: JobHandler): void {
    this.handlers.set(type, handler);
    this.logger.log(`Registered handler for ${type}`);
  }

  /** Persist a job, then hand it to the best available transport. */
  async enqueue(
    type: JobType,
    payload: Record<string, unknown> = {},
    opts: { projectId?: string; requestedById?: string } = {},
  ): Promise<QueueJob> {
    const job = await this.repo.save(
      this.repo.create({
        type,
        payload,
        status: JobStatus.QUEUED,
        projectId: opts.projectId ?? null,
        requestedById: opts.requestedById ?? null,
      }),
    );

    if (this.mode === 'rabbitmq' && this.channel) {
      this.channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify({ jobId: job.id })), {
        persistent: true,
      });
      this.logger.log(`Job ${job.id} (${type}) published to RabbitMQ`);
    } else {
      setImmediate(() => this.processJob(job.id).catch(() => undefined));
      this.logger.log(`Job ${job.id} (${type}) scheduled in-process`);
    }
    return job;
  }

  /** Execute one job by id (used by both the RabbitMQ consumer and the loop). */
  async processJob(jobId: string): Promise<void> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job || job.status === JobStatus.DONE || job.status === JobStatus.PROCESSING) return;

    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.markFailed(job.id, `No handler registered for job type "${job.type}"`);
      return;
    }

    await this.repo.update(job.id, {
      status: JobStatus.PROCESSING,
      startedAt: new Date(),
      attempts: job.attempts + 1,
    });

    try {
      const result = await handler(job);
      await this.repo.update(job.id, {
        status: JobStatus.DONE,
        result,
        finishedAt: new Date(),
      });
      this.logger.log(`Job ${job.id} (${job.type}) completed`);
    } catch (err) {
      await this.markFailed(job.id, (err as Error).message);
    }
  }

  private async markFailed(jobId: string, message: string): Promise<void> {
    await this.repo.update(jobId, {
      status: JobStatus.FAILED,
      error: message.slice(0, 2000),
      finishedAt: new Date(),
    });
    this.logger.warn(`Job ${jobId} failed: ${message}`);
  }

  private async tryConnectRabbit(): Promise<void> {
    const url = this.config.get<string>('RABBITMQ_URL');
    if (!url) {
      this.logger.log('RABBITMQ_URL not configured, using in-process queue');
      return;
    }
    try {
      const conn = await amqp.connect(url, { timeout: 5000 } as amqp.Options.Connect);
      const ch = await conn.createChannel();
      await ch.assertQueue(QUEUE_NAME, { durable: true });
      await ch.prefetch(1);
      await ch.consume(QUEUE_NAME, (msg) => {
        if (!msg) return;
        void (async () => {
          try {
            const { jobId } = JSON.parse(msg.content.toString()) as { jobId: string };
            await this.processJob(jobId);
            ch.ack(msg);
          } catch (err) {
            this.logger.error(`RabbitMQ consumer error: ${(err as Error).message}`);
            ch.nack(msg, false, false);
          }
        })();
      });
      this.connection = conn;
      this.channel = ch;
      this.mode = 'rabbitmq';
      this.logger.log('Queue transport: RabbitMQ');
    } catch (err) {
      this.mode = 'in-process';
      this.logger.warn(
        `RabbitMQ unreachable (${(err as Error).message}); using in-process queue fallback`,
      );
    }
  }

  private startWorkerLoop(): void {
    let backoff = 500; // fast polling right after boot / after a processed job

    const tick = async () => {
      if (this.stopped) return;
      let didWork = false;
      try {
        // Atomically claim one QUEUED job (FOR UPDATE SKIP LOCKED pattern)
        const claimed: Array<{ id: string }> = await this.repo.manager.query(
          `UPDATE queue_job SET status = $1, started_at = NOW(), attempts = attempts + 1
           WHERE id = (
             SELECT id FROM queue_job WHERE status = $2
             ORDER BY created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED
           )
           RETURNING id`,
          [JobStatus.PROCESSING, JobStatus.QUEUED],
        );
        if (claimed?.length) {
          didWork = true;
          await this.executeClaimed(claimed[0].id);
        }
      } catch (err) {
        this.logger.error(`Worker loop error: ${(err as Error).message}`);
      }
      backoff = didWork ? 100 : Math.min(backoff + 100, 2000);
      setTimeout(tick, backoff);
    };

    void tick();
  }

  private async executeClaimed(jobId: string): Promise<void> {
    const job = await this.repo.findOne({ where: { id: jobId } });
    if (!job) return;
    const handler = this.handlers.get(job.type);
    if (!handler) {
      await this.markFailed(job.id, `No handler registered for job type "${job.type}"`);
      return;
    }
    try {
      const result = await handler(job);
      await this.repo.update(job.id, {
        status: JobStatus.DONE,
        result,
        finishedAt: new Date(),
      });
      this.logger.log(`Job ${job.id} (${job.type}) completed (in-process)`);
    } catch (err) {
      await this.markFailed(job.id, (err as Error).message);
    }
  }
}
