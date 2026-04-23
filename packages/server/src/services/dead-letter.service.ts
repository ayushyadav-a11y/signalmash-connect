// ===========================================
// Dead Letter Service
// ===========================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import { enqueueGhlOutboundMessage } from '../queues/outbound-message.queue.js';
import { enqueueIncomingInboundEvent, enqueueIncomingStatusEvent } from '../queues/incoming-events.queue.js';

export class DeadLetterService {
  async record(input: {
    queueName: string;
    jobName: string;
    jobKey: string;
    payload: Record<string, unknown>;
    error: string;
    organizationId?: string;
    metadata?: Record<string, unknown>;
  }) {
    return prisma.deadLetterJob.upsert({
      where: {
        queueName_jobKey: {
          queueName: input.queueName,
          jobKey: input.jobKey,
        },
      },
      create: {
        queueName: input.queueName,
        jobName: input.jobName,
        jobKey: input.jobKey,
        payload: input.payload as Prisma.InputJsonValue,
        error: input.error,
        organizationId: input.organizationId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      update: {
        error: input.error,
        status: 'pending',
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }

  async list(organizationId: string) {
    return prisma.deadLetterJob.findMany({
      where: {
        OR: [
          { organizationId },
          { organizationId: null },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async replay(organizationId: string, deadLetterId: string) {
    const deadLetter = await prisma.deadLetterJob.findFirst({
      where: {
        id: deadLetterId,
        OR: [
          { organizationId },
          { organizationId: null },
        ],
      },
    });

    if (!deadLetter) {
      throw new NotFoundError('Dead letter job not found');
    }

    const payload = deadLetter.payload as Record<string, unknown>;

    if (deadLetter.queueName === 'outbound-platform-messages') {
      await enqueueGhlOutboundMessage(payload as unknown as Parameters<typeof enqueueGhlOutboundMessage>[0]);
    } else if (deadLetter.queueName === 'incoming-platform-events') {
      if (payload['kind'] === 'signalmash-inbound') {
        await enqueueIncomingInboundEvent({
          signalmashMessageId: String(payload['signalmashMessageId']),
          from: String(payload['from']),
          to: String(payload['to']),
          body: String(payload['body']),
          mediaUrls: Array.isArray(payload['mediaUrls']) ? payload['mediaUrls'] as string[] : undefined,
        });
      } else {
        await enqueueIncomingStatusEvent({
          signalmashMessageId: String(payload['signalmashMessageId']),
          status: payload['status'] as Parameters<typeof enqueueIncomingStatusEvent>[0]['status'],
          errorCode: payload['errorCode'] ? String(payload['errorCode']) : undefined,
          errorMessage: payload['errorMessage'] ? String(payload['errorMessage']) : undefined,
        });
      }
    }

    return prisma.deadLetterJob.update({
      where: { id: deadLetter.id },
      data: {
        status: 'replayed',
        replayedAt: new Date(),
      },
    });
  }
}

export const deadLetterService = new DeadLetterService();
