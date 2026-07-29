import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OwnerType } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../core/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async adminLogin(username: string, password: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { username },
    });
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !(await argon2.verify(user.passwordHash, password))
    ) {
      throw new UnauthorizedException('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
    await this.prisma.adminUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issue(user.id, 'admin', user.role, user.username);
  }

  async citizenFacebook(accessToken: string, suppliedName?: string) {
    let profile: {
      id: string;
      name: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.DEV_AUTH_BYPASS === 'true' &&
      accessToken.startsWith('dev-')
    ) {
      profile = { id: accessToken, name: suppliedName ?? 'ผู้ใช้งานทดสอบ' };
    } else {
      const version = process.env.FACEBOOK_GRAPH_API_VERSION ?? 'v23.0';
      const response = await fetch(
        `https://graph.facebook.com/${version}/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
      );
      if (!response.ok)
        throw new UnauthorizedException('Facebook token ไม่ถูกต้อง');
      profile = (await response.json()) as typeof profile;
    }
    const user = await this.prisma.citizenUser.upsert({
      where: { facebookId: profile.id },
      create: {
        facebookId: profile.id,
        fullName: profile.name,
        email: profile.email,
        profileImageUrl: profile.picture?.data?.url,
      },
      update: {
        fullName: profile.name,
        email: profile.email,
        profileImageUrl: profile.picture?.data?.url,
        lastLoginAt: new Date(),
      },
    });
    return this.issue(user.id, 'citizen');
  }

  async refresh(rawToken: string) {
    let payload: {
      sub: string;
      kind: 'admin' | 'citizen';
      jti: string;
      role?: string;
      username?: string;
    };
    try {
      payload = await this.jwt.verifyAsync(rawToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException('Refresh token ไม่ถูกต้อง');
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt < new Date() ||
      record.tokenHash !== this.hash(rawToken)
    ) {
      throw new UnauthorizedException('Refresh token ถูกยกเลิกหรือหมดอายุ');
    }
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date() },
    });
    return this.issue(
      payload.sub,
      payload.kind,
      payload.role,
      payload.username,
    );
  }

  async logout(rawToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{ jti: string }>(rawToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      await this.prisma.refreshToken.updateMany({
        where: { id: payload.jti },
        data: { revokedAt: new Date() },
      });
    } catch {
      return { loggedOut: true };
    }
    return { loggedOut: true };
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ) {
    const user = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id },
    });
    if (!(await argon2.verify(user.passwordHash, currentPassword)))
      throw new ForbiddenException('รหัสผ่านปัจจุบันไม่ถูกต้อง');
    await this.prisma.adminUser.update({
      where: { id },
      data: { passwordHash: await argon2.hash(newPassword) },
    });
    await this.prisma.refreshToken.updateMany({
      where: { ownerId: id, ownerType: 'ADMIN', revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { changed: true };
  }

  private async issue(
    sub: string,
    kind: 'admin' | 'citizen',
    role?: string,
    username?: string,
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub, kind, role, username },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as never,
      },
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub, kind, role, username, jti },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as never,
      },
    );
    const expiresAt = new Date(
      Date.now() +
        (process.env.JWT_REFRESH_EXPIRES_IN === '7d' ? 7 : 30) * 86_400_000,
    );
    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        ownerId: sub,
        ownerType: kind === 'admin' ? OwnerType.ADMIN : OwnerType.CITIZEN,
        tokenHash: this.hash(refreshToken),
        expiresAt,
      },
    });
    return {
      accessToken,
      refreshToken,
      expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
    };
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
