// ===========================================
// Brand Routes
// ===========================================

import { Router } from 'express';
import { z } from 'zod';
import { brandService } from '../services/brand.service.js';
import { validate, idParamSchema, einSchema, urlSchema, phoneSchema, emailSchema } from '../middleware/validation.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

// Validation schemas
const createBrandSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required').max(100),
  displayName: z.string().min(1, 'Display name is required').max(100),
  ein: einSchema.optional(),
  entityType: z.enum([
    'sole_proprietor',
    'partnership',
    'corporation',
    'llc',
    'non_profit',
    'government',
  ]),
  vertical: z.enum([
    'retail',
    'healthcare',
    'financial',
    'education',
    'hospitality',
    'real_estate',
    'technology',
    'professional_services',
    'other',
  ]),
  streetAddress: z.string().min(1, 'Street address is required').max(200),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().min(2, 'State is required').max(2),
  postalCode: z.string().min(5, 'Postal code is required').max(10),
  country: z.string().default('US'),
  website: urlSchema,
  phone: phoneSchema,
  email: emailSchema,
});

const updateBrandSchema = createBrandSchema.partial();

/**
 * GET /brands
 * List all brands for the organization
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const brands = await brandService.getByOrganization(req.user!.organizationId);

    res.json({
      success: true,
      data: brands,
    });
  })
);

/**
 * POST /brands
 * Create a new brand
 */
router.post(
  '/',
  authenticate,
  validate({ body: createBrandSchema }),
  asyncHandler(async (req, res) => {
    const brand = await brandService.create({
      ...req.body,
      organizationId: req.user!.organizationId,
    });

    res.status(201).json({
      success: true,
      data: brand,
    });
  })
);

/**
 * GET /brands/:id
 * Get brand details
 */
router.get(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const brand = await brandService.getWithCampaigns(
      req.params.id,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: brand,
    });
  })
);

/**
 * PUT /brands/:id
 * Update brand
 */
router.put(
  '/:id',
  authenticate,
  validate({ params: idParamSchema, body: updateBrandSchema }),
  asyncHandler(async (req, res) => {
    const brand = await brandService.update(
      req.params.id,
      req.user!.organizationId,
      req.body
    );

    res.json({
      success: true,
      data: brand,
    });
  })
);

/**
 * POST /brands/:id/submit
 * Submit brand for verification
 */
router.post(
  '/:id/submit',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const brand = await brandService.submitForVerification(
      req.params.id,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: brand,
      message: 'Brand submitted for verification',
    });
  })
);

/**
 * DELETE /brands/:id
 * Delete draft brand
 */
router.delete(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await brandService.delete(req.params.id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Brand deleted successfully',
    });
  })
);

export { router as brandRoutes };
