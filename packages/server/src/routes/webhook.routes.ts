// ===========================================
// Webhook Routes
// ===========================================

import { Router } from 'express';
import type { Router as RouterType, Request, Response } from 'express';
import { prisma } from '../config/database.js';
import { messageService } from '../services/message.service.js';
import { brandService } from '../services/brand.service.js';
import { campaignService } from '../services/campaign.service.js';
import { platformService } from '../services/platform.service.js';
import { platformAdapterRegistry } from '../services/platform-adapter-registry.service.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logger } from '../utils/logger.js';
import type { GHLAdapter } from '../adapters/ghl.adapter.js';
import { enqueueGhlOutboundMessage } from '../queues/outbound-message.queue.js';
import { enqueueIncomingInboundEvent, enqueueIncomingStatusEvent } from '../queues/incoming-events.queue.js';

const router: RouterType = Router();
const leadconnectorAdapter = platformAdapterRegistry.get('leadconnector') as GHLAdapter;

async function handleLeadconnectorOutboundWebhook(req: Request, res: Response, options?: { requireSignature?: boolean }) {
  const rawBody = req.rawBody ?? JSON.stringify(req.body);
  const signatures = {
    xGhlSignature: req.headers['x-ghl-signature'] as string | undefined,
    xWhSignature: req.headers['x-wh-signature'] as string | undefined,
  };
  const requireSignature = options?.requireSignature ?? true;

  if (requireSignature && !leadconnectorAdapter.verifyWebhookSignature?.(rawBody, signatures)) {
    logger.warn('Invalid GHL webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (
    !requireSignature &&
    (signatures.xGhlSignature || signatures.xWhSignature) &&
    !leadconnectorAdapter.verifyWebhookSignature?.(rawBody, signatures)
  ) {
    logger.warn('Invalid optional GHL webhook signature');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  const parsed = leadconnectorAdapter.parseOutboundWebhook?.(req.body);
  if (!parsed) {
    logger.warn({ payload: req.body }, 'Unable to parse GHL outbound webhook');
    return res.status(202).json({ success: false, message: 'Unsupported webhook payload' });
  }

  const connection = await platformService.getByPlatformAccount('leadconnector', parsed.accountId);
  if (!connection) {
    logger.warn({ accountId: parsed.accountId }, 'GHL webhook for unknown location');
    return res.status(200).json({ success: true, warning: 'Location not configured' });
  }

  await enqueueGhlOutboundMessage({
    connectionId: connection.id,
    providerMessageId: parsed.providerMessageId,
    conversationId: parsed.conversationId,
    contactId: parsed.contactId,
    to: (req.body.contactPhone as string | undefined) || parsed.to,
    from: parsed.from,
    body: parsed.body,
    mediaUrls: parsed.mediaUrls,
  });

  res.status(200).json({
    success: true,
    queued: true,
    providerMessageId: parsed.providerMessageId,
  });
}

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
        platform: 'leadconnector', // Using GHL as placeholder since Signalmash isn't in enum
        eventType: type,
        payload: req.body,
        headers: req.headers as any,
      },
    });

    logger.info({ type }, 'Received Signalmash webhook');

    switch (type) {
      case 'message.inbound':
        await enqueueIncomingInboundEvent({
          signalmashMessageId: data.message_id,
          from: data.from,
          to: data.to,
          body: data.body,
          mediaUrls: data.media_urls,
        });
        break;

      case 'message.status':
        await enqueueIncomingStatusEvent({
          signalmashMessageId: data.message_id,
          status: data.status,
          errorCode: data.error_code,
          errorMessage: data.error_message,
        });
        break;

      case 'brand.status':
        await brandService.handleVerificationResult(
          data.brand_id,
          data.status,
          data.verification_score,
          data.rejection_reason,
          data.tcr_brand_id
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
          },
          data.tcr_campaign_id
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
 * GET /webhooks/leadconnector
 * Webhook URL validation endpoint for GHL Marketplace
 */
router.get('/leadconnector', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'Webhook endpoint is active' });
});

/**
 * GET /webhooks/crm
 * Webhook URL validation endpoint for GHL Marketplace (alternative path)
 */
router.get('/crm', (req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

/**
 * GET /webhooks/incoming
 * Generic webhook validation endpoint
 */
router.get('/incoming', (req: Request, res: Response) => {
  res.status(200).json({ success: true });
});

/**
 * POST /webhooks/incoming
 * Generic webhook handler for GHL
 */
router.post('/incoming', (req: Request, res: Response) => {
  // Always return success for validation and test requests
  res.status(200).json({ success: true });
});

/**
 * POST /webhooks/crm
 * Handle GHL webhooks (outbound message requests from Conversation Provider)
 * Alternative path that avoids GHL-related naming
 */
router.post(
  '/crm',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, locationId } = req.body || {};

    // Handle empty/test requests (for GHL webhook URL validation)
    if (!type && !locationId) {
      logger.info('Received webhook validation/test request');
      return res.status(200).json({ success: true });
    }

    // Log webhook
    await prisma.webhookEvent.create({
      data: {
        platform: 'leadconnector',
        eventType: type || 'unknown',
        payload: req.body,
        headers: req.headers as any,
      },
    });

    logger.info({ type, locationId }, 'Received GHL webhook');

    // Find the platform connection
    if (!locationId) {
      return res.status(200).json({ success: true });
    }

    const connection = await platformService.getByPlatformAccount('leadconnector', locationId);

    if (!connection) {
      logger.warn({ locationId }, 'GHL webhook for unknown location');
      return res.status(200).json({ success: true, warning: 'Location not configured' });
    }

    switch (type) {
      case 'OutboundMessage':
        return handleLeadconnectorOutboundWebhook(req, res, { requireSignature: false });

      default:
        logger.info({ type }, 'Unhandled GHL webhook type');
        res.json({ success: true });
    }
  })
);

/**
 * POST /webhooks/leadconnector
 * Handle GHL webhooks (outbound message requests from Conversation Provider)
 */
router.post(
  '/leadconnector',
  asyncHandler(async (req: Request, res: Response) => {
    const { type, locationId } = req.body;

    // Log webhook
    await prisma.webhookEvent.create({
      data: {
        platform: 'leadconnector',
        eventType: type,
        payload: req.body,
        headers: req.headers as any,
      },
    });

    logger.info({ type, locationId }, 'Received GHL webhook');

    // Find the platform connection
    const connection = await platformService.getByPlatformAccount('leadconnector', locationId);

    if (!connection) {
      logger.warn({ locationId }, 'GHL webhook for unknown location');
      return res.status(404).json({ error: 'Location not found' });
    }

    switch (type) {
      case 'OutboundMessage':
        return handleLeadconnectorOutboundWebhook(req, res, { requireSignature: true });

      default:
        logger.info({ type }, 'Unhandled GHL webhook type');
        res.json({ success: true });
    }
  })
);

/**
 * POST /webhooks/leadconnector/inbound
 * Handle inbound messages from Signalmash to forward to GHL
 * This is called by our internal message handler
 */
router.post(
  '/leadconnector/inbound',
  asyncHandler(async (req: Request, res: Response) => {
    const { organizationId, from, to, body, mediaUrls } = req.body;

    // Find GHL connection for this organization
    const connections = await platformService.getByOrganization(organizationId, 'leadconnector');

    if (connections.length === 0) {
      logger.warn({ organizationId }, 'No GHL connection for inbound message');
      return res.status(404).json({ error: 'No GHL connection' });
    }

    const connection = connections[0]!;

    try {
      // Find or create contact in GHL
      let contact = await leadconnectorAdapter.getContactByPhone?.(connection, from);

      if (!contact) {
        const newContact = await leadconnectorAdapter.createContact?.(connection, {
          phone: from,
        });
        if (!newContact) {
          throw new Error('Failed to create contact');
        }
        contact = { id: newContact.id };
      }

      // Get or create conversation
      const conversationId = await leadconnectorAdapter.getOrCreateConversation?.(
        connection,
        contact.id
      );

      if (!conversationId) {
        throw new Error('Failed to resolve conversation');
      }

      // Add inbound message to GHL
      await leadconnectorAdapter.addInboundMessage?.(connection, {
        externalMessageId: req.body.messageId ?? `${organizationId}:${Date.now()}`,
        body,
        from,
        to,
        mediaUrls,
        occurredAt: new Date(),
        contactId: contact.id,
        conversationId,
      });

      res.json({ success: true });
    } catch (error) {
      logger.error({ error, organizationId, from }, 'Failed to forward inbound message to GHL');
      res.status(500).json({ error: 'Failed to forward message' });
    }
  })
);

export { router as webhookRoutes };
