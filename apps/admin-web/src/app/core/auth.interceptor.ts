import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const secured = token
    ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : request;
  return next(secured).pipe(
    catchError((error: HttpErrorResponse) => {
      const refreshEndpoint = request.url.endsWith('/admin/auth/refresh');
      if (error.status !== 401 || refreshEndpoint || request.url.endsWith('/login')) {
        return throwError(() => error);
      }
      return auth
        .refreshAccessToken()
        .pipe(
          switchMap((newToken) =>
            newToken
              ? next(request.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))
              : throwError(() => error),
          ),
        );
    }),
  );
};
