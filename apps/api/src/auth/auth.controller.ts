import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginSchema, LoginInput, AuthResponse } from '@talentshowcase/types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: LoginInput): Promise<AuthResponse> {
    const parsed = LoginSchema.parse(body);
    return this.authService.login(parsed);
  }
}