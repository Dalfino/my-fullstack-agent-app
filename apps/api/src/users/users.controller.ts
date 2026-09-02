import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: { user: { sub: string } }) {
    const user = await this.usersService.findById(req.user.sub);
    if (!user) {
      return { statusCode: 404, message: 'User not found' };
    }
    return user;
  }
}