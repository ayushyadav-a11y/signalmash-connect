// ===========================================
// Phone Number (DID) Routes
// ===========================================

import { Router } from 'express';
import type { Router as RouterType, Request, Response } from 'express';
import { z } from 'zod';
import { phoneNumberService } from '../services/phoneNumber.service.js';
import { validate, paginationSchema, idParamSchema } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router: RouterType = Router();

// All routes require authentication
router.use(authenticate);

// ===========================================
// Search Available Numbers
// ===========================================

const searchQuerySchema = z.object({
  areaCode: z.string().length(3).optional(),
  contains: z.string().max(10).optional(),
  state: z.string().length(2).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

router.get(
  '/available',
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { areaCode, contains, state, limit } = req.query as unknown as z.infer<typeof searchQuerySchema>;

    const numbers = await phoneNumberService.searchAvailableNumbers({
      areaCode,
      contains,
      state,
      limit,
    });

    res.json({
      success: true,
      data: numbers,
    });
  })
);

// ===========================================
// Get Phone Number Stats
// ===========================================

router.get(
  '/stats',
  asyncHandler(async (req: Request, res: Response) => {
    const stats = await phoneNumberService.getStats(req.user!.organizationId);

    res.json({
      success: true,
      data: stats,
    });
  })
);

// ===========================================
// Get Organization's Phone Numbers
// ===========================================

const listQuerySchema = z.object({
  status: z.enum(['active', 'pending', 'suspended', 'released']).optional(),
  campaignId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { status, campaignId, page, limit } = req.query as unknown as z.infer<typeof listQuerySchema>;

    const result = await phoneNumberService.getOrganizationNumbers(
      req.user!.organizationId,
      { status: status as any, campaignId, page, limit }
    );

    res.json({
      success: true,
      ...result,
    });
  })
);

// ===========================================
// Get Single Phone Number
// ===========================================

router.get(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const number = await phoneNumberService.getNumber(
      req.user!.organizationId,
      req.params.id
    );

    res.json({
      success: true,
      data: number,
    });
  })
);

// ===========================================
// Purchase Phone Number
// ===========================================

const purchaseBodySchema = z.object({
  phoneNumber: z.string().min(10).max(15),
  campaignId: z.string().uuid(),
  friendlyName: z.string().max(100).optional(),
});

router.post(
  '/purchase',
  validate({ body: purchaseBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { phoneNumber, campaignId, friendlyName } = req.body as z.infer<typeof purchaseBodySchema>;

    const number = await phoneNumberService.purchaseNumber(
      req.user!.organizationId,
      phoneNumber,
      { campaignId, friendlyName }
    );

    res.status(201).json({
      success: true,
      data: number,
    });
  })
);

// ===========================================
// Update Phone Number
// ===========================================

const updateBodySchema = z.object({
  friendlyName: z.string().max(100).optional(),
  campaignId: z.string().uuid().nullable().optional(),
});

router.patch(
  '/:id',
  validate({ params: idParamSchema, body: updateBodySchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const number = await phoneNumberService.updateNumber(
      req.user!.organizationId,
      req.params.id,
      req.body
    );

    res.json({
      success: true,
      data: number,
    });
  })
);

// ===========================================
// Release Phone Number
// ===========================================

router.delete(
  '/:id',
  validate({ params: idParamSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await phoneNumberService.releaseNumber(
      req.user!.organizationId,
      req.params.id
    );

    res.json({
      success: true,
      message: 'Phone number released successfully',
    });
  })
);

export { router as phoneNumberRoutes };
