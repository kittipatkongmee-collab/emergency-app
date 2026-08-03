import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { PrincipalKinds, Public, Roles } from '../../common/auth';
import { AdminRole } from '@prisma/client';
import type { AuthenticatedRequest } from '../../common/auth';
import {
  AdminLoginDto,
  ChangePasswordDto,
  DevelopmentLoginDto,
  FacebookLoginDto,
  RefreshDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { PrismaService } from '../core/prisma.service';

@ApiTags('Citizen Authentication')
@PrincipalKinds('citizen')
@Controller('auth')
export class CitizenAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}
  @Public()
  @Post('development-login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  development(@Body() dto: DevelopmentLoginDto) {
    return this.auth.citizenDevelopment(dto.profileId);
  }
  @Public()
  @Post('facebook')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  facebook(@Body() dto: FacebookLoginDto) {
    return this.auth.citizenFacebook(dto.accessToken);
  }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Public() @Post('logout') logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }
  @ApiBearerAuth() @Get('me') me(@Req() req: AuthenticatedRequest) {
    return this.prisma.citizenUser.findUnique({ where: { id: req.user.sub } });
  }
}

@ApiTags('Admin Authentication')
@PrincipalKinds('admin')
@Roles(
  AdminRole.SUPER_ADMIN,
  AdminRole.SUPERVISOR,
  AdminRole.OFFICER,
  AdminRole.VIEWER,
)
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}
  @Public()
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  login(@Body() dto: AdminLoginDto) {
    return this.auth.adminLogin(dto.username, dto.password);
  }
  @Public() @Post('refresh') refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }
  @Public() @Post('logout') logout(@Body() dto: RefreshDto) {
    return this.auth.logout(dto.refreshToken);
  }
  @ApiBearerAuth() @Get('me') me(@Req() req: AuthenticatedRequest) {
    return this.prisma.adminUser.findUnique({
      where: { id: req.user.sub },
      omit: { passwordHash: true },
    });
  }
  @ApiBearerAuth() @Patch('change-password') change(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.auth.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
