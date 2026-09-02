import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@talentshowcase/types';

export const Roles = (...roles: UserRole[]) => SetMetadata('roles', roles);