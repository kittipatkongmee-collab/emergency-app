import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/auth';
import type { AuthenticatedRequest } from '../../common/auth';
import {
  AdminLoginDto,
  ChangePasswordDto,
  FacebookLoginDto,
  RefreshDto,
} from './auth.dto';
import { AuthService } from './auth.service';
import { PrismaService } from '../core/prisma.service';

@ApiTags('Citizen Authentication')
@Controller('auth')
export class CitizenAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}
  @Public() @Post('facebook') facebook(@Body() dto: FacebookLoginDto) {
    return this.auth.citizenFacebook(dto.accessToken, dto.fullName);
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
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}
  @Public() @Post('login') login(@Body() dto: AdminLoginDto) {
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
