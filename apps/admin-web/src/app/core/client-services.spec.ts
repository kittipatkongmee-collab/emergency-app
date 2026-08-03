import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';
import { of } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiService } from './api.service';
import { authGuard, roleGuard } from './auth.guard';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

describe('บริการส่วนกลางของเว็บเจ้าหน้าที่', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('TokenService เก็บ token ใน session และล้างได้', () => {
    const service = new TokenService();
    service.save({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      expiresIn: '15m',
    });
    expect(service.accessToken()).toBe('access-token');
    expect(service.refreshToken()).toBe('refresh-token');
    service.clear();
    expect(service.accessToken()).toBeNull();
    expect(service.refreshToken()).toBeNull();
  });

  it('ApiService แกะ success envelope ก่อนส่งข้อมูลให้หน้าเว็บ', () => {
    TestBed.configureTestingModule({
      providers: [ApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(ApiService);
    const http = TestBed.inject(HttpTestingController);
    let value: { total: number } | undefined;
    api.get<{ total: number }>('admin/dashboard/summary').subscribe((data) => {
      value = data;
    });
    http
      .expectOne(`${environment.apiBaseUrl}/admin/dashboard/summary`)
      .flush({ success: true, data: { total: 12 }, meta: {} });
    expect(value?.total).toBe(12);
    http.verify();
  });

  it('Auth interceptor แนบ access token ใน request', () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['refreshAccessToken'], {
      accessToken: signal<string | null>('signed-access-token'),
    });
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    client.get('/secured').subscribe();
    const request = http.expectOne('/secured');
    expect(request.request.headers.get('Authorization')).toBe('Bearer signed-access-token');
    request.flush({});
    http.verify();
  });

  it('Auth interceptor หมุน refresh token แล้วลอง request ซ้ำเมื่อพบ 401', () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['refreshAccessToken'], {
      accessToken: signal<string | null>('expired-token'),
    });
    auth.refreshAccessToken.and.returnValue(of('new-token'));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: auth },
      ],
    });
    const client = TestBed.inject(HttpClient);
    const http = TestBed.inject(HttpTestingController);
    let completed = false;
    client.get('/secured').subscribe(() => (completed = true));
    http.expectOne('/secured').flush({}, { status: 401, statusText: 'Unauthorized' });
    const retried = http.expectOne('/secured');
    expect(retried.request.headers.get('Authorization')).toBe('Bearer new-token');
    retried.flush({ ok: true });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(completed).toBeTrue();
    http.verify();
  });

  it('Auth guard ส่งผู้ที่ยังไม่เข้าสู่ระบบกลับหน้า login', () => {
    const loginTree = {} as UrlTree;
    const auth = {
      authenticated: () => false,
      user: () => null,
      loadMe: () => of(null),
    };
    const router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(loginTree);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(loginTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('Role guard ปฏิเสธ viewer เมื่อ route ต้องการ supervisor', () => {
    const deniedTree = {} as UrlTree;
    const auth = {
      user: () => ({
        id: 'viewer-id',
        username: 'viewer',
        fullName: 'ผู้ตรวจสอบ',
        role: 'VIEWER',
        status: 'ACTIVE',
      }),
    };
    const router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    router.createUrlTree.and.returnValue(deniedTree);
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    });
    const guard = roleGuard('SUPER_ADMIN', 'SUPERVISOR');
    const result = TestBed.runInInjectionContext(() => guard({} as never, {} as never));
    expect(result).toBe(deniedTree);
    expect(router.createUrlTree).toHaveBeenCalledWith(['/unauthorized']);
  });
});
