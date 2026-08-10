import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FirebaseApp, FirebaseOptions, getApps, initializeApp } from 'firebase/app';
import { Auth, getAuth, signInWithCustomToken, signOut } from 'firebase/auth';
import { Database, getDatabase, onValue, ref } from 'firebase/database';
import { environment } from '../../environments/environment';
import { ApiEnvelope } from './models';
import { AuthService } from './auth.service';

interface RealtimeToken {
  customToken: string;
  expiresIn: number;
}

interface RealtimeEvent {
  eventId: string;
  type: string;
}

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  readonly connected = signal(false);
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly unsubscribeDatabase: Array<() => void> = [];
  private app?: FirebaseApp;
  private firebaseAuth?: Auth;
  private database?: Database;
  private connecting?: Promise<void>;
  private lastEventIds = new Set<string>();

  constructor(
    private readonly auth: AuthService,
    private readonly http: HttpClient,
  ) {
    window.addEventListener('focus', () => {
      if (this.auth.authenticated()) {
        this.notifyAll();
        this.connect();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.auth.authenticated()) {
        this.notifyAll();
        this.connect();
      }
    });
  }

  connect() {
    if (!environment.firebase.enabled || !this.auth.accessToken() || this.connected()) return;
    this.connecting ??= this.connectFirebase()
      .catch(() => this.connected.set(false))
      .finally(() => (this.connecting = undefined));
  }

  on(event: string, listener: () => void) {
    const callbacks = this.listeners.get(event) ?? new Set<() => void>();
    callbacks.add(listener);
    this.listeners.set(event, callbacks);
    this.connect();
    return () => {
      callbacks.delete(listener);
      if (!callbacks.size) this.listeners.delete(event);
    };
  }

  disconnect() {
    this.unsubscribeDatabase.splice(0).forEach((unsubscribe) => unsubscribe());
    this.lastEventIds.clear();
    this.connected.set(false);
    if (this.firebaseAuth) void signOut(this.firebaseAuth);
  }

  private async connectFirebase() {
    const options: FirebaseOptions = {
      apiKey: environment.firebase.apiKey,
      authDomain: environment.firebase.authDomain,
      databaseURL: environment.firebase.databaseURL,
      projectId: environment.firebase.projectId,
      appId: environment.firebase.appId,
      messagingSenderId: environment.firebase.messagingSenderId,
    };
    this.app ??= getApps().find((app) => app.name === 'police-backoffice') ??
      initializeApp(options, 'police-backoffice');
    this.firebaseAuth ??= getAuth(this.app);
    this.database ??= getDatabase(this.app);
    const response = await firstValueFrom(
      this.http.post<ApiEnvelope<RealtimeToken>>(`${environment.apiBaseUrl}/realtime/token`, {}),
    );
    const credential = await signInWithCustomToken(this.firebaseAuth, response.data.customToken);
    this.unsubscribeDatabase.splice(0).forEach((unsubscribe) => unsubscribe());
    this.watch('.info/connected', (value) => this.connected.set(value === true));
    this.watch('channels/admin', (value) => this.dispatch(value));
    this.watch(`channels/users/${credential.user.uid}`, (value) => this.dispatch(value));
  }

  private watch(path: string, listener: (value: unknown) => void) {
    if (!this.database) return;
    this.unsubscribeDatabase.push(onValue(ref(this.database, path), (snapshot) => listener(snapshot.val())));
  }

  private dispatch(value: unknown) {
    if (!this.isRealtimeEvent(value) || this.lastEventIds.has(value.eventId)) return;
    this.lastEventIds.add(value.eventId);
    if (this.lastEventIds.size > 100) this.lastEventIds = new Set([value.eventId]);
    this.listeners.get(value.type)?.forEach((listener) => listener());
  }

  private notifyAll() {
    const callbacks = new Set<() => void>();
    this.listeners.forEach((listeners) => listeners.forEach((listener) => callbacks.add(listener)));
    callbacks.forEach((listener) => listener());
  }

  private isRealtimeEvent(value: unknown): value is RealtimeEvent {
    return (
      typeof value === 'object' &&
      value !== null &&
      'eventId' in value &&
      typeof value.eventId === 'string' &&
      'type' in value &&
      typeof value.type === 'string'
    );
  }
}
