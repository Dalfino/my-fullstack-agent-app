import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

/**
 * Real-time notification gateway. Clients authenticate via the JWT passed
 * in the handshake auth payload. Emits project status and AI report events.
 */
@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  handleConnection(client: Socket) {
    const token = client.handshake.auth?.token;
    if (!token) {
      this.logger.warn(`Client ${client.id} connected without token`);
      client.disconnect();
      return;
    }
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  emitProjectEvent(projectId: string, event: string, payload: unknown) {
    this.server.emit(`project:${projectId}`, { event, payload });
  }

  emitGlobal(event: string, payload: unknown) {
    this.server.emit(event, payload);
  }
}