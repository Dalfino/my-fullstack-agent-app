import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { AgentType, ExplainReport } from '@talentshowcase/types';
import { AiReport } from './ai-report.entity';
import { AiInteraction } from './ai-interaction.entity';
import { ExplainAgent } from './explain.agent';
import { ProjectsService } from '../projects/projects.service';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    @InjectRepository(AiReport)
    private readonly reportRepo: Repository<AiReport>,
    @InjectRepository(AiInteraction)
    private readonly interactionRepo: Repository<AiInteraction>,
    private readonly explainAgent: ExplainAgent,
    private readonly projectsService: ProjectsService,
  ) {}

  /**
   * Runs the Explain Agent pipeline for a project and persists the report
   * plus a full audit interaction record.
   */
  async generateExplainReport(projectId: string): Promise<AiReport> {
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

    const saved = await this.reportRepo.save(
      this.reportRepo.create({
        projectId,
        agentType: AgentType.EXPLAIN,
        reportJson: report as unknown as Record<string, unknown>,
        confidenceScore: report.confidenceScore,
        modelVersion: 'glm-4-flash',
      }),
    );

    await this.logInteraction(projectId, AgentType.EXPLAIN, report);

    // Update the project with the AI summary + score
    project.aiSummary = report.executiveSummary;
    project.aiScore = report.confidenceScore;
    project.aiReportJson = saved.reportJson;
    await this.projectsService.update(projectId, {
      aiSummary: report.executiveSummary,
      aiScore: report.confidenceScore,
      aiReportJson: saved.reportJson,
    });

    this.logger.log(`Explain report generated for project ${projectId}`);
    return saved;
  }

  async getReport(projectId: string, agentType: AgentType = AgentType.EXPLAIN): Promise<AiReport> {
    const report = await this.reportRepo.findOne({
      where: { projectId, agentType },
      order: { createdAt: 'DESC' },
    });
    if (!report) {
      throw new NotFoundException('No AI report found for this project');
    }
    return report;
  }

  async getInteractions(projectId: string): Promise<AiInteraction[]> {
    return this.interactionRepo.find({
      where: { projectId },
      order: { createdAt: 'DESC' },
    });
  }

  private async logInteraction(
    projectId: string,
    agentType: AgentType,
    report: ExplainReport,
  ): Promise<void> {
    const promptHash = createHash('sha256').update(agentType + projectId).digest('hex');
    const responseHash = createHash('sha256').update(JSON.stringify(report)).digest('hex');

    await this.interactionRepo.save(
      this.interactionRepo.create({
        projectId,
        agentType,
        promptHash,
        responseHash,
        modelVersion: 'glm-4-flash',
        auditTrail: {
          agent: 'ExplainAgent',
          generatedAt: new Date().toISOString(),
          reportKeys: Object.keys(report),
        },
      }),
    );
  }
}