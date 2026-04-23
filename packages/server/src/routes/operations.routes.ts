// ===========================================
// Operations Routes
// ===========================================

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { operationsService } from '../services/operations.service.js';
import { deadLetterService } from '../services/dead-letter.service.js';
import { validate, idParamSchema } from '../middleware/validation.js';

const router: RouterType = Router();

router.use(authenticate);

router.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const summary = await operationsService.getSummary(req.user!.organizationId);
    res.json({ success: true, data: summary });
  })
);

router.get(
  '/dead-letters',
  asyncHandler(async (req, res) => {
    const jobs = await deadLetterService.list(req.user!.organizationId);
    res.json({ success: true, data: jobs });
  })
);

router.post(
  '/dead-letters/:id/replay',
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const replayed = await deadLetterService.replay(req.user!.organizationId, req.params.id);
    res.json({ success: true, data: replayed });
  })
);

export { router as operationsRoutes };
