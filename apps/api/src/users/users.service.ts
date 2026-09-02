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
      },
      {
        email: 'bob@company.com',
        name: 'Bob Manager',
        department: 'People Ops',
        role: UserRole.HR_ADMIN,
        password: 'password123',
      },
    ];

    for (const seedUser of defaultUsers) {
      const existing = await this.userRepo.findOne({ where: { email: seedUser.email } });
      if (!existing) {
        await this.userRepo.save(
          this.userRepo.create({
            email: seedUser.email,
            name: seedUser.name,
            department: seedUser.department,
            role: seedUser.role,
            passwordHash: await bcrypt.hash(seedUser.password, 10),
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
}