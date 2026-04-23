// ===========================================
// Port Order Routes
// ===========================================

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validate, idParamSchema } from '../middleware/validation.js';
import { portOrderService } from '../services/port-order.service.js';

const router: RouterType = Router();

const createPortOrderSchema = z.object({
  phoneNumberId: z.string().uuid().optional(),
  losingCarrier: z.string().max(100).optional(),
  requestedFocAt: z.coerce.date().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const updatePortOrderSchema = z.object({
  status: z.enum(['draft', 'submitted', 'awaiting_documents', 'in_progress', 'completed', 'rejected', 'cancelled']).optional(),
  rejectionReason: z.string().optional(),
  requestedFocAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const portOrders = await portOrderService.list(req.user!.organizationId);
    res.json({ success: true, data: portOrders });
  })
);

router.post(
  '/',
  validate({ body: createPortOrderSchema }),
  asyncHandler(async (req, res) => {
    const portOrder = await portOrderService.create({
      organizationId: req.user!.organizationId,
      ...req.body,
    });
    res.status(201).json({ success: true, data: portOrder });
  })
);

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updatePortOrderSchema }),
  asyncHandler(async (req, res) => {
    const portOrder = await portOrderService.update(
      req.user!.organizationId,
      req.params.id,
      req.body
    );
    res.json({ success: true, data: portOrder });
  })
);

export { router as portOrderRoutes };
