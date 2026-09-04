import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import {
  AgentType,
  AuditAction,
  CodeAnalystReport,
  EvaluationReport,
  JobType,
  ReviewStatus,
  ReviewType,
  SecurityScanReport,
} from '@talentshowcase/types';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';
import { ExplainAgent } from './agents/explain.agent';
import { CodeAnalystAgent, AnalyzedFile } from './agents/code-analyst.agent';
import { SecurityScannerAgent } from './agents/security-scanner.agent';
import { EvaluationAgent } from './agents/evaluation.agent';
import { CareerAdvisorAgent } from './agents/career-advisor.agent';
import { ProjectsService } from '../projects/projects.service';
import { StorageService } from '../storage/storage.service';
import { QueueService } from '../queue/queue.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AssessmentsService } from '../assessments/assessments.service';
import { UsersService } from '../users/users.service';
import { ReviewsService } from '../reviews/reviews.service';
import { Review } from '../reviews/review.entity';

/**
 * Central AI orchestration for all five agents. Each `run*` method executes a
 * full pipeline (fetch data → agent → persist report + interaction → side
 * effects) and is invoked asynchronously through the QueueService by the
 * controller. Results land in `ai_report` and emit realtime notifications.
 */
@Injectable()
export class AiService implements OnModuleInit {
  private readonly logger = new Logger(AiService.name);
  private static readonly MODEL = 'glm-4-flash';

  constructor(
    @InjectRepository(AiReport)
    private readonly reportRepo: Repository<AiReport>,
    @InjectRepository(AiInteraction)
    private readonly interactionRepo: Repository<AiInteraction>,
    private readonly explainAgent: ExplainAgent,
    private readonly codeAnalystAgent: CodeAnalystAgent,
    private readonly securityScannerAgent: SecurityScannerAgent,
    private readonly evaluationAgent: EvaluationAgent,
    private readonly careerAdvisorAgent: CareerAdvisorAgent,
    private readonly projectsService: ProjectsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly assessments: AssessmentsService,
    private readonly usersService: UsersService,
    private readonly reviewsService: ReviewsService,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  /* ------------------------- pipelines --------------------------- */

  /** Register queue job handlers (called once at boot). */
  async onModuleInit(): Promise<void> {
    this.queue.registerHandler(JobType.AI_EXPLAIN, async (job) =>
      this.runExplain(String(job.payload.projectId)),
    );
    this.queue.registerHandler(JobType.AI_CODE_ANALYST, async (job) =>
      this.runCodeAnalyst(String(job.payload.projectId)),
    );
    this.queue.registerHandler(JobType.AI_SECURITY_SCANNER, async (job) =>
      this.runSecurityScan(String(job.payload.projectId)),
    );
    this.queue.registerHandler(JobType.AI_EVALUATION, async (job) =>
      this.runEvaluation(String(job.payload.projectId)),
    );
    this.queue.registerHandler(JobType.AI_CAREER_ADVISOR, async (job) =>
      this.runCareerAdvisor(String(job.payload.userId)),
    );
    this.logger.log('AI agent job handlers registered');
  }

  async runExplain(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.projectsService.findById(projectId);
    const files = await this.projectsService.getFiles(projectId);

    const fileSummary = files
      .slice(0, 30)
      .map((f) => `${f.path} (${f.language ?? 'unknown'}, ${f.lineCount ?? 0} lines)`)
      .join(', ');

    const report = await this.explainAgent.generate({
      title: project.title,
      description: project.description,
      type: project.type,
      techStack: project.techStack ?? [],
      tags: project.tags ?? [],
      fileSummary: fileSummary || 'No files uploaded yet',
    });

    const saved = await this.persistReport(projectId, AgentType.EXPLAIN, report, report.confidenceScore);

    await this.projectsService.update(projectId, {
      aiSummary: report.executiveSummary,
      aiScore: report.confidenceScore,
      aiReportJson: saved.reportJson,
    });

    this.notifyDone(project.ownerId, projectId, 'explain', report.executiveSummary);
    return saved.reportJson;
  }

  async runCodeAnalyst(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.projectsService.findById(projectId);
    const files = await this.loadFileContents(projectId);
    const report = await this.codeAnalystAgent.analyze(files);

    const saved = await this.persistReport(projectId, AgentType.CODE_ANALYST, report, report.confidenceScore);
    this.notifyDone(project.ownerId, projectId, 'code-analysis', report.executiveSummary);
    return saved.reportJson;
  }

  async runSecurityScan(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.projectsService.findById(projectId);
    const files = await this.loadFileContents(projectId);
    const report = await this.securityScannerAgent.scan(files);

    const saved = await this.persistReport(
      projectId,
      AgentType.SECURITY_SCANNER,
      report,
      report.confidenceScore,
    );
    this.notifyDone(
      project.ownerId,
      projectId,
      'security-scan',
      `Risk rating: ${report.riskRating} — ${report.totalFindings} finding(s)`,
    );
    return saved.reportJson;
  }

  /** Full evaluation: blends previous reports, writes AI review + skills. */
  async runEvaluation(projectId: string): Promise<Record<string, unknown>> {
    const project = await this.projectsService.findById(projectId);
    const files = await this.loadFileContents(projectId);

    const codeAnalysis = await this.latestReport<CodeAnalystReport>(projectId, AgentType.CODE_ANALYST);
    const securityScan = await this.latestReport<SecurityScanReport>(projectId, AgentType.SECURITY_SCANNER);
    const humanReviews = await this.reviewRepo.find({ where: { projectId } });

    const owner = await this.usersService.findById(project.ownerId);
    const report = await this.evaluationAgent.evaluate({
      title: project.title,
      description: project.description,
      type: project.type,
      techStack: project.techStack ?? [],
      files: files.map((f) => ({ path: f.path, language: f.language, lineCount: f.lineCount })),
      codeAnalysis,
      securityScan,
      humanReviews: humanReviews.map((r) => ({
        recommendation: r.recommendation,
        scores: r.scoresJson as unknown as Record<string, number>,
        reviewType: r.reviewType,
      })),
      ownerName: owner?.name ?? 'the owner',
    });

    const saved = await this.persistReport(
      projectId,
      AgentType.REVIEW_EVALUATION,
      report,
      report.confidenceScore,
    );

    // Update the project score + AI summary
    await this.projectsService.update(projectId, {
      aiScore: report.scores.overall,
      aiSummary: report.executiveSummary,
      aiReportJson: saved.reportJson,
    });

    // Persist detected skills -> skill radar
    await this.assessments.upsertFromEvaluation(
      project.ownerId,
      report.detectedSkills.map((s) => ({
        skill: s.skill,
        category: s.category,
        score: s.score,
      })),
    );

    // Write an AI review row that feeds the HR decision gate
    await this.reviewRepo.save(
      this.reviewRepo.create({
        projectId,
        reviewType: ReviewType.AI,
        scoresJson: {
          innovation: report.scores.innovation,
          technicalDepth: report.scores.technicalDepth,
          quality: report.scores.quality,
          documentation: report.scores.documentation,
          businessValue: report.scores.businessValue,
        },
        comments: [report.recommendationRationale],
        overallFeedback: report.executiveSummary,
        recommendation: report.recommendation,
        status: ReviewStatus.PENDING_APPROVAL,
      } as Partial<Review> as Review),
    );

    this.notifyDone(
      project.ownerId,
      projectId,
      'evaluation',
      `Overall score ${report.scores.overall}/100 — recommendation: ${report.recommendation}`,
    );
    return saved.reportJson;
  }

  async runCareerAdvisor(userId: string): Promise<Record<string, unknown>> {
    const user = await this.usersService.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    const radar = await this.assessments.radarFor(userId);
    const userProjects = await this.projectsService.findAll(
      { page: 1, pageSize: 5, sortBy: 'aiScore', sortOrder: 'desc' } as never,
      userId,
      user.role,
    );

    const report = await this.careerAdvisorAgent.generate({
      userName: user.name,
      role: user.role,
      careerLevel: user.careerLevel,
      radar,
      topProjects: userProjects.items
        .filter((p) => p.ownerId === userId)
        .map((p) => ({ title: p.title, type: p.type, aiScore: p.aiScore })),
    });

    const saved = await this.persistReport(
      null,
      AgentType.CAREER_ADVISOR,
      report,
      report.confidenceScore,
      userId,
    );

    this.notifyDone(userId, '', 'career-advisor', report.executiveSummary);
    return saved.reportJson;
  }

  /* --------------------------- queries --------------------------- */

  async getReport(projectId: string, agentType: AgentType = AgentType.EXPLAIN): Promise<AiReport> {
    const report = await this.reportRepo.findOne({
      where: { projectId, agentType },
      order: { createdAt: 'DESC' },
    });
    if (!report) {
      throw new NotFoundException('No AI report found for this project and agent');
    }
    return report;
  }

  async getReports(projectId: string): Promise<AiReport[]> {
    return this.reportRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getInteractions(projectId: string): Promise<AiInteraction[]> {
    return this.interactionRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  async getLatestCareerReport(userId: string): Promise<AiReport> {
    const report = await this.reportRepo.findOne({
      where: { userId, agentType: AgentType.CAREER_ADVISOR },
      order: { createdAt: 'DESC' },
    });
    if (!report) {
      throw new NotFoundException('No career advisor report yet — run the advisor first');
    }
    return report;
  }

  /* ------------------------- enqueue API ------------------------- */

  enqueueExplain(projectId: string, requestedById: string) {
    return this.queue.enqueue(JobType.AI_EXPLAIN, { projectId }, { projectId, requestedById });
  }

  enqueueCodeAnalyst(projectId: string, requestedById: string) {
    return this.queue.enqueue(JobType.AI_CODE_ANALYST, { projectId }, { projectId, requestedById });
  }

  enqueueSecurityScan(projectId: string, requestedById: string) {
    return this.queue.enqueue(JobType.AI_SECURITY_SCANNER, { projectId }, { projectId, requestedById });
  }

  enqueueEvaluation(projectId: string, requestedById: string) {
    return this.queue.enqueue(JobType.AI_EVALUATION, { projectId }, { projectId, requestedById });
  }

  enqueueCareerAdvisor(userId: string, requestedById: string) {
    return this.queue.enqueue(JobType.AI_CAREER_ADVISOR, { userId }, { requestedById });
  }

  /* -------------------------- internals -------------------------- */

  /** Load file contents from storage for deterministic agents. */
  private async loadFileContents(projectId: string): Promise<AnalyzedFile[]> {
    const files = await this.projectsService.getFiles(projectId);
    const loaded: AnalyzedFile[] = [];
    for (const f of files.slice(0, 40)) {
      try {
        const buffer = await this.storage.get(f.s3Key);
        loaded.push({
          path: f.path,
          language: f.language ?? 'plaintext',
          lineCount: f.lineCount ?? buffer.toString('utf8').split('\n').length,
          content: buffer.toString('utf8'),
        });
      } catch {
        this.logger.warn(`Could not load content for file ${f.path} of project ${projectId}`);
      }
    }
    return loaded;
  }

  private async persistReport(
    projectId: string | null,
    agentType: AgentType,
    report: unknown,
    confidenceScore: number,
    userId?: string,
  ): Promise<AiReport> {
    const saved = await this.reportRepo.save(
      this.reportRepo.create({
        projectId: projectId ?? null,
        userId: userId ?? null,
        agentType,
        reportJson: report as unknown as Record<string, unknown>,
        confidenceScore,
        modelVersion: AiService.MODEL,
      }),
    );

    await this.interactionRepo.save(
      this.interactionRepo.create({
        projectId: projectId ?? null,
        agentType,
        promptHash: createHash('sha256')
          .update(agentType + (projectId ?? userId ?? ''))
          .digest('hex'),
        responseHash: createHash('sha256').update(JSON.stringify(report)).digest('hex'),
        modelVersion: AiService.MODEL,
        auditTrail: {
          agent: agentType,
          generatedAt: new Date().toISOString(),
          reportKeys: Object.keys(report as Record<string, unknown>),
        },
      } as never),
    );

    await this.audit.log({
      action: AuditAction.AI_REPORT_COMPLETED,
      entityType: 'ai_report',
      entityId: saved.id,
      context: { agentType, projectId, userId, confidenceScore },
    });

    return saved;
  }

  private async latestReport<T>(projectId: string, agentType: AgentType): Promise<T | null> {
    const found = await this.reportRepo.findOne({
      where: { projectId, agentType },
      order: { createdAt: 'DESC' },
    });
    return (found?.reportJson as T) ?? null;
  }

  private notifyDone(userId: string, projectId: string | null, agent: string, summary: string): void {
    this.notifications.notifyUser(userId, 'ai:report-ready', {
      projectId,
      agent,
      summary,
      at: new Date().toISOString(),
    });
    if (projectId) {
      this.notifications.notifyProject(projectId, 'ai-report-ready', { agent });
    }
  }
}
