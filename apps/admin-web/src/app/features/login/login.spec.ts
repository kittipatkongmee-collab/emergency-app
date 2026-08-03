import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { LoginComponent } from './login';

describe('LoginComponent', () => {
  it('แสดงโลโก้และชื่อกองบินตำรวจ', async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const logo = element.querySelector<HTMLImageElement>('.brand-mark img');
    expect(logo?.getAttribute('src')).toBe('images/police-aviation-logo-transparent.png');
    expect(logo?.getAttribute('alt')).toBe('โลโก้กองบินตำรวจ');
    expect(element.querySelector('.brand .eyebrow')?.textContent?.trim()).toBe('กองบินตำรวจ');
    expect(element.querySelector('.officer-icon')).toBeNull();
    expect(element.querySelector('.smart-card')).toBeNull();
    expect(element.querySelector('.help')).toBeNull();
  });

  it('ไม่เรียก API เมื่อฟอร์มยังไม่ครบ', async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(LoginComponent);
    fixture.componentInstance.submit();
    expect(fixture.componentInstance.form.invalid).toBeTrue();
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('เข้าสู่ dashboard เมื่อข้อมูลเข้าสู่ระบบถูกส่งสำเร็จ', async () => {
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    auth.login.and.returnValue(
      of({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        expiresIn: '15m',
      }),
    );
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);
    router.navigateByUrl.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();
    const component = TestBed.createComponent(LoginComponent).componentInstance;
    component.form.setValue({
      username: 'superadmin',
      password: 'valid-password',
      rememberMe: false,
    });
    component.submit();
    expect(auth.login).toHaveBeenCalledWith('superadmin', 'valid-password', false);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });
});
