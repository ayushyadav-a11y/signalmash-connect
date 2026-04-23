// ===========================================
// Incoming Events Queue
// ===========================================

import { Queue, Worker } from 'bullmq';
import type { JobsOptions } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { messageService } from '../services/message.service.js';
import { platformService } from '../services/platform.service.js';
import { platformAdapterRegistry } from '../services/platform-adapter-registry.service.js';
import { complianceService } from '../services/compliance.service.js';
import { toPlatformAdapterConnection } from '../adapters/base.adapter.js';
import { deadLetterService } from '../services/dead-letter.service.js';

const INCOMING_QUEUE_NAME = 'incoming-platform-events';

type IncomingInboundJobData = {
  kind: 'signalmash-inbound';
  signalmashMessageId: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
};

type IncomingStatusJobData = {
  kind: 'signalmash-status';
  signalmashMessageId: string;
  status: 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
};

type IncomingEventJobData = IncomingInboundJobData | IncomingStatusJobData;

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  removeOnComplete: 100,
  removeOnFail: 1000,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

export const incomingEventsQueue = new Queue<IncomingEventJobData>(INCOMING_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

let incomingEventsWorker: Worker<IncomingEventJobData> | null = null;

export async function enqueueIncomingInboundEvent(data: Omit<IncomingInboundJobData, 'kind'>) {
  return incomingEventsQueue.add(
    'signalmash-inbound',
    { kind: 'signalmash-inbound', ...data },
    { jobId: `sm-inbound:${data.signalmashMessageId}` }
  );
}

export async function enqueueIncomingStatusEvent(data: Omit<IncomingStatusJobData, 'kind'>) {
  return incomingEventsQueue.add(
    'signalmash-status',
    { kind: 'signalmash-status', ...data },
    { jobId: `sm-status:${data.signalmashMessageId}:${data.status}` }
  );
}

export function startIncomingEventsWorker() {
  if (incomingEventsWorker) {
    return incomingEventsWorker;
  }

  incomingEventsWorker = new Worker<IncomingEventJobData>(
    INCOMING_QUEUE_NAME,
    async (job) => {
      if (job.data.kind === 'signalmash-inbound') {
        const message = await messageService.handleInbound({
          signalmashMessageId: job.data.signalmashMessageId,
          from: job.data.from,
          to: job.data.to,
          body: job.data.body,
          mediaUrls: job.data.mediaUrls,
        });

        const complianceEvent = await complianceService.handleInboundKeyword({
          organizationId: message.organizationId,
          from: job.data.from,
          body: job.data.body,
        });

        const connections = await platformService.getByOrganization(
          message.organizationId,
          'leadconnector'
        );

        const connection = connections[0];
        if (!connection) {
          logger.warn({ organizationId: message.organizationId }, 'No GHL connection for inbound message');
          return message;
        }

        let contact = await platformAdapterRegistry.get('leadconnector').getContactByPhone?.(
          toPlatformAdapterConnection(connection),
          job.data.from
        );

        if (!contact) {
          const createdContact = await platformAdapterRegistry.get('leadconnector').createContact?.(
            toPlatformAdapterConnection(connection),
            { phone: job.data.from }
          );

          if (!createdContact) {
            throw new Error('Failed to create contact for inbound message');
          }

          contact = { id: createdContact.id };
        }

        const conversationId = await platformAdapterRegistry.get('leadconnector').getOrCreateConversation?.(
          toPlatformAdapterConnection(connection),
          contact.id
        );

        if (!conversationId) {
          throw new Error('Failed to resolve conversation for inbound message');
        }

        if (complianceEvent && contact.id) {
          try {
            await platformAdapterRegistry.get('leadconnector').updateContactPreferences?.(
              toPlatformAdapterConnection(connection),
              contact.id,
              {
                dnd: complianceEvent.action === 'opt_out',
              }
            );
          } catch (error) {
            logger.warn({ error, contactId: contact.id }, 'Failed to sync contact DND state to GHL');
          }
        }

        await platformAdapterRegistry.get('leadconnector').addInboundMessage?.(
          toPlatformAdapterConnection(connection),
          {
            externalMessageId: job.data.signalmashMessageId,
            from: job.data.from,
            to: job.data.to,
            body: job.data.body,
            mediaUrls: job.data.mediaUrls,
            occurredAt: new Date(),
            contactId: contact.id,
            conversationId,
          }
        );

        return message;
      }

      const updatedMessage = await messageService.handleStatusUpdate(
        job.data.signalmashMessageId,
        job.data.status,
        job.data.errorCode,
        job.data.errorMessage
      );

      if (!updatedMessage?.platformConnectionId || !updatedMessage.platformMessageId) {
        return updatedMessage;
      }

      const connection = await platformService.getByIdUnsafe(updatedMessage.platformConnectionId);
      await platformAdapterRegistry.get('leadconnector').updateMessageStatus?.(
        toPlatformAdapterConnection(connection),
        updatedMessage.platformMessageId,
        updatedMessage.status
      );

      return updatedMessage;
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  incomingEventsWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Incoming event job completed');
  });

  incomingEventsWorker.on('failed', (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Incoming event job failed');

    const data = job?.data;
    if (!data) {
      return;
    }

    void deadLetterService.record({
      queueName: INCOMING_QUEUE_NAME,
      jobName: job?.name ?? data.kind,
      jobKey: String(job?.id ?? `${data.kind}:${Date.now()}`),
      payload: data as unknown as Record<string, unknown>,
      error: error instanceof Error ? error.message : 'Incoming queue failure',
    });
  });

  return incomingEventsWorker;
}

export async function stopIncomingEventsWorker() {
  if (!incomingEventsWorker) {
    return;
  }

  await incomingEventsWorker.close();
  incomingEventsWorker = null;
}
