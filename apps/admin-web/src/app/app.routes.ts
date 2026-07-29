import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/login/login').then((m) => m.LoginComponent) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.ShellComponent),
    children: [
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardComponent) },
      { path: 'incidents', loadComponent: () => import('./features/incidents/incidents').then((m) => m.IncidentsComponent) },
      { path: 'incidents/:id', loadComponent: () => import('./features/incidents/incident-detail').then((m) => m.IncidentDetailComponent) },
      { path: 'map', loadComponent: () => import('./features/operations/operations').then((m) => m.IncidentMapComponent) },
      { path: 'users', loadComponent: () => import('./features/operations/operations').then((m) => m.UsersComponent) },
      { path: 'notifications', loadComponent: () => import('./features/operations/operations').then((m) => m.NotificationsComponent) },
      { path: 'audit', loadComponent: () => import('./features/operations/operations').then((m) => m.AuditComponent) },
      { path: 'settings', loadComponent: () => import('./features/operations/operations').then((m) => m.SettingsComponent) },
      { path: 'profile', loadComponent: () => import('./features/operations/operations').then((m) => m.ProfileComponent) },
      { path: 'change-password', loadComponent: () => import('./features/operations/operations').then((m) => m.ChangePasswordComponent) },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: 'unauthorized', loadComponent: () => import('./features/status/status').then((m) => m.UnauthorizedComponent) },
  { path: '**', loadComponent: () => import('./features/status/status').then((m) => m.NotFoundComponent) },
];
