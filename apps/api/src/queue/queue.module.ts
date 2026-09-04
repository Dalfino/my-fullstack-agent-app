import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueueJob } from './queue-job.entity';
import { QueueService } from './queue.service';
import { QueueController } from './queue.controller';

/** Global so every module can enqueue jobs / register handlers. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([QueueJob])],
  providers: [QueueService],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
