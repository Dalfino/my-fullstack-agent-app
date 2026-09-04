import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { CreateUserInput, UserRole } from '@talentshowcase/types';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService implements OnApplicationBootstrap {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (this.configService.get<string>('NODE_ENV', 'development') === 'production') {
      return;
    }

    const defaultUsers = [
      {
        email: 'alice@company.com',
        name: 'Alice Johnson',
        department: 'Engineering',
        role: UserRole.TALENT,
        password: 'password123',
        skills: ['React', 'Node.js', 'PostgreSQL', 'Docker'],
        careerLevel: 'L3',
      },
      {
        email: 'carol@company.com',
        name: 'Carol Wu',
        department: 'Data Platform',
        role: UserRole.TALENT,
        password: 'password123',
        skills: ['Python', 'SQL', 'Airflow', 'Tableau'],
        careerLevel: 'L2',
      },
      {
        email: 'dave@company.com',
        name: 'Dave Okafor',
        department: 'Security',
        role: UserRole.REVIEWER,
        password: 'password123',
        skills: ['Security', 'Go', 'Kubernetes'],
        careerLevel: 'L4',
      },
      {
        email: 'bob@company.com',
        name: 'Bob Manager',
        department: 'People Ops',
        role: UserRole.HR_ADMIN,
        password: 'password123',
        skills: ['People Ops'],
        careerLevel: 'L5',
      },
    ];

    for (const seedUser of defaultUsers) {
      const existing = await this.userRepo.findOne({ where: { email: seedUser.email } });
      if (!existing) {
        const { password, skills, careerLevel, ...rest } = seedUser;
        await this.userRepo.save(
          this.userRepo.create({
            ...rest,
            skills,
            careerLevel,
            passwordHash: await bcrypt.hash(password, 10),
          }),
        );
      }
    }
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  async findByIdWithMfa(id: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .where('user.id = :id', { id })
      .getOne();
  }

  async findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();
  }

  async create(input: CreateUserInput, password?: string): Promise<User> {
    const user = this.userRepo.create({
      ...input,
      passwordHash: password ? await bcrypt.hash(password, 10) : undefined,
    });
    return this.userRepo.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepo.update(id, { lastLogin: new Date() });
  }

  async verifyPassword(user: User, password: string): Promise<boolean> {
    if (!user.passwordHash) return false;
    return bcrypt.compare(password, user.passwordHash);
  }

  /* ------------------------------- MFA ------------------------------ */

  async setMfaSecret(id: string, secret: string | undefined | null): Promise<void> {
    await this.userRepo.update(id, {
      mfaSecret: secret as unknown as string,
    });
  }

  async enableMfa(id: string, secret: string): Promise<void> {
    await this.userRepo.update(id, { mfaSecret: secret, mfaEnabled: true });
  }

  async disableMfa(id: string): Promise<void> {
    await this.userRepo.update(id, {
      mfaSecret: null as unknown as string,
      mfaEnabled: false,
    });
  }

  /* ------------------------------ Admin ----------------------------- */

  async findAllPaginated(opts: {
    search?: string;
    role?: UserRole;
    page: number;
    pageSize: number;
  }): Promise<{ items: User[]; total: number; page: number; pageSize: number; totalPages: number }> {
    const qb = this.userRepo.createQueryBuilder('user');
    if (opts.search) {
      qb.andWhere('(user.name ILIKE :s OR user.email ILIKE :s)', { s: `%${opts.search}%` });
    }
    if (opts.role) qb.andWhere('user.role = :role', { role: opts.role });

    const total = await qb.getCount();
    const items = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((opts.page - 1) * opts.pageSize)
      .take(opts.pageSize)
      .getMany();

    return {
      items,
      total,
      page: opts.page,
      pageSize: opts.pageSize,
      totalPages: Math.ceil(total / opts.pageSize),
    };
  }

  async changeRole(id: string, role: UserRole): Promise<User> {
    const user = await this.findById(id);
    if (!user) throw new Error('User not found');
    user.role = role;
    return this.userRepo.save(user);
  }

  async platformStats(): Promise<Record<string, number>> {
    const [users, projects, reviews, assessments] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.manager.getRepository('Project').count(),
      this.userRepo.manager.getRepository('Review').count(),
      this.userRepo.manager.getRepository('SkillAssessment').count(),
    ]);
    return { users, projects, reviews, assessments };
  }
}
