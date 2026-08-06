import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgSelectComponent } from '@ng-select/ng-select';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { AdminRole, AdminUser, Page, Pagination, StaffPosition } from '../../core/models';
import { PaginationComponent } from '../../shared/pagination';

interface PendingUserAction {
  kind: 'status' | 'delete';
  user: AdminUser;
}

@Component({
  standalone: true,
  imports: [NgSelectComponent, PaginationComponent, ReactiveFormsModule],
  templateUrl: './users.html',
  styleUrl: './users.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UsersComponent implements OnInit {
  readonly pageSize = 10;
  readonly users = signal<AdminUser[]>([]);
  readonly pagination = signal<Pagination>({
    page: 1,
    limit: this.pageSize,
    total: 0,
    totalPages: 0,
  });
  readonly positions = signal<StaffPosition[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly actionBusy = signal(false);
  readonly createDialogOpen = signal(false);
  readonly editDialogOpen = signal(false);
  readonly positionDialogOpen = signal(false);
  readonly positionSaving = signal(false);
  readonly selectedUser = signal<AdminUser | null>(null);
  readonly pendingAction = signal<PendingUserAction | null>(null);
  readonly error = signal('');
  readonly message = signal('');
  readonly actionError = signal('');
  readonly positionMessage = signal('');
  readonly form = new FormGroup({
    fullName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2)],
    }),
    positionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    username: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3)],
    }),
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
    positionId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });
  readonly positionForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
    }),
  });

  constructor(
    private readonly api: ApiService,
    readonly auth: AuthService,
  ) {}

  ngOnInit() {
    this.load();
    this.loadPositions();
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
    this.form.reset({ fullName: '', positionId: '', username: '', password: '' });
    this.message.set('');
    this.createDialogOpen.set(true);
  }

  closeCreateDialog() {
    if (this.saving()) return;
    this.createDialogOpen.set(false);
    this.form.reset({ fullName: '', positionId: '', username: '', password: '' });
    this.message.set('');
  }

  openEditDialog(user: AdminUser) {
    if (!this.canManage(user)) return;
    this.selectedUser.set(user);
    this.editForm.reset({
      fullName: user.fullName,
      email: user.email ?? '',
      phone: user.phone ?? '',
      positionId: user.positionId ?? '',
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

  openPositionDialog() {
    if (!this.canCreate()) return;
    this.positionForm.reset({ name: '' });
    this.positionMessage.set('');
    this.positionDialogOpen.set(true);
  }

  closePositionDialog() {
    if (this.positionSaving()) return;
    this.positionDialogOpen.set(false);
    this.positionForm.reset({ name: '' });
    this.positionMessage.set('');
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

  load(page = this.pagination().page) {
    this.loading.set(true);
    this.error.set('');
    this.api
      .get<Page<AdminUser>>('admin/users', {
        page: String(page),
        limit: String(this.pageSize),
      })
      .subscribe({
        next: (result) => {
          this.users.set(result.items);
          this.pagination.set(result.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('ไม่สามารถโหลดบัญชีเจ้าหน้าที่ได้');
          this.loading.set(false);
        },
      });
  }

  selectPage(page: number) {
    if (page < 1 || page > this.pagination().totalPages || page === this.pagination().page) {
      return;
    }
    this.load(page);
  }

  loadPositions() {
    this.api.get<StaffPosition[]>('admin/staff-positions').subscribe({
      next: (positions) => this.positions.set(positions),
      error: () => this.positionMessage.set('ไม่สามารถโหลดข้อมูลตำแหน่งได้'),
    });
  }

  createPosition() {
    if (this.positionForm.invalid || this.positionSaving()) {
      this.positionForm.markAllAsTouched();
      return;
    }
    this.positionSaving.set(true);
    this.positionMessage.set('');
    this.api
      .post<StaffPosition>('admin/staff-positions', this.positionForm.getRawValue())
      .pipe(finalize(() => this.positionSaving.set(false)))
      .subscribe({
        next: (position) => {
          this.positions.update((positions) =>
            [...positions, position].sort((left, right) =>
              left.name.localeCompare(right.name, 'th'),
            ),
          );
          this.positionForm.reset({ name: '' });
          this.positionMessage.set('บันทึกตำแหน่งแล้ว');
        },
        error: () => this.positionMessage.set('บันทึกตำแหน่งไม่สำเร็จ หรือมีชื่อนี้อยู่แล้ว'),
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
          this.form.reset({ fullName: '', positionId: '', username: '', password: '' });
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
        positionId: value.positionId,
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
