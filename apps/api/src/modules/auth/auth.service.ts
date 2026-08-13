import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthenticationProvider, TokenOwnerType } from '@prisma/client';
import argon2 from 'argon2';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../core/prisma.service';
import {
  CitizenIdentityProfile,
  DevelopmentAuthProvider,
  FacebookAuthProvider,
  LineAuthProvider,
} from './auth-provider';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly developmentProvider: DevelopmentAuthProvider,
    private readonly facebookProvider: FacebookAuthProvider,
    private readonly lineProvider: LineAuthProvider,
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
      await this.prisma.auditLog.create({
        data: {
          action: 'ADMIN_LOGIN_FAILED',
          entityType: 'AdminUser',
          newValue: { username },
        },
      });
      throw new UnauthorizedException({
        code:
          user?.status !== 'ACTIVE'
            ? 'ACCOUNT_DISABLED'
            : 'INVALID_CREDENTIALS',
        message:
          user?.status !== 'ACTIVE'
            ? 'บัญชีนี้ถูกระงับการใช้งาน'
            : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง',
      });
    }
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          adminUserId: user.id,
          action: 'ADMIN_LOGIN',
          entityType: 'AdminUser',
          entityId: user.id,
        },
      }),
    ]);
    return this.issue(user.id, 'admin', user.role, user.username);
  }

  async citizenDevelopment(profileId: string) {
    return this.citizenFromProfile(
      await this.developmentProvider.authenticate(profileId),
    );
  }

  async citizenFacebook(accessToken: string) {
    return this.citizenFromProfile(
      await this.facebookProvider.authenticate(accessToken),
    );
  }

  async citizenLine(idToken: string, nonce: string) {
    return this.citizenFromProfile(
      await this.lineProvider.authenticate(idToken, nonce),
    );
  }

  private async citizenFromProfile(profile: CitizenIdentityProfile) {
    const existing = await this.prisma.externalIdentity.findUnique({
      where: {
        provider_providerUserId: {
          provider: profile.provider,
          providerUserId: profile.providerUserId,
        },
      },
      include: { citizenUser: true },
    });
    if (
      existing?.citizenUser.status !== undefined &&
      existing.citizenUser.status !== 'ACTIVE'
    ) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'บัญชีนี้ถูกระงับการใช้งาน',
      });
    }
    const user = existing
      ? await this.prisma.citizenUser.update({
          where: { id: existing.citizenUserId },
          data: {
            fullName: profile.fullName,
            email: profile.email,
            profileImageUrl: profile.profileImageUrl,
            lastLoginAt: new Date(),
          },
        })
      : await this.prisma.citizenUser.create({
          data: {
            facebookId:
              profile.provider === AuthenticationProvider.FACEBOOK
                ? profile.providerUserId
                : null,
            fullName: profile.fullName,
            email: profile.email,
            profileImageUrl: profile.profileImageUrl,
            externalIdentities: {
              create: {
                provider: profile.provider,
                providerUserId: profile.providerUserId,
              },
            },
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
      tokenType?: 'refresh';
    };
    try {
      payload = await this.jwt.verifyAsync(rawToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch {
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'Refresh token ไม่ถูกต้องหรือหมดอายุ',
      });
    }
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
    });
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt < new Date() ||
      record.tokenHash !== this.hash(rawToken) ||
      payload.tokenType !== 'refresh' ||
      record.ownerId !== payload.sub
    ) {
      throw new UnauthorizedException({
        code: 'TOKEN_REVOKED',
        message: 'Refresh token ถูกยกเลิกหรือหมดอายุ',
      });
    }
    return this.issue(
      payload.sub,
      payload.kind,
      payload.role,
      payload.username,
      record.id,
    );
  }

  async logout(rawToken: string) {
    try {
      const payload = await this.jwt.verifyAsync<{
        jti: string;
        sub: string;
        kind: 'admin' | 'citizen';
        tokenType: 'refresh';
      }>(rawToken, { secret: process.env.JWT_REFRESH_SECRET });
      await this.prisma.$transaction(async (tx) => {
        await tx.refreshToken.updateMany({
          where: { id: payload.jti, ownerId: payload.sub },
          data: { revokedAt: new Date() },
        });
        if (payload.kind === 'admin') {
          await tx.auditLog.create({
            data: {
              adminUserId: payload.sub,
              action: 'ADMIN_LOGOUT',
              entityType: 'AdminUser',
              entityId: payload.sub,
            },
          });
        }
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
    await this.prisma.auditLog.create({
      data: {
        adminUserId: id,
        action: 'ADMIN_PASSWORD_CHANGED',
        entityType: 'AdminUser',
        entityId: id,
      },
    });
    return { changed: true };
  }

  private async issue(
    sub: string,
    kind: 'admin' | 'citizen',
    role?: string,
    username?: string,
    replacedTokenId?: string,
  ) {
    const accessToken = await this.jwt.signAsync(
      { sub, kind, role, username, tokenType: 'access' },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN ?? '15m') as never,
      },
    );
    const jti = randomUUID();
    const refreshToken = await this.jwt.signAsync(
      { sub, kind, role, username, jti, tokenType: 'refresh' },
      {
        secret: process.env.JWT_REFRESH_SECRET,
        expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN ?? '30d') as never,
      },
    );
    const expiresAt = new Date(Date.now() + this.refreshLifetimeMs());
    await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.create({
        data: {
          id: jti,
          ownerId: sub,
          ownerType:
            kind === 'admin' ? TokenOwnerType.ADMIN : TokenOwnerType.CITIZEN,
          tokenHash: this.hash(refreshToken),
          expiresAt,
        },
      });
      if (replacedTokenId) {
        await tx.refreshToken.update({
          where: { id: replacedTokenId },
          data: { revokedAt: new Date(), replacedByTokenId: jti },
        });
      }
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

  private refreshLifetimeMs() {
    const value = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';
    const match = /^(\d+)([dhm])$/.exec(value);
    if (!match) return 30 * 86_400_000;
    const amount = Number(match[1]);
    const unit =
      match[2] === 'd' ? 86_400_000 : match[2] === 'h' ? 3_600_000 : 60_000;
    return amount * unit;
  }
}
