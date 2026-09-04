import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { UserRole, AuditAction } from '@talentshowcase/types';
import { z } from 'zod';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { UsersService } from '../users/users.service';

const AdminUserQuerySchema = z.object({
  search: z.string().max(200).optional(),
  role: z.nativeEnum(UserRole).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const RoleChangeSchema = z.object({
  role: z.nativeEnum(UserRole),
});

/** Phase 3 admin surface: user management, platform stats. HR_ADMIN only. */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.HR_ADMIN)
export class AdminController {
  constructor(
    private readonly usersService: UsersService,
    private readonly audit: AuditService,
  ) {}

  @Get('users')
  async users(@Query() query: Record<string, unknown>) {
    const parsed = AdminUserQuerySchema.parse(query);
    return this.usersService.findAllPaginated(parsed);
  }

  @Patch('users/:id/role')
  async changeRole(
    @Param('id') id: string,
    @Request() req: { user: { sub: string; email: string } },
    @Body() body: { role: UserRole },
  ) {
    const input = RoleChangeSchema.parse(body);
    const user = await this.usersService.changeRole(id, input.role);
    await this.audit.log({
      actorId: req.user.sub,
      actorEmail: req.user.email,
      action: AuditAction.USER_ROLE_CHANGED,
      entityType: 'user',
      entityId: id,
      context: { newRole: input.role },
    });
    return user;
  }

  @Get('stats')
  async stats() {
    return this.usersService.platformStats();
  }
}
