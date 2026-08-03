import { HttpClient } from '@angular/common/http';
import { computed, Injectable, signal, Signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, shareReplay, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope, AdminUser, Tokens } from './models';
import { TokenService } from './token.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<AdminUser | null>(null);
  readonly accessToken: Signal<string | null>;
  readonly authenticated: Signal<boolean>;
  private refreshRequest?: Observable<string>;

  constructor(
    private readonly http: HttpClient,
    private readonly tokens: TokenService,
    private readonly router: Router,
  ) {
    this.accessToken = tokens.accessToken;
    this.authenticated = computed(() => Boolean(this.accessToken()));
  }

  login(username: string, password: string, rememberMe: boolean) {
    return this.http
      .post<ApiEnvelope<Tokens>>(`${environment.apiBaseUrl}/admin/auth/login`, {
        username,
        password,
        rememberMe,
      })
      .pipe(
        map((response) => response.data),
        tap((tokens) => this.tokens.save(tokens, rememberMe)),
      );
  }

  loadMe() {
    if (!this.accessToken()) return of(null);
    return this.http.get<ApiEnvelope<AdminUser>>(`${environment.apiBaseUrl}/admin/auth/me`).pipe(
      map((response) => response.data),
      tap((user) => this.user.set(user)),
      catchError(() => {
        this.clearSession();
        return of(null);
      }),
    );
  }

  refreshAccessToken() {
    if (this.refreshRequest) return this.refreshRequest;
    const refreshToken = this.tokens.refreshToken();
    if (!refreshToken) return of('');
    this.refreshRequest = this.http
      .post<ApiEnvelope<Tokens>>(`${environment.apiBaseUrl}/admin/auth/refresh`, {
        refreshToken,
      })
      .pipe(
        map((response) => response.data),
        tap((tokens) => this.tokens.save(tokens)),
        map((tokens) => tokens.accessToken),
        catchError(() => {
          this.clearSession();
          return of('');
        }),
        finalize(() => (this.refreshRequest = undefined)),
        shareReplay(1),
      );
    return this.refreshRequest;
  }

  logout() {
    const refreshToken = this.tokens.refreshToken();
    const request: Observable<unknown> = refreshToken
      ? this.http.post(`${environment.apiBaseUrl}/admin/auth/logout`, { refreshToken })
      : of(null);
    request.pipe(finalize(() => this.clearSession())).subscribe();
  }

  clearSession() {
    this.tokens.clear();
    this.user.set(null);
    void this.router.navigateByUrl('/login');
  }
}
