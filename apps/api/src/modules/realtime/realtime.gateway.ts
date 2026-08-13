import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import type { AuthPrincipal } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';

@WebSocketGateway({
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:4200').split(','),
  },
})
export class RealtimeGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}
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
      if (user.kind === 'admin') {
        await client.join(['admin:all', `admin:${user.sub}`]);
      } else {
        await client.join(`citizen:${user.sub}`);
      }
    } catch {
      client.disconnect(true);
    }
  }
  @SubscribeMessage('incident.subscribe')
  async subscribeIncident(
    @ConnectedSocket() client: Socket,
    @MessageBody() incidentId: string,
  ) {
    const user = (client.data as { user?: AuthPrincipal }).user;
    if (!user || typeof incidentId !== 'string') return { joined: false };
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      select: { citizenUserId: true, assignedAdminUserId: true },
    });
    const allowed =
      incident &&
      (user.kind === 'citizen'
        ? incident.citizenUserId === user.sub
        : user.role !== 'OFFICER' || incident.assignedAdminUserId === user.sub);
    if (!allowed) return { joined: false };
    await client.join(`incident:${incidentId}`);
    return { joined: true };
  }
  emitAdmins(event: string, payload: unknown) {
    this.server?.to('admin:all').emit(event, payload);
  }
  emitAdmin(id: string, event: string, payload: unknown) {
    this.server?.to(`admin:${id}`).emit(event, payload);
  }
  emitCitizen(id: string, event: string, payload: unknown) {
    this.server?.to(`citizen:${id}`).emit(event, payload);
  }
  emitIncident(id: string, event: string, payload: unknown) {
    this.server?.to(`incident:${id}`).emit(event, payload);
  }
}
