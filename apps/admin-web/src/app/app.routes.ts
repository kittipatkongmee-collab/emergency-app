import { Routes } from '@angular/router';
import { authGuard, guestGuard, roleGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((module) => module.LoginComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((module) => module.ShellComponent),
    children: [
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((module) => module.DashboardComponent),
      },
      {
        path: 'incidents',
        loadComponent: () =>
          import('./features/incidents/incidents').then((module) => module.IncidentsComponent),
      },
      {
        path: 'incidents/:id',
        loadComponent: () =>
          import('./features/incidents/incident-detail').then(
            (module) => module.IncidentDetailComponent,
          ),
      },
      {
        path: 'map',
        loadComponent: () =>
          import('./features/map/map').then((module) => module.IncidentMapComponent),
      },
      {
        path: 'users',
        canActivate: [roleGuard('SUPER_ADMIN', 'SUPERVISOR')],
        loadComponent: () =>
          import('./features/users/users').then((module) => module.UsersComponent),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then(
            (module) => module.NotificationsComponent,
          ),
      },
      {
        path: 'audit',
        canActivate: [roleGuard('SUPER_ADMIN', 'SUPERVISOR')],
        loadComponent: () =>
          import('./features/audit/audit').then((module) => module.AuditComponent),
      },
      {
        path: 'settings',
        canActivate: [roleGuard('SUPER_ADMIN')],
        loadComponent: () =>
          import('./features/settings/settings').then((module) => module.SettingsComponent),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/profile').then((module) => module.ProfileComponent),
      },
      {
        path: 'change-password',
        loadComponent: () =>
          import('./features/change-password/change-password').then(
            (module) => module.ChangePasswordComponent,
          ),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  {
    path: 'unauthorized',
    loadComponent: () =>
      import('./features/status/unauthorized').then((module) => module.UnauthorizedComponent),
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/status/not-found').then((module) => module.NotFoundComponent),
  },
];
