// ===========================================
// Platform Routes (OAuth & Connections)
// ===========================================

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { platformService } from '../services/platform.service.js';
import { authService } from '../services/auth.service.js';
import { ghlAdapter } from '../adapters/ghl.adapter.js';
import { validate, idParamSchema } from '../middleware/validation.js';
import { authenticate, optionalAuth } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { BadRequestError } from '../utils/errors.js';
import { generateUrlSafeToken } from '../utils/crypto.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

const router: RouterType = Router();

// Validation schemas
const oauthCallbackSchema = z.object({
  code: z.string().min(1, 'Authorization code is required'),
  state: z.string().min(1, 'State is required'),
});

const platformParamSchema = z.object({
  platform: z.enum(['ghl', 'shopify', 'hubspot', 'salesforce', 'zoho']),
});

/**
 * GET /platforms
 * List all platform connections for the organization
 */
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const connections = await platformService.getByOrganization(
      req.user!.organizationId
    );

    // Don't expose tokens
    const sanitizedConnections = connections.map((conn) => ({
      id: conn.id,
      platform: conn.platform,
      platformAccountId: conn.platformAccountId,
      platformAccountName: conn.platformAccountName,
      status: conn.status,
      scopes: conn.scopes,
      lastSyncAt: conn.lastSyncAt,
      createdAt: conn.createdAt,
    }));

    res.json({
      success: true,
      data: sanitizedConnections,
    });
  })
);

/**
 * GET /platforms/:platform/oauth
 * Initiate OAuth flow for a platform
 */
router.get(
  '/:platform/oauth',
  optionalAuth,
  validate({ params: platformParamSchema }),
  asyncHandler(async (req, res) => {
    const { platform } = req.params;
    const redirectUri = `${config.apiUrl}/api/platforms/${platform}/callback`;

    // Generate state token
    const state = generateUrlSafeToken(32);

    // Store state in database for verification
    await prisma.oAuthState.create({
      data: {
        state,
        platform: platform as any,
        organizationId: req.user?.organizationId,
        redirectUri,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });

    let authUrl: string;

    switch (platform) {
      case 'ghl':
        authUrl = await ghlAdapter.getAuthorizationUrl(state, redirectUri);
        break;
      default:
        throw new BadRequestError(`Platform ${platform} is not yet supported`);
    }

    res.json({
      success: true,
      data: { authUrl },
    });
  })
);

/**
 * GET /platforms/:platform/callback
 * OAuth callback handler
 */
router.get(
  '/:platform/callback',
  validate({ params: platformParamSchema, query: oauthCallbackSchema }),
  asyncHandler(async (req, res) => {
    const { platform } = req.params;
    const { code, state } = req.query;

    // Verify state
    const storedState = await prisma.oAuthState.findUnique({
      where: { state: state as string },
    });

    if (!storedState || storedState.expiresAt < new Date()) {
      throw new BadRequestError('Invalid or expired state');
    }

    // Delete used state
    await prisma.oAuthState.delete({ where: { id: storedState.id } });

    if (storedState.platform !== platform) {
      throw new BadRequestError('State platform mismatch');
    }

    const redirectUri = `${config.apiUrl}/api/platforms/${platform}/callback`;

    let tokens;
    let accountInfo;

    switch (platform) {
      case 'ghl':
        tokens = await ghlAdapter.exchangeCodeForTokens(code as string, redirectUri);
        accountInfo = await ghlAdapter.getAccountInfo(tokens.accessToken);
        break;
      default:
        throw new BadRequestError(`Platform ${platform} is not yet supported`);
    }

    // Find or create organization
    const { organizationId, isNew } = await platformService.findOrCreateOrganization(
      platform as any,
      accountInfo.id,
      {
        name: accountInfo.name,
        email: accountInfo.email ?? `${accountInfo.id}@${platform}.local`,
        phone: accountInfo.phone,
        website: accountInfo.website,
      }
    );

    // Create/update platform connection
    await platformService.createConnection({
      organizationId,
      platform: platform as any,
      platformAccountId: accountInfo.id,
      platformAccountName: accountInfo.name,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      tokenExpiresAt: tokens.expiresIn
        ? new Date(Date.now() + tokens.expiresIn * 1000)
        : undefined,
      scopes: tokens.scope?.split(' ') ?? [],
      metadata: accountInfo.metadata,
    });

    logger.info(
      { platform, accountId: accountInfo.id, organizationId },
      'Platform connected successfully'
    );

    // Auto-login: Create user session and get JWT tokens
    const authResult = await authService.loginViaOAuth(organizationId);

    // Redirect to frontend with auth tokens (SSO flow)
    const successUrl = new URL(`${config.webUrl}/auth/callback`);
    successUrl.searchParams.set('platform', platform);
    successUrl.searchParams.set('success', 'true');
    successUrl.searchParams.set('accessToken', authResult.tokens.accessToken);
    successUrl.searchParams.set('refreshToken', authResult.tokens.refreshToken);
    successUrl.searchParams.set('expiresIn', authResult.tokens.expiresIn.toString());
    if (isNew) {
      successUrl.searchParams.set('isNew', 'true');
    }

    res.redirect(successUrl.toString());
  })
);

/**
 * GET /platforms/:id
 * Get platform connection details
 */
router.get(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const connection = await platformService.getById(
      req.params.id,
      req.user!.organizationId
    );

    res.json({
      success: true,
      data: {
        id: connection.id,
        platform: connection.platform,
        platformAccountId: connection.platformAccountId,
        platformAccountName: connection.platformAccountName,
        status: connection.status,
        scopes: connection.scopes,
        lastSyncAt: connection.lastSyncAt,
        createdAt: connection.createdAt,
      },
    });
  })
);

/**
 * POST /platforms/:id/disconnect
 * Disconnect a platform
 */
router.post(
  '/:id/disconnect',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await platformService.disconnect(req.params.id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Platform disconnected successfully',
    });
  })
);

/**
 * DELETE /platforms/:id
 * Delete platform connection
 */
router.delete(
  '/:id',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    await platformService.delete(req.params.id, req.user!.organizationId);

    res.json({
      success: true,
      message: 'Platform connection deleted',
    });
  })
);

export { router as platformRoutes };
