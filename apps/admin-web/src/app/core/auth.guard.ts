import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthRole } from './role.guard';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.authenticated()) return router.createUrlTree(['/login']);
  if (auth.user()) return true;
  return auth.loadMe().pipe(map((user) => (user ? true : router.createUrlTree(['/login']))));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return auth.authenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};

export const roleGuard =
  (...roles: AuthRole[]): CanActivateFn =>
  () => {
    const auth = inject(AuthService);
    const user = auth.user();
    return user && roles.includes(user.role)
      ? true
      : inject(Router).createUrlTree(['/unauthorized']);
  };
