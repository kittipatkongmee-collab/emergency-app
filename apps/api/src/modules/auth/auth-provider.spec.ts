import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { LineAuthProvider } from './auth-provider';

describe('LineAuthProvider', () => {
  const originalEnvironment = process.env;
  const provider = new LineAuthProvider();

  beforeEach(() => {
    process.env = {
      ...originalEnvironment,
      LINE_LOGIN_ENABLED: 'true',
      LINE_CHANNEL_ID: '1234567890',
    };
  });

  afterEach(() => {
    process.env = originalEnvironment;
    jest.restoreAllMocks();
  });

  it('verifies the ID token and maps the trusted LINE profile', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: 'U1234567890',
          name: 'ผู้ใช้ LINE',
          picture: 'https://profile.line-scdn.net/example',
          nonce: 'nonce-value-123456',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      provider.authenticate('header.payload.signature', 'nonce-value-123456'),
    ).resolves.toEqual({
      provider: 'LINE',
      providerUserId: 'U1234567890',
      fullName: 'ผู้ใช้ LINE',
      profileImageUrl: 'https://profile.line-scdn.net/example',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://api.line.me/oauth2/v2.1/verify',
    );
    const request = fetchMock.mock.calls[0][1];
    expect(request?.method).toBe('POST');
    expect((request?.body as URLSearchParams).get('client_id')).toBe(
      '1234567890',
    );
    expect((request?.body as URLSearchParams).get('nonce')).toBe(
      'nonce-value-123456',
    );
  });

  it('rejects a token when the nonce does not match', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          sub: 'U1234567890',
          name: 'ผู้ใช้ LINE',
          nonce: 'different-nonce',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await expect(
      provider.authenticate('header.payload.signature', 'nonce-value-123456'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('fails closed when LINE Login is not configured', async () => {
    process.env.LINE_LOGIN_ENABLED = 'false';

    await expect(
      provider.authenticate('header.payload.signature', 'nonce-value-123456'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
