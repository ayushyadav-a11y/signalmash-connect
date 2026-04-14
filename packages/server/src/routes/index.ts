// ===========================================
// API Routes Index
// ===========================================

import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { organizationRoutes } from './organization.routes.js';
import { brandRoutes } from './brand.routes.js';
import { campaignRoutes } from './campaign.routes.js';
import { messageRoutes } from './message.routes.js';
import { phoneNumberRoutes } from './phoneNumber.routes.js';
import { platformRoutes } from './platform.routes.js';
import { webhookRoutes } from './webhook.routes.js';
import adminRoutes from './admin.routes.js';

const router = Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Signalmash Connect API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
router.use('/auth', authRoutes);
router.use('/organization', organizationRoutes);
router.use('/brands', brandRoutes);
router.use('/campaigns', campaignRoutes);
router.use('/messages', messageRoutes);
router.use('/phone-numbers', phoneNumberRoutes);
router.use('/platforms', platformRoutes);
router.use('/webhooks', webhookRoutes);

// Admin Routes (separate namespace)
router.use('/admin', adminRoutes);

export { router as apiRoutes };
