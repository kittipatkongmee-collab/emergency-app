import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminUser } from '../../core/models';
import { UsersComponent } from './users';

describe('UsersComponent', () => {
  it('เปิดและปิดหน้าต่างเพิ่มเจ้าหน้าที่สำหรับผู้มีสิทธิ์ได้', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    const user: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(user) } as unknown as AuthService;
    const component = new UsersComponent(api, auth);

    component.openCreateDialog();
    expect(component.createDialogOpen()).toBeTrue();

    component.closeCreateDialog();
    expect(component.createDialogOpen()).toBeFalse();
  });

  it('ขอคำยืนยันก่อนเปลี่ยนสถานะและลบบัญชี', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    api.get.and.returnValue(
      of({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
    );
    api.patch.and.returnValue(of({}));
    api.delete.and.returnValue(of({ deleted: true }));
    const current: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const target: AdminUser = {
      id: 'officer-1',
      username: 'officer',
      fullName: 'เจ้าหน้าที่ทดสอบ',
      role: 'OFFICER',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(current) } as unknown as AuthService;
    const component = new UsersComponent(api, auth);

    component.requestStatusChange(target);
    expect(component.pendingAction()).toEqual({ kind: 'status', user: target });
    expect(api.patch).not.toHaveBeenCalled();
    component.confirmPendingAction();
    expect(api.patch).toHaveBeenCalledWith('admin/users/officer-1/status', {
      status: 'INACTIVE',
    });

    component.requestDelete(target);
    expect(component.pendingAction()).toEqual({ kind: 'delete', user: target });
    expect(api.delete).not.toHaveBeenCalled();
    component.confirmPendingAction();
    expect(api.delete).toHaveBeenCalledWith('admin/users/officer-1');
  });

  it('เปิด modal แก้ไขพร้อมข้อมูลบัญชีที่เลือก', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch', 'delete']);
    const current: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const target: AdminUser = {
      id: 'officer-1',
      username: 'officer',
      fullName: 'เจ้าหน้าที่ทดสอบ',
      email: 'officer@example.com',
      phone: '0812345678',
      role: 'OFFICER',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(current) } as unknown as AuthService;
    const component = new UsersComponent(api, auth);

    component.openEditDialog(target);
    expect(component.editDialogOpen()).toBeTrue();
    expect(component.editForm.getRawValue()).toEqual({
      fullName: 'เจ้าหน้าที่ทดสอบ',
      email: 'officer@example.com',
      phone: '0812345678',
      role: 'OFFICER',
    });
  });

  it('แสดงปุ่มเพิ่มเจ้าหน้าที่และเปิดฟอร์มเป็น modal เมื่อกด', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    api.get.and.returnValue(
      of({ items: [], pagination: { page: 1, limit: 100, total: 0, totalPages: 0 } }),
    );
    const user: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(user) } as unknown as AuthService;
    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(UsersComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const addButton = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'เพิ่มเจ้าหน้าที่',
    );

    expect(addButton).toBeDefined();
    expect(element.querySelector('[role="dialog"]')).toBeNull();

    addButton?.click();
    fixture.detectChanges();
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    expect(element.querySelector('#create-staff-title')?.textContent?.trim()).toBe(
      'เพิ่มเจ้าหน้าที่',
    );
  });
});
