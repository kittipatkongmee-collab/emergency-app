import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminUser, StaffPosition } from '../../core/models';
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
      positionId: 'position-1',
      position: {
        id: 'position-1',
        name: 'เจ้าหน้าที่ทดสอบ',
        createdAt: '2026-08-04T00:00:00.000Z',
        updatedAt: '2026-08-04T00:00:00.000Z',
      },
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
      positionId: 'position-1',
    };
    const auth = { user: signal<AdminUser | null>(current) } as unknown as AuthService;
    const component = new UsersComponent(api, auth);

    component.openEditDialog(target);
    expect(component.editDialogOpen()).toBeTrue();
    expect(component.editForm.getRawValue()).toEqual({
      fullName: 'เจ้าหน้าที่ทดสอบ',
      email: 'officer@example.com',
      phone: '0812345678',
      positionId: 'position-1',
    });
  });

  it('แสดงปุ่มเพิ่มเจ้าหน้าที่และเปิดฟอร์มเป็น modal เมื่อกด', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    const positions: StaffPosition[] = [
      {
        id: 'position-1',
        name: 'เจ้าหน้าที่ปฏิบัติการ',
        createdAt: '2026-08-04T00:00:00.000Z',
        updatedAt: '2026-08-04T00:00:00.000Z',
      },
    ];
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
    spyOn(fixture.componentInstance, 'load');
    spyOn(fixture.componentInstance, 'loadPositions');
    fixture.componentInstance.positions.set(positions);
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

  it('เพิ่มตำแหน่งใหม่และนำไปแสดงในตัวเลือกเจ้าหน้าที่', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    const position: StaffPosition = {
      id: 'position-1',
      name: 'เจ้าหน้าที่ประสานงาน',
      createdAt: '2026-08-04T00:00:00.000Z',
      updatedAt: '2026-08-04T00:00:00.000Z',
    };
    api.post.and.returnValue(of(position));
    const user: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(user) } as unknown as AuthService;
    const component = new UsersComponent(api, auth);

    component.openPositionDialog();
    component.positionForm.setValue({ name: 'เจ้าหน้าที่ประสานงาน' });
    component.createPosition();

    expect(api.post).toHaveBeenCalledWith('admin/staff-positions', {
      name: 'เจ้าหน้าที่ประสานงาน',
    });
    expect(component.positions()).toEqual([position]);
    expect(component.positionMessage()).toBe('บันทึกตำแหน่งแล้ว');
  });

  it('แสดงสถานะเปิดใช้งานเป็นสีเขียวและปิดใช้งานเป็นสีแดง', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'patch']);
    const current: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const auth = { user: signal<AdminUser | null>(current) } as unknown as AuthService;
    await TestBed.configureTestingModule({
      imports: [UsersComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(UsersComponent);
    spyOn(fixture.componentInstance, 'load');
    spyOn(fixture.componentInstance, 'loadPositions');
    fixture.componentInstance.users.set([
      current,
      {
        id: 'officer-1',
        username: 'officer',
        fullName: 'เจ้าหน้าที่',
        role: 'OFFICER',
        status: 'INACTIVE',
      },
    ]);
    fixture.componentInstance.loading.set(false);
    fixture.detectChanges();

    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.user-status'),
    );
    expect(statuses.map((status) => status.dataset['userStatus'])).toEqual(['ACTIVE', 'INACTIVE']);
    expect(statuses.map((status) => getComputedStyle(status).backgroundColor)).toEqual([
      'rgb(12, 171, 77)',
      'rgb(239, 25, 49)',
    ]);
    expect(statuses.map((status) => getComputedStyle(status).color)).toEqual([
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)',
    ]);
  });
});
