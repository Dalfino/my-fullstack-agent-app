import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { ProjectFile } from './project-file.entity';
import { Review } from '../reviews/review.entity';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQuery,
  Paginated,
  ProjectStatus,
} from '@talentshowcase/types';

export type ProjectStatusAction =
  | 'submit'
  | 'start-review'
  | 'needs-work'
  | 'approve'
  | 'archive';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectFile)
    private readonly fileRepo: Repository<ProjectFile>,
    @InjectRepository(Review)
    private readonly reviewRepo: Repository<Review>,
  ) {}

  async create(ownerId: string, input: CreateProjectInput): Promise<Project> {
    const project = this.projectRepo.create({ ...input, ownerId });
    return this.projectRepo.save(project);
  }

  async findAll(query: ProjectQuery, viewerId: string, viewerRole: string): Promise<Paginated<Project>> {
    const qb = this.projectRepo
      .createQueryBuilder('project')
      .leftJoinAndSelect('project.owner', 'owner');

    // Visibility filtering: only show projects the viewer can see
    if (viewerRole !== 'HR_ADMIN' && viewerRole !== 'DEPT_HEAD') {
      qb.where(
        '(project.visibility = :company OR project.ownerId = :viewerId OR project.visibility = :dept)',
        { company: 'COMPANY', viewerId, dept: 'DEPT' },
      );
    }

    if (query.type) qb.andWhere('project.type = :type', { type: query.type });
    if (query.status) qb.andWhere('project.status = :status', { status: query.status });
    if (query.ownerId) qb.andWhere('project.ownerId = :ownerId', { ownerId: query.ownerId });
    if (query.search) {
      qb.andWhere('(project.title ILIKE :search OR project.description ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const sortCol = query.sortBy === 'title' ? 'project.title' : `project.${query.sortBy}`;
    qb.orderBy(sortCol, query.sortOrder === 'asc' ? 'ASC' : 'DESC');

    const total = await qb.getCount();
    qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);

    const items = await qb.getMany();
    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }

  async findById(id: string): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id },
      relations: ['owner'],
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async update(id: string, input: UpdateProjectInput): Promise<Project> {
    const project = await this.findById(id);
    Object.assign(project, input);
    return this.projectRepo.save(project);
  }

  async submit(id: string): Promise<Project> {
    const project = await this.findById(id);
    project.status = ProjectStatus.SUBMITTED;
    return this.projectRepo.save(project);
  }

  /**
   * Phase 3 status transition engine with decision gate.
   *
   * Allowed moves:
   *   DRAFT        -> SUBMITTED            (owner)
   *   SUBMITTED    -> UNDER_REVIEW         (REVIEWER / HR_ADMIN / DEPT_HEAD)
   *   UNDER_REVIEW -> DRAFT (needs work)   (REVIEWER / HR_ADMIN / DEPT_HEAD)
   *   UNDER_REVIEW -> APPROVED  [decision gate: requires >=1 approved review]
   *   APPROVED     -> ARCHIVED             (HR_ADMIN / DEPT_HEAD / owner)
   */
  async changeStatus(
    projectId: string,
    action: ProjectStatusAction,
    actor: { sub: string; email: string; role: string },
    note?: string,
  ): Promise<{ project: Project; previousStatus: ProjectStatus }> {
    const project = await this.findById(projectId);
    const previousStatus = project.status;
    const isOwner = project.ownerId === actor.sub;
    const isReviewer = actor.role === 'REVIEWER';
    const isExec = actor.role === 'HR_ADMIN' || actor.role === 'DEPT_HEAD';

    const fail = (msg: string): never => {
      throw new ForbiddenException(msg);
    };

    switch (action) {
      case 'submit':
        if (!isOwner && !isExec) fail('Only the project owner can submit this project');
        this.assertTransition(previousStatus, ProjectStatus.DRAFT);
        project.status = ProjectStatus.SUBMITTED;
        break;
      case 'start-review':
        if (!isReviewer && !isExec) fail('Only reviewers or HR can start a review');
        this.assertTransition(previousStatus, ProjectStatus.SUBMITTED);
        project.status = ProjectStatus.UNDER_REVIEW;
        break;
      case 'needs-work':
        if (!isReviewer && !isExec) fail('Only reviewers or HR can send a project back');
        this.assertTransition(previousStatus, ProjectStatus.UNDER_REVIEW);
        project.status = ProjectStatus.DRAFT;
        break;
      case 'approve': {
        if (!isExec) fail('Only HR or department heads can approve projects');
        this.assertTransition(previousStatus, ProjectStatus.UNDER_REVIEW);
        // Decision gate: at least one approved human review required
        const reviews = await this.reviewRepo.find({ where: { projectId } });
        const hasApprovedReview = reviews.some(
          (r) =>
            r.reviewType !== 'AI' &&
            r.status === 'APPROVED' &&
            r.recommendation !== 'REJECT',
        );
        if (!hasApprovedReview) {
          fail('Decision gate: at least one approved human review is required before approval');
        }
        project.status = ProjectStatus.APPROVED;
        break;
      }
      case 'archive':
        if (!isExec && !isOwner) fail('Only HR, department heads or the owner can archive');
        this.assertTransition(previousStatus, ProjectStatus.APPROVED);
        project.status = ProjectStatus.ARCHIVED;
        break;
      default:
        fail('Unknown status action');
    }

    const saved = await this.projectRepo.save(project);
    return { project: saved, previousStatus };
  }

  private assertTransition(from: ProjectStatus, to: ProjectStatus): void {
    if (from !== to) {
      throw new ForbiddenException(
        `Invalid transition: cannot ${to === ProjectStatus.DRAFT ? 'send back' : 'move to ' + to} from ${from}`,
      );
    }
  }

  async getFiles(projectId: string): Promise<ProjectFile[]> {
    return this.fileRepo.find({ where: { projectId } });
  }

  async getFile(projectId: string, fileId: string): Promise<ProjectFile> {
    const file = await this.fileRepo.findOneBy({ id: fileId, projectId });
    if (!file) {
      throw new NotFoundException('File not found on this project');
    }
    return file;
  }

  async deleteFile(projectId: string, fileId: string): Promise<void> {
    await this.fileRepo.delete({ id: fileId, projectId });
  }

  async addFile(projectId: string, file: Partial<ProjectFile>): Promise<ProjectFile> {
    const record = this.fileRepo.create({ projectId, ...file });
    return this.fileRepo.save(record);
  }

  async assertOwner(projectId: string, userId: string): Promise<Project> {
    const project = await this.findById(projectId);
    if (project.ownerId !== userId) {
      throw new ForbiddenException('You do not own this project');
    }
    return project;
  }
}