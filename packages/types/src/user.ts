import { z } from 'zod';
import { UserRole } from './enums';

export interface User {
  id: string;
  email: string;
  name: string;
  department?: string | null;
  role: UserRole;
  authProvider?: string | null;
  mfaEnabled: boolean;
  passkeyRegistered: boolean;
  skills: string[];
  careerLevel?: string | null;
  managerId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastLogin?: string | Date | null;
}

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(200),
  department: z.string().max(100).optional(),
  role: z.nativeEnum(UserRole).default(UserRole.TALENT),
  skills: z.array(z.string()).default([]),
  careerLevel: z.string().max(100).optional(),
  managerId: z.string().uuid().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export type LoginInput = z.infer<typeof LoginSchema>;

export const MfaVerifySchema = z.object({
  userId: z.string().uuid(),
  code: z.string().length(6),
});

export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  mfaRequired?: boolean;
}