// ===========================================
// Webhook Routes
// ===========================================

import { Router } from 'express';
import { prisma } from '../config/database.js';
import { messageService } from '../services/message.service.js';
import { brandService } from '../services/brand.service.js';
import { campaignService } from '../services/campaign.service.js';
import { ghlAdapter } from '../adapters/ghl.adapter.js';
import { signalmashService } from '../services/signalmash.service.js';
import { platformService } from '../services/platform.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

const router = Router();

/**
 * POST /webhooks/signalmash
 * Handle Signalmash webhooks (inbound messages, status updates, brand/campaign status)
 */
router.post(
  '/signalmash',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, data } = req.body;

    // Log webhook for debugging
    await prisma.webhookEvent.create({
      data: {
        platform: 'ghl', // Using GHL as placeholder since Signalmash isn't in enum
        eventType: type,
        payload: req.body,
        headers: req.headers as any,
      },
    });

    logger.info({ type }, 'Received Signalmash webhook');

    switch (type) {
      case 'message.inbound':
        await messageService.handleInbound({
          signalmashMessageId: data.message_id,
          from: data.from,
          to: data.to,
          body: data.body,
          mediaUrls: data.media_urls,
        });
        break;

      case 'message.status':
        await messageService.handleStatusUpdate(
          data.message_id,
          data.status,
          data.error_code,
          data.error_message
        );
        break;

      case 'brand.status':
        await brandService.handleVerificationResult(
          data.brand_id,
          data.status,
          data.verification_score,
          data.rejection_reason
        );
        break;

      case 'campaign.status':
        await campaignService.handleApprovalResult(
          data.campaign_id,
          data.status,
          data.rejection_reason,
          {
            dailyMessageLimit: data.daily_message_limit,
            messagesPerSecond: data.messages_per_second,
          }
        );
        break;

      default:
        logger.warn({ type }, 'Unknown Signalmash webhook type');
    }

    // Mark webhook as processed
    await prisma.webhookEvent.updateMany({
      where: {
        eventType: type,
        processed: false,
      },
      data: {
        processed: true,
        processedAt: new Date(),
      },
    });

    res.json({ success: true });
  })
);

/**
 * POST /webhooks/ghl
 * Handle GHL webhooks (outbound message requests from Conversation Provider)
 */
router.post(
  '/ghl',
  asyncHandler(async (req: Request, res: Response) => {
    const signature = req.headers['x-ghl-signature'] as string;
    const rawBody = JSON.stringify(req.body);

    // Verify signature
    if (!ghlAdapter.verifyWebhookSignature(rawBody, signature)) {
      logger.warn('Invalid GHL webhook signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const { type, locationId } = req.body;

    // Log webhook
    await prisma.webhookEvent.create({
      data: {
        platform: 'ghl',
        eventType: type,
        payload: req.body,
        headers: req.headers as any,
      },
    });

    logger.info({ type, locationId }, 'Received GHL webhook');

    // Find the platform connection
    const connection = await platformService.getByPlatformAccount('ghl', locationId);

    if (!connection) {
      logger.warn({ locationId }, 'GHL webhook for unknown location');
      return res.status(404).json({ error: 'Location not found' });
    }

    switch (type) {
      case 'OutboundMessage':
        // GHL is requesting us to send an SMS
        const outboundData = ghlAdapter.parseOutboundWebhook(req.body);
        if (outboundData) {
          try {
            // Get contact phone number from GHL
            const contact = await ghlAdapter.getContactByPhone(
              connection,
              req.body.contactPhone
            );

            if (!contact) {
              throw new Error('Contact not found');
            }

            // Send via Signalmash
            const message = await messageService.send({
              organizationId: connection.organizationId,
              platformConnectionId: connection.id,
              from: req.body.fromNumber,
              to: req.body.contactPhone,
              body: outboundData.message,
              mediaUrls: outboundData.attachments,
            });

            // Update message status in GHL
            await ghlAdapter.updateMessageStatus(
              connection,
              req.body.messageId,
              'sent'
            );

            res.json({
              success: true,
              messageId: message.id,
            });
          } catch (error) {
            logger.error({ error, locationId }, 'Failed to send GHL outbound message');

            // Update status as failed in GHL
            await ghlAdapter.updateMessageStatus(
              connection,
              req.body.messageId,
              'failed'
            );

            res.status(500).json({
              success: false,
              error: 'Failed to send message',
            });
          }
        }
        break;

      default:
        logger.info({ type }, 'Unhandled GHL webhook type');
        res.json({ success: true });
    }
  })
);

/**
 * POST /webhooks/ghl/inbound
 * Handle inbound messages from Signalmash to forward to GHL
 * This is called by our internal message handler
 */
router.post(
  '/ghl/inbound',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, from, to, body, mediaUrls } = req.body;

    // Find GHL connection for this organization
    const connections = await platformService.getByOrganization(organizationId, 'ghl');

    if (connections.length === 0) {
      logger.warn({ organizationId }, 'No GHL connection for inbound message');
      return res.status(404).json({ error: 'No GHL connection' });
    }

    const connection = connections[0]!;

    try {
      // Find or create contact in GHL
      let contact = await ghlAdapter.getContactByPhone(connection, from);

      if (!contact) {
        const newContact = await ghlAdapter.createContact(connection, {
          phone: from,
        });
        contact = { id: newContact.id };
      }

      // Get or create conversation
      const conversationId = await ghlAdapter.getOrCreateConversation(
        connection,
        contact.id
      );

      // Add inbound message to GHL
      await ghlAdapter.addInboundMessage(connection, {
        conversationId,
        body,
        attachments: mediaUrls,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error({ error, organizationId, from }, 'Failed to forward inbound message to GHL');
      res.status(500).json({ error: 'Failed to forward message' });
    }
  })
);

export { router as webhookRoutes };
