import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { AuditService } from '../audit/audit.service';
import { MfaService } from './mfa.service';
import { LoginInput, AuthResponse } from '@talentshowcase/types';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly audit: AuditService,
    private readonly mfa: MfaService,
  ) {}

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.usersService.findByEmailWithPassword(input.email);
    if (!user) {
      await this.audit.log({
        action: 'USER_LOGIN_FAILED',
        entityType: 'user',
        context: { email: input.email, reason: 'unknown-user' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.usersService.verifyPassword(user, input.password);
    if (!valid) {
      await this.audit.log({
        actorId: user.id,
        actorEmail: user.email,
        action: 'USER_LOGIN_FAILED',
        entityType: 'user',
        entityId: user.id,
        context: { reason: 'bad-password' },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.usersService.updateLastLogin(user.id);

    // MFA challenge: hand out a short-lived ticket instead of tokens.
    if (user.mfaEnabled) {
      const userWithSecret = await this.usersService.findByIdWithMfa(user.id);
      if (userWithSecret?.mfaSecret) {
        const ticket = this.jwtService.sign(
          { sub: user.id, email: user.email, scope: 'mfa' },
          { expiresIn: '5m' },
        );
        return {
          accessToken: '',
          refreshToken: '',
          user: this.toDto(user),
          mfaRequired: true,
          mfaTicket: ticket,
        } as AuthResponse;
      }
    }

    await this.audit.log({
      actorId: user.id,
      actorEmail: user.email,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: user.id,
      context: { mfa: user.mfaEnabled },
    });

    return this.issueTokens(user);
  }

  /** Complete an MFA login challenge: exchange ticket + TOTP code for tokens. */
  async verifyMfa(ticket: string, code: string): Promise<AuthResponse> {
    let payload: { sub: string; email: string; scope?: string };
    try {
      payload = this.jwtService.verify<{ sub: string; email: string; scope?: string }>(ticket);
    } catch {
      throw new UnauthorizedException('MFA ticket expired, please login again');
    }
    if (payload.scope !== 'mfa') {
      throw new UnauthorizedException('Invalid MFA ticket');
    }

    const userWithSecret = await this.usersService.findByIdWithMfa(payload.sub);
    if (!userWithSecret || !userWithSecret.mfaEnabled) {
      throw new UnauthorizedException('MFA is not enabled for this account');
    }

    const valid = this.mfa.verify(userWithSecret.mfaSecret, code);
    if (!valid) {
      await this.audit.log({
        actorId: userWithSecret.id,
        actorEmail: userWithSecret.email,
        action: 'USER_LOGIN_FAILED',
        entityType: 'user',
        entityId: userWithSecret.id,
        context: { reason: 'bad-mfa-code' },
      });
      throw new UnauthorizedException('Invalid MFA code');
    }

    await this.usersService.updateLastLogin(userWithSecret.id);
    await this.audit.log({
      actorId: userWithSecret.id,
      actorEmail: userWithSecret.email,
      action: 'USER_LOGIN',
      entityType: 'user',
      entityId: userWithSecret.id,
      context: { mfa: true },
    });
    return this.issueTokens(userWithSecret);
  }

  async validateUser(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException();
    }
    return user;
  }

  private issueTokens(user: any): AuthResponse {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: this.toDto(user),
    };
  }

  private toDto(user: any) {
    const { passwordHash, mfaSecret, ...rest } = user;
    return rest;
  }
}
