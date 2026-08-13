import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from './models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private readonly http: HttpClient) {}

  get<T>(path: string, query?: Record<string, string>): Observable<T> {
    return this.http
      .get<ApiEnvelope<T>>(`${environment.apiBaseUrl}/${path}`, {
        params: new HttpParams({ fromObject: query ?? {} }),
      })
      .pipe(map((response) => response.data));
  }

  post<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .post<ApiEnvelope<T>>(`${environment.apiBaseUrl}/${path}`, body)
      .pipe(map((response) => response.data));
  }

  patch<T>(path: string, body: unknown): Observable<T> {
    return this.http
      .patch<ApiEnvelope<T>>(`${environment.apiBaseUrl}/${path}`, body)
      .pipe(map((response) => response.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http
      .delete<ApiEnvelope<T>>(`${environment.apiBaseUrl}/${path}`)
      .pipe(map((response) => response.data));
  }
}
