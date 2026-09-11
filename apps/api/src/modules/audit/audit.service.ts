import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash } from 'node:crypto';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog, JsonObject } from '../../database/entities/entities';

export interface AuditEvent {
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: JsonObject;
  requestId?: string | null;
  ip?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@InjectRepository(AuditLog) private readonly logs: Repository<AuditLog>) {}

  async record(event: AuditEvent, manager?: EntityManager): Promise<void> {
    const repo = manager?.getRepository(AuditLog) ?? this.logs;
    await repo.save(repo.create({
      userId: event.userId,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId ?? null,
      metadata: event.metadata ?? {},
      requestId: event.requestId ?? null,
      ipHash: event.ip ? createHash('sha256').update(event.ip).digest('hex') : null,
    }));
  }
}
