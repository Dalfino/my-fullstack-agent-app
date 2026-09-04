import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Real-time notification gateway. Clients authenticate via the JWT passed
 * in the handshake auth payload; verified sockets join a per-user room so
 * events are delivered only to their owner.
 * Emits project status, AI report, comment and file events.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(private readonly jwt: JwtService) {}

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      client.disconnect();
      return;
    }
    try {
      const payload = this.jwt.verify<{ sub: string; email: string; role: string }>(token);
      client.data.user = { id: payload.sub, email: payload.email, role: payload.role };
      void client.join(`user:${payload.sub}`);
      this.logger.log(`Client ${client.id} authenticated as ${payload.email}`);
    } catch {
      this.logger.warn(`Client ${client.id} provided an invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  /** Deliver an event to every socket of one specific user. */
  emitToUser(userId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitProjectEvent(projectId: string, event: string, payload: unknown) {
    if (!this.server) return;
    this.server.emit(`project:${projectId}`, { event, payload });
  }

  emitGlobal(event: string, payload: unknown) {
    if (!this.server) return;
    this.server.emit(event, payload);
  }
}
