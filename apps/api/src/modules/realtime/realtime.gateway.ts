import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthPrincipal } from '../../common/auth';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(','),
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(private readonly jwt: JwtService) {}
  async handleConnection(client: Socket) {
    try {
      const raw = String(client.handshake.auth.token ?? '').replace(
        /^Bearer /,
        '',
      );
      const user = await this.jwt.verifyAsync<AuthPrincipal>(raw, {
        secret: process.env.JWT_ACCESS_SECRET,
      });
      (client.data as Record<string, unknown>).user = user;
      await client.join(
        user.kind === 'admin' ? 'admins' : `citizen:${user.sub}`,
      );
    } catch {
      client.disconnect(true);
    }
  }
  emitAdmins(event: string, payload: unknown) {
    this.server?.to('admins').emit(event, payload);
  }
  emitCitizen(id: string, event: string, payload: unknown) {
    this.server?.to(`citizen:${id}`).emit(event, payload);
  }
}
