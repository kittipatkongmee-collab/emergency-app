import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { AccessGuard } from '../../common/auth';
import { AdminAuthController, CitizenAuthController } from './auth.controller';
import { AuthService } from './auth.service';
import {
  DevelopmentAuthProvider,
  FacebookAuthProvider,
  LineAuthProvider,
} from './auth-provider';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CitizenAuthController, AdminAuthController],
  providers: [
    AuthService,
    DevelopmentAuthProvider,
    FacebookAuthProvider,
    LineAuthProvider,
    { provide: APP_GUARD, useClass: AccessGuard },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
