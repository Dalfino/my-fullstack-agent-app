import { Injectable } from '@nestjs/common';
import { NotificationsGateway } from './notifications.gateway';

/**
 * Thin facade over the socket gateway. Business services depend on this
 * instead of the raw gateway so events can later be persisted / batched
 * without touching call sites.
 */
@Injectable()
export class NotificationsService {
  constructor(private readonly gateway: NotificationsGateway) {}

  notifyUser(userId: string, event: string, payload: Record<string, unknown>): void {
    this.gateway.emitToUser(userId, event, payload);
  }

  notifyProject(projectId: string, event: string, payload: Record<string, unknown>): void {
    this.gateway.emitProjectEvent(projectId, event, payload);
  }
}
