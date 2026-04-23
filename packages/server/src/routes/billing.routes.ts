// ===========================================
// Billing Routes
// ===========================================

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { billingService } from '../services/billing.service.js';
import { validate, idParamSchema } from '../middleware/validation.js';

const router: RouterType = Router();

const processBillingSchema = z.object({
  limit: z.coerce.number().int().positive().max(500).default(100),
});

const updateBillingStatusSchema = z.object({
  status: z.enum(['posted', 'failed', 'ignored']),
  reason: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await billingService.getSummary(req.user!.organizationId);
    res.json({ success: true, data: summary });
  })
);

router.get(
  '/events',
  asyncHandler(async (req, res) => {
    const events = await billingService.listEvents(req.user!.organizationId);
    res.json({ success: true, data: events });
  })
);

router.post(
  '/process',
  validate({ body: processBillingSchema }),
  asyncHandler(async (req, res) => {
    const result = await billingService.processPendingEvents(
      req.user!.organizationId,
      req.body
    );
    res.json({ success: true, data: result });
  })
);

router.patch(
  '/events/:id/status',
  validate({ params: idParamSchema, body: updateBillingStatusSchema }),
  asyncHandler(async (req, res) => {
    const event = await billingService.updateEventStatus(
      req.user!.organizationId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: event });
  })
);

export { router as billingRoutes };
