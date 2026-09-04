import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditLogQuerySchema } from '@talentshowcase/types';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '@talentshowcase/types';
import { AuditService } from './audit.service';

/**
 * Phase 3 compliance endpoints — HR_ADMIN only. Exposes the immutable audit
 * trail plus aggregate statistics for the admin dashboard.
 */
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_ADMIN)
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  async list(@Query() query: unknown) {
    const parsed = AuditLogQuerySchema.parse(query);
    return this.audit.query(parsed);
  }

  @Get('stats')
  async stats() {
    return { days: 30, actions: await this.audit.stats(30) };
  }
}
