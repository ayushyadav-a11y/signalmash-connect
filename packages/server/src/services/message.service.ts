// ===========================================
// Message Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { formatPhoneE164 } from '@signalmash-connect/shared';
import type { Message, MessageStatus, MessageDirection, MessageType } from '@prisma/client';

interface SendMessageInput {
  organizationId: string;
  platformConnectionId?: string;
  campaignId?: string;
  phoneNumberId?: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
}

interface ListMessagesOptions {
  organizationId: string;
  platformConnectionId?: string;
  campaignId?: string;
  direction?: MessageDirection;
  status?: MessageStatus;
  from?: string;
  to?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class MessageService {
  /**
   * Send an outbound message
   */
  async send(input: SendMessageInput): Promise<Message> {
    const { organizationId, platformConnectionId, campaignId, phoneNumberId, from, to, body, mediaUrls } = input;

    // Validate campaign if provided
    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: campaignId,
          organizationId,
          status: 'approved',
        },
      });

      if (!campaign) {
        throw new BadRequestError('Campaign not found or not approved');
      }
    }

    // Format phone numbers
    const formattedFrom = formatPhoneE164(from);
    const formattedTo = formatPhoneE164(to);

    // Create message record (queued status)
    const message = await prisma.message.create({
      data: {
        organizationId,
        platformConnectionId,
        campaignId,
        phoneNumberId,
        direction: 'outbound',
        type: mediaUrls && mediaUrls.length > 0 ? 'mms' : 'sms',
        from: formattedFrom,
        to: formattedTo,
        body,
        mediaUrls,
        status: 'queued',
      },
    });

    try {
      // Update status to sending
      await prisma.message.update({
        where: { id: message.id },
        data: { status: 'sending' },
      });

      // Send via Signalmash
      const result = await signalmashService.sendMessage({
        from: formattedFrom,
        to: formattedTo,
        body,
        mediaUrls,
      });

      // Update with Signalmash message ID
      const updatedMessage = await prisma.message.update({
        where: { id: message.id },
        data: {
          signalmashMessageId: result.messageId,
          status: 'sent',
          sentAt: new Date(),
        },
      });

      logger.info(
        { messageId: message.id, signalmashMessageId: result.messageId },
        'Message sent successfully'
      );

      return updatedMessage;
    } catch (error) {
      // Update message as failed
      await prisma.message.update({
        where: { id: message.id },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      logger.error({ messageId: message.id, error }, 'Failed to send message');
      throw error;
    }
  }

  /**
   * Handle inbound message from Signalmash webhook
   */
  async handleInbound(data: {
    signalmashMessageId: string;
    from: string;
    to: string;
    body: string;
    mediaUrls?: string[];
  }): Promise<Message> {
    // Find the phone number to determine organization
    const phoneNumber = await prisma.phoneNumber.findFirst({
      where: {
        phoneNumber: formatPhoneE164(data.to),
        status: 'active',
      },
    });

    if (!phoneNumber) {
      logger.warn({ to: data.to }, 'Received message for unknown phone number');
      throw new NotFoundError('Phone number not found');
    }

    // Create inbound message record
    const message = await prisma.message.create({
      data: {
        organizationId: phoneNumber.organizationId,
        campaignId: phoneNumber.campaignId,
        phoneNumberId: phoneNumber.id,
        direction: 'inbound',
        type: data.mediaUrls && data.mediaUrls.length > 0 ? 'mms' : 'sms',
        from: formatPhoneE164(data.from),
        to: formatPhoneE164(data.to),
        body: data.body,
        mediaUrls: data.mediaUrls,
        signalmashMessageId: data.signalmashMessageId,
        status: 'received',
      },
    });

    logger.info(
      { messageId: message.id, from: data.from, to: data.to },
      'Inbound message received'
    );

    return message;
  }

  /**
   * Handle message status update from Signalmash webhook
   */
  async handleStatusUpdate(
    signalmashMessageId: string,
    status: 'sent' | 'delivered' | 'failed' | 'undelivered',
    errorCode?: string,
    errorMessage?: string
  ): Promise<Message | null> {
    const message = await prisma.message.findFirst({
      where: { signalmashMessageId },
    });

    if (!message) {
      logger.warn({ signalmashMessageId }, 'Received status update for unknown message');
      return null;
    }

    const updateData: Partial<Message> = { status };

    if (status === 'delivered') {
      updateData.deliveredAt = new Date();
    }

    if (errorCode) {
      updateData.errorCode = errorCode;
    }

    if (errorMessage) {
      updateData.errorMessage = errorMessage;
    }

    const updatedMessage = await prisma.message.update({
      where: { id: message.id },
      data: updateData as any,
    });

    logger.info(
      { messageId: message.id, status },
      'Message status updated'
    );

    return updatedMessage;
  }

  /**
   * Get message by ID
   */
  async getById(id: string, organizationId: string): Promise<Message> {
    const message = await prisma.message.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!message) {
      throw new NotFoundError('Message not found');
    }

    return message;
  }

  /**
   * List messages with filters
   */
  async list(options: ListMessagesOptions): Promise<{
    messages: Message[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      organizationId,
      platformConnectionId,
      campaignId,
      direction,
      status,
      from,
      to,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = options;

    const where: any = {
      organizationId,
      ...(platformConnectionId && { platformConnectionId }),
      ...(campaignId && { campaignId }),
      ...(direction && { direction }),
      ...(status && { status }),
      ...(from && { from: formatPhoneE164(from) }),
      ...(to && { to: formatPhoneE164(to) }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where }),
    ]);

    return {
      messages,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get message statistics
   */
  async getStats(
    organizationId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      campaignId?: string;
    }
  ): Promise<{
    total: number;
    sent: number;
    delivered: number;
    failed: number;
    received: number;
    deliveryRate: number;
  }> {
    const where: any = {
      organizationId,
      ...(options?.campaignId && { campaignId: options.campaignId }),
      ...(options?.startDate || options?.endDate
        ? {
            createdAt: {
              ...(options?.startDate && { gte: options.startDate }),
              ...(options?.endDate && { lte: options.endDate }),
            },
          }
        : {}),
    };

    const stats = await prisma.message.groupBy({
      by: ['status', 'direction'],
      where,
      _count: true,
    });

    let total = 0;
    let sent = 0;
    let delivered = 0;
    let failed = 0;
    let received = 0;

    for (const stat of stats) {
      total += stat._count;

      if (stat.direction === 'inbound') {
        received += stat._count;
      } else {
        if (stat.status === 'sent' || stat.status === 'delivered') {
          sent += stat._count;
        }
        if (stat.status === 'delivered') {
          delivered += stat._count;
        }
        if (stat.status === 'failed' || stat.status === 'undelivered') {
          failed += stat._count;
        }
      }
    }

    const deliveryRate = sent > 0 ? (delivered / sent) * 100 : 0;

    return {
      total,
      sent,
      delivered,
      failed,
      received,
      deliveryRate: Math.round(deliveryRate * 100) / 100,
    };
  }
}

export const messageService = new MessageService();
