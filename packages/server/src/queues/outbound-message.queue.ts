// ===========================================
// Outbound Message Queue
// ===========================================

import { Queue, Worker } from 'bullmq';
import type { JobsOptions } from 'bullmq';
import { createRedisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { platformService } from '../services/platform.service.js';
import { messageService } from '../services/message.service.js';
import { senderRoutingService } from '../services/sender-routing.service.js';
import { platformAdapterRegistry } from '../services/platform-adapter-registry.service.js';
import { toPlatformAdapterConnection } from '../adapters/base.adapter.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { deadLetterService } from '../services/dead-letter.service.js';

const OUTBOUND_QUEUE_NAME = 'outbound-platform-messages';

export interface GhlOutboundJobData {
  connectionId: string;
  providerMessageId: string;
  conversationId?: string;
  contactId?: string;
  to?: string;
  from?: string;
  body: string;
  mediaUrls?: string[];
}

const defaultJobOptions: JobsOptions = {
  attempts: 5,
  removeOnComplete: 100,
  removeOnFail: 1000,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

export const outboundMessageQueue = new Queue<GhlOutboundJobData>(OUTBOUND_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions,
});

let outboundMessageWorker: Worker<GhlOutboundJobData> | null = null;

export async function enqueueGhlOutboundMessage(data: GhlOutboundJobData) {
  const jobId = `ghl:${data.connectionId}:${data.providerMessageId}`;

  return outboundMessageQueue.add('ghl-outbound', data, {
    jobId,
  });
}

function isTerminalOutboundError(error: unknown): boolean {
  if (error instanceof BadRequestError || error instanceof NotFoundError) {
    return true;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  return (
    normalizedMessage.includes('opted out') ||
    normalizedMessage.includes('missing sender') ||
    normalizedMessage.includes('destination number') ||
    normalizedMessage.includes('not configured')
  );
}

export function startOutboundMessageWorker() {
  if (outboundMessageWorker) {
    return outboundMessageWorker;
  }

  outboundMessageWorker = new Worker<GhlOutboundJobData>(
    OUTBOUND_QUEUE_NAME,
    async (job) => {
      const data = job.data;
      const connection = await platformService.getByIdUnsafe(data.connectionId).catch(async () => null);

      if (!connection) {
        throw new Error(`Platform connection not found for job ${job.id}`);
      }

      const existingMessage = await messageService.getByPlatformMessageId(
        connection.organizationId,
        connection.id,
        data.providerMessageId
      );

      if (existingMessage?.signalmashMessageId || existingMessage?.status === 'sent' || existingMessage?.status === 'delivered') {
        logger.info({ jobId: job.id, messageId: existingMessage.id }, 'Skipping duplicate outbound send');
        return existingMessage;
      }

      const resolvedFrom = data.from || await senderRoutingService.resolveDefaultSenderForConnection(connection.id);
      const resolvedTo = data.to;

      if (!resolvedTo) {
        throw new Error('Outbound webhook payload did not include a destination number');
      }

      const queuedMessage =
        existingMessage ??
        await messageService.createQueuedPlatformMessage({
          organizationId: connection.organizationId,
          platformConnectionId: connection.id,
          platformMessageId: data.providerMessageId,
          platformConversationId: data.conversationId,
          from: resolvedFrom,
          to: resolvedTo,
          body: data.body,
          mediaUrls: data.mediaUrls,
        });

      const sentMessage = await messageService.dispatchQueuedMessage(queuedMessage.id);

      await platformAdapterRegistry.get('leadconnector').updateMessageStatus?.(
        toPlatformAdapterConnection(connection),
        data.providerMessageId,
        'sent'
      );

      return sentMessage;
    },
    {
      connection: createRedisConnection(),
      concurrency: 5,
    }
  );

  outboundMessageWorker.on('completed', (job) => {
    logger.info({ jobId: job.id }, 'Outbound message job completed');
  });

  outboundMessageWorker.on('failed', async (job, error) => {
    logger.error({ jobId: job?.id, error }, 'Outbound message job failed');

    const data = job?.data;
    if (!data) {
      return;
    }

    try {
      const connection = await platformService.getByIdUnsafe(data.connectionId);
      const existingMessage = await messageService.getByPlatformMessageId(
        connection.organizationId,
        connection.id,
        data.providerMessageId
      );

       await deadLetterService.record({
        queueName: OUTBOUND_QUEUE_NAME,
        jobName: job?.name ?? 'ghl-outbound',
        jobKey: String(job?.id ?? data.providerMessageId),
        payload: data as unknown as Record<string, unknown>,
        error: error instanceof Error ? error.message : 'Outbound queue failure',
        organizationId: connection.organizationId,
        metadata: {
          platformConnectionId: connection.id,
        },
      });

      if (existingMessage && isTerminalOutboundError(error)) {
        await messageService.markFailed(existingMessage.id, error instanceof Error ? error.message : 'Outbound send failed');
      }

      await platformAdapterRegistry.get('leadconnector').updateMessageStatus?.(
        toPlatformAdapterConnection(connection),
        data.providerMessageId,
        'failed'
      );
    } catch (statusError) {
      logger.error({ error: statusError, jobId: job?.id }, 'Failed to push failed status back to GHL');
    }
  });

  return outboundMessageWorker;
}

export async function stopOutboundMessageWorker() {
  if (!outboundMessageWorker) {
    return;
  }

  await outboundMessageWorker.close();
  outboundMessageWorker = null;
}
