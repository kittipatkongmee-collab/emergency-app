import { Injectable, signal } from '@angular/core';
import { Tokens } from './models';

@Injectable({ providedIn: 'root' })
export class TokenService {
  private readonly accessKey = 'police.admin.access';
  private readonly refreshKey = 'police.admin.refresh';
  readonly accessToken = signal<string | null>(
    sessionStorage.getItem(this.accessKey) ?? localStorage.getItem(this.accessKey),
  );

  refreshToken() {
    return sessionStorage.getItem(this.refreshKey) ?? localStorage.getItem(this.refreshKey);
  }

  save(tokens: Tokens, persistent?: boolean) {
    const storage =
      (persistent ?? Boolean(localStorage.getItem(this.refreshKey)))
        ? localStorage
        : sessionStorage;
    this.clear();
    storage.setItem(this.accessKey, tokens.accessToken);
    storage.setItem(this.refreshKey, tokens.refreshToken);
    this.accessToken.set(tokens.accessToken);
  }

  clear() {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem(this.accessKey);
      storage.removeItem(this.refreshKey);
    }
    this.accessToken.set(null);
  }
}
