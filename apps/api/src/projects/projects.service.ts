import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Project } from './project.entity';
import { ProjectFile } from './project-file.entity';
import {
  CreateProjectInput,
  UpdateProjectInput,
  ProjectQuery,
  Paginated,
  ProjectStatus,
} from '@talentshowcase/types';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(ProjectFile)
    private readonly fileRepo: Repository<ProjectFile>,
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

  async getFiles(projectId: string): Promise<ProjectFile[]> {
    return this.fileRepo.find({ where: { projectId } });
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