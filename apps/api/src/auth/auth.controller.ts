import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { MfaService } from './mfa.service';
import { UsersService } from '../users/users.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AuditService } from '../audit/audit.service';
import {
  LoginSchema,
  LoginInput,
  AuthResponse,
  MfaSetupResponse,
  MfaEnableSchema,
  MfaDisableSchema,
  MfaVerifySchema,
} from '@talentshowcase/types';
import { AuditAction } from '@talentshowcase/types';

interface AuthedRequest {
  user: { sub: string; email: string };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly mfaService: MfaService,
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginInput): Promise<AuthResponse> {
    const parsed = LoginSchema.parse(body);
    return this.authService.login(parsed);
  }

  /* ------------------------- MFA lifecycle -------------------------- */

  /** Begin TOTP enrolment: returns secret + QR code (data URL). */
  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async setupMfa(@Request() req: AuthedRequest): Promise<MfaSetupResponse> {
    const setup = await this.mfaService.setup(req.user.email);
    await this.usersService.setMfaSecret(req.user.sub, setup.secret);
    return setup;
  }

  /** Confirm enrolment with the first valid TOTP code. */
  @Post('mfa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async enableMfa(
    @Request() req: AuthedRequest,
    @Body() body: { secret: string; code: string },
  ) {
    const input = MfaEnableSchema.parse(body);
    const user = await this.usersService.findByIdWithMfa(req.user.sub);
    this.mfaService.assertValidCode(input.code);
    if (!user || !user.mfaSecret || user.mfaSecret !== input.secret) {
      await this.audit.log({
        actorId: req.user.sub,
        actorEmail: req.user.email,
        action: AuditAction.USER_MFA_ENABLED,
        entityType: 'user',
        entityId: req.user.sub,
        context: { result: 'failed-secret-mismatch' },
      });
      throw new UnauthorizedException('MFA setup session mismatch — restart setup');
    }
    if (!this.mfaService.verify(user.mfaSecret, input.code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.usersService.enableMfa(user.id, input.secret);
    await this.audit.log({
      actorId: req.user.sub,
      actorEmail: req.user.email,
      action: AuditAction.USER_MFA_ENABLED,
      entityType: 'user',
      entityId: req.user.sub,
      context: { result: 'enabled' },
    });
    return { mfaEnabled: true };
  }

  /** Turn MFA off; requires a final valid TOTP code. */
  @Post('mfa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disableMfa(@Request() req: AuthedRequest, @Body() body: { code: string }) {
    const input = MfaDisableSchema.parse(body);
    const user = await this.usersService.findByIdWithMfa(req.user.sub);
    this.mfaService.assertValidCode(input.code);
    if (!user?.mfaSecret || !this.mfaService.verify(user.mfaSecret, input.code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    await this.usersService.disableMfa(user.id);
    await this.audit.log({
      actorId: req.user.sub,
      actorEmail: req.user.email,
      action: AuditAction.USER_MFA_DISABLED,
      entityType: 'user',
      entityId: req.user.sub,
      context: {},
    });
    return { mfaEnabled: false };
  }

  /** Complete a login challenge issued when MFA is enabled. */
  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyMfa(@Body() body: { ticket: string; code: string }): Promise<AuthResponse> {
    const input = MfaVerifySchema.parse(body);
    return this.authService.verifyMfa(input.ticket, input.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: { user: { sub: string } }) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }
}
