import {
  ForbiddenException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticationProvider } from '@prisma/client';

export type CitizenIdentityProfile = {
  provider: AuthenticationProvider;
  providerUserId: string;
  fullName: string;
  email?: string;
  profileImageUrl?: string;
};

export interface CitizenAuthProvider {
  authenticate(credential: string): Promise<CitizenIdentityProfile>;
}

@Injectable()
export class DevelopmentAuthProvider implements CitizenAuthProvider {
  authenticate(profileId: string): Promise<CitizenIdentityProfile> {
    if (
      !['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
      process.env.DEV_AUTH_BYPASS !== 'true'
    ) {
      throw new ForbiddenException({
        code: 'PERMISSION_DENIED',
        message: 'ไม่ได้เปิดใช้งานการเข้าสู่ระบบสำหรับการพัฒนา',
      });
    }
    const allowedProfiles =
      process.env.NODE_ENV === 'test' ? ['test1', 'test2'] : ['test1'];
    if (!allowedProfiles.includes(profileId)) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'ไม่พบบัญชีสำหรับเข้าสู่ระบบ',
      });
    }
    return Promise.resolve({
      provider: AuthenticationProvider.DEVELOPMENT,
      providerUserId: profileId,
      fullName: profileId,
    });
  }
}

@Injectable()
export class FacebookAuthProvider implements CitizenAuthProvider {
  async authenticate(accessToken: string): Promise<CitizenIdentityProfile> {
    if (process.env.FACEBOOK_LOGIN_ENABLED !== 'true') {
      throw new ServiceUnavailableException({
        code: 'FACEBOOK_LOGIN_NOT_CONFIGURED',
        message: 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Facebook',
      });
    }
    const version = process.env.FACEBOOK_GRAPH_API_VERSION ?? 'v23.0';
    const response = await fetch(
      `https://graph.facebook.com/${version}/me?fields=id,name,email,picture&access_token=${encodeURIComponent(accessToken)}`,
    );
    if (!response.ok) {
      throw new UnauthorizedException({
        code: 'FACEBOOK_TOKEN_INVALID',
        message: 'Facebook token ไม่ถูกต้อง',
      });
    }
    const profile = (await response.json()) as {
      id?: string;
      name?: string;
      email?: string;
      picture?: { data?: { url?: string } };
    };
    if (!profile.id || !profile.name) {
      throw new UnauthorizedException({
        code: 'FACEBOOK_TOKEN_INVALID',
        message: 'ข้อมูลบัญชี Facebook ไม่ครบถ้วน',
      });
    }
    return {
      provider: AuthenticationProvider.FACEBOOK,
      providerUserId: profile.id,
      fullName: profile.name,
      email: profile.email,
      profileImageUrl: profile.picture?.data?.url,
    };
  }
}

@Injectable()
export class LineAuthProvider implements CitizenAuthProvider {
  async authenticate(
    idToken: string,
    nonce?: string,
  ): Promise<CitizenIdentityProfile> {
    if (
      process.env.LINE_LOGIN_ENABLED !== 'true' ||
      !process.env.LINE_CHANNEL_ID
    ) {
      throw new ServiceUnavailableException({
        code: 'LINE_LOGIN_NOT_CONFIGURED',
        message: 'ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย LINE',
      });
    }

    const body = new URLSearchParams({
      id_token: idToken,
      client_id: process.env.LINE_CHANNEL_ID,
    });
    if (nonce) body.set('nonce', nonce);

    let response: Response;
    try {
      response = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ServiceUnavailableException({
        code: 'LINE_SERVICE_UNAVAILABLE',
        message: 'ไม่สามารถตรวจสอบบัญชี LINE ได้ในขณะนี้',
      });
    }

    if (!response.ok) {
      throw new UnauthorizedException({
        code: 'LINE_TOKEN_INVALID',
        message: 'ข้อมูลเข้าสู่ระบบ LINE ไม่ถูกต้องหรือหมดอายุ',
      });
    }

    const profile: unknown = await response.json().catch(() => null);
    if (
      !profile ||
      typeof profile !== 'object' ||
      !('sub' in profile) ||
      typeof profile.sub !== 'string' ||
      !profile.sub ||
      !('name' in profile) ||
      typeof profile.name !== 'string' ||
      !profile.name ||
      (nonce && (!('nonce' in profile) || profile.nonce !== nonce))
    ) {
      throw new UnauthorizedException({
        code: 'LINE_TOKEN_INVALID',
        message: 'ข้อมูลบัญชี LINE ไม่ครบถ้วนหรือไม่ตรงกับคำขอ',
      });
    }

    return {
      // The generated Prisma client learns this enum value after the migration
      // and the next `prisma generate`; the string remains the database value.
      provider: 'LINE' as AuthenticationProvider,
      providerUserId: profile.sub,
      fullName: profile.name,
      email:
        'email' in profile && typeof profile.email === 'string'
          ? profile.email
          : undefined,
      profileImageUrl:
        'picture' in profile && typeof profile.picture === 'string'
          ? profile.picture
          : undefined,
    };
  }
}
