import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { MfaService } from './mfa.service';

@Module({
  imports: [UsersModule, PassportModule],
  providers: [AuthService, JwtStrategy, MfaService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}