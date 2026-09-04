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
  /** Short-lived JWT issued by the login endpoint when MFA is enabled. */
  ticket: z.string().min(10),
  code: z.string().length(6),
});

export type MfaVerifyInput = z.infer<typeof MfaVerifySchema>;

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
  mfaRequired?: boolean;
  /** Short-lived ticket presented to POST /auth/mfa/verify when mfaRequired. */
  mfaTicket?: string;
}

/* ------------------------- MFA (TOTP) ----------------------------- */

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
  /** Data-URL PNG of the QR code for authenticator apps. */
  qrDataUrl: string;
}

export const MfaEnableSchema = z.object({
  secret: z.string().min(16).max(64),
  code: z.string().length(6),
});

export type MfaEnableInput = z.infer<typeof MfaEnableSchema>;

export const MfaDisableSchema = z.object({
  code: z.string().length(6),
});

export type MfaDisableInput = z.infer<typeof MfaDisableSchema>;