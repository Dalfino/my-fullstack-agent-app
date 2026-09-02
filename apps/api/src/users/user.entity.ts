import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '@talentshowcase/types';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  department?: string;

  @Column({ type: 'text', default: UserRole.TALENT })
  role: UserRole;

  @Column({ name: 'auth_provider', nullable: true })
  authProvider?: string;

  @Column({ name: 'mfa_enabled', default: false })
  mfaEnabled: boolean;

  @Column({ name: 'passkey_registered', default: false })
  passkeyRegistered: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  skills: string[];

  @Column({ name: 'career_level', nullable: true })
  careerLevel?: string;

  @Column({ name: 'manager_id', type: 'uuid', nullable: true })
  managerId?: string;

  @Column({ select: false, nullable: true })
  passwordHash?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'last_login', type: 'timestamptz', nullable: true })
  lastLogin?: Date;
}