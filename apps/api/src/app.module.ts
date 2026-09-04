import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProjectsModule } from './projects/projects.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AiModule } from './ai/ai.module';
import { NotificationsModule } from './notifications/notifications.module';
import { StorageModule } from './storage/storage.module';
import { CommentsModule } from './comments/comments.module';
import { QueueModule } from './queue/queue.module';
import { AuditModule } from './audit/audit.module';
import { AdminModule } from './admin/admin.module';
import { AssessmentsModule } from './assessments/assessments.module';
import { HealthController } from './health.controller';
import { User } from './users/user.entity';
import { Project } from './projects/project.entity';
import { ProjectFile } from './projects/project-file.entity';
import { Review } from './reviews/review.entity';
import { AiReport } from './ai/ai-report.entity';
import { AiInteraction } from './ai/ai-interaction.entity';
import { Comment } from './comments/comment.entity';
import { AuditLog } from './audit/audit-log.entity';
import { QueueJob } from './queue/queue-job.entity';
import { SkillAssessment } from './assessments/skill-assessment.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USER', 'talentshowcase'),
        password: config.get<string>('DB_PASSWORD', 'talentshowcase'),
        database: config.get<string>('DB_NAME', 'talentshowcase'),
        entities: [
          User,
          Project,
          ProjectFile,
          Review,
          AiReport,
          AiInteraction,
          Comment,
          AuditLog,
          QueueJob,
          SkillAssessment,
        ],
        synchronize: config.get<string>('NODE_ENV') !== 'production',
        autoLoadEntities: true,
      }),
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret-change-me'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
    // Infrastructure (global services)
    StorageModule,
    QueueModule,
    AuditModule,
    NotificationsModule,
    // Feature modules
    AuthModule,
    UsersModule,
    ProjectsModule,
    ReviewsModule,
    CommentsModule,
    AiModule,
    AssessmentsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
