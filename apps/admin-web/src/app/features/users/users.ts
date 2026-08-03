import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminRole, AdminUser, Page } from '../../core/models';

interface PendingUserAction {
  kind: 'status' | 'delete';
  user: AdminUser;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  readonly users = signal<AdminUser[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actionBusy = signal(false);
  readonly createDialogOpen = signal(false);
  readonly editDialogOpen = signal(false);
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly pendingAction = signal<PendingUserAction | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly actionError = signal('');
  readonly form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    role: new FormControl<AdminRole>('OFFICER', { nonNullable: true }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12)],
    }),
  });
  readonly editForm = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(32)] }),
    role: new FormControl<AdminRole>('OFFICER', { nonNullable: true }),
  });

  constructor(
    private readonly api: ApiService,
    readonly auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
  }

  canCreate() {
    return ['SUPER_ADMIN', 'SUPERVISOR'].includes(this.auth.user()?.role ?? '');
  }

  canManage(user: AdminUser) {
    const role = this.auth.user()?.role;
    return role === 'SUPER_ADMIN' || (role === 'SUPERVISOR' && user.role === 'OFFICER');
  }

  openCreateDialog() {
    if (!this.canCreate()) return;
    this.form.reset({ username: '', fullName: '', role: 'OFFICER', password: '' });
    this.message.set('');
    this.createDialogOpen.set(true);
  }

  closeCreateDialog() {
    if (this.saving()) return;
    this.createDialogOpen.set(false);
    this.form.reset({ username: '', fullName: '', role: 'OFFICER', password: '' });
    this.message.set('');
  }

  openEditDialog(user: AdminUser) {
    if (!this.canManage(user)) return;
    this.selectedUser.set(user);
    this.editForm.reset({
      fullName: user.fullName,
      email: user.email ?? '',
      phone: user.phone ?? '',
      role: user.role,
    });
    this.message.set('');
    this.editDialogOpen.set(true);
  }

  closeEditDialog() {
    if (this.saving()) return;
    this.editDialogOpen.set(false);
    this.selectedUser.set(null);
    this.message.set('');
  }

  requestStatusChange(user: AdminUser) {
    if (!this.canManage(user) || user.id === this.auth.user()?.id) return;
    this.actionError.set('');
    this.pendingAction.set({ kind: 'status', user });
  }

  requestDelete(user: AdminUser) {
    if (!this.canManage(user) || user.id === this.auth.user()?.id) return;
    this.actionError.set('');
    this.pendingAction.set({ kind: 'delete', user });
  }

  closeConfirmation() {
    if (this.actionBusy()) return;
    this.pendingAction.set(null);
    this.actionError.set('');
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.get<Page<AdminUser>>('admin/users', { limit: '100' }).subscribe({
      next: (result) => {
        this.users.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดบัญชีเจ้าหน้าที่ได้');
        this.loading.set(false);
      },
    });
  }

  create() {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api
      .post<AdminUser>('admin/users', this.form.getRawValue())
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.form.reset({ username: '', fullName: '', role: 'OFFICER', password: '' });
          this.message.set('เพิ่มเจ้าหน้าที่แล้ว');
          this.createDialogOpen.set(false);
          this.load();
        },
        error: () => this.message.set('เพิ่มเจ้าหน้าที่ไม่สำเร็จ'),
      });
  }

  saveEdit() {
    const user = this.selectedUser();
    if (!user || this.editForm.invalid || this.saving()) {
      this.editForm.markAllAsTouched();
      return;
    }
    const value = this.editForm.getRawValue();
    this.saving.set(true);
    this.api
      .patch<AdminUser>(`admin/users/${user.id}`, {
        fullName: value.fullName,
        email: value.email || undefined,
        phone: value.phone || undefined,
        role: value.role,
      })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.editDialogOpen.set(false);
          this.selectedUser.set(null);
          this.message.set('แก้ไขข้อมูลเจ้าหน้าที่แล้ว');
          this.load();
        },
        error: () => this.message.set('แก้ไขข้อมูลเจ้าหน้าที่ไม่สำเร็จ'),
      });
  }

  confirmPendingAction() {
    const action = this.pendingAction();
    if (!action || this.actionBusy()) return;
    this.actionBusy.set(true);
    this.actionError.set('');
    if (action.kind === 'status') {
      this.api
        .patch<AdminUser>(`admin/users/${action.user.id}/status`, {
          status: action.user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
        })
        .pipe(finalize(() => this.actionBusy.set(false)))
        .subscribe({
          next: () => this.finishAction('เปลี่ยนสถานะเจ้าหน้าที่แล้ว'),
          error: () => this.actionError.set('ไม่สามารถเปลี่ยนสถานะเจ้าหน้าที่ได้'),
        });
      return;
    }
    this.api
      .delete<{ deleted: boolean }>(`admin/users/${action.user.id}`)
      .pipe(finalize(() => this.actionBusy.set(false)))
      .subscribe({
        next: () => this.finishAction('ลบบัญชีเจ้าหน้าที่แล้ว'),
        error: () =>
          this.actionError.set('ไม่สามารถลบบัญชีนี้ได้ หากบัญชีมีประวัติการใช้งานให้ปิดใช้งานแทน'),
      });
  }

  roleLabel(role: AdminRole) {
    return (
      {
        SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
        SUPERVISOR: 'หัวหน้าศูนย์',
        OFFICER: 'เจ้าหน้าที่ปฏิบัติการ',
        VIEWER: 'ผู้ดูข้อมูล',
      }[role] ?? role
    );
  }

  statusLabel(status: AdminUser['status']) {
    return (
      {
        ACTIVE: 'เปิดใช้งาน',
        INACTIVE: 'ปิดใช้งาน',
        SUSPENDED: 'ระงับใช้งาน',
      }[status] ?? status
    );
  }

  private finishAction(message: string) {
    this.pendingAction.set(null);
    this.message.set(message);
    this.load();
  }
}
