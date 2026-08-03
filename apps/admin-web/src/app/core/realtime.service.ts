import { Injectable, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class RealtimeService {
  readonly connected = signal(false);
  private socket?: Socket;

  constructor(private readonly auth: AuthService) {}

  connect() {
    const token = this.auth.accessToken();
    if (!token || this.socket?.connected) return;
    this.socket = io(environment.socketUrl, {
      transports: ['websocket'],
      auth: { token },
    });
    this.socket.on('connect', () => this.connected.set(true));
    this.socket.on('disconnect', () => this.connected.set(false));
  }

  on(event: string, listener: () => void) {
    this.connect();
    this.socket?.on(event, listener);
    return () => this.socket?.off(event, listener);
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = undefined;
    this.connected.set(false);
  }
}
