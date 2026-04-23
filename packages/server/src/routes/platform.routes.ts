// ===========================================
// Platform Routes (OAuth & Connections)
// ===========================================

import { Router } from 'express';
import type { Router as RouterType } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database.js';
import { platformService } from '../services/platform.service.js';
import { authService } from '../services/auth.service.js';
import { platformAdapterRegistry } from '../services/platform-adapter-registry.service.js';
import { integrationService } from '../services/integration.service.js';
import type { GHLAdapter } from '../adapters/ghl.adapter.js';
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
  state: z.string().optional(), // Optional for GHL Marketplace installs
});

const platformParamSchema = z.object({
  platform: z.enum(['leadconnector', 'shopify', 'hubspot', 'salesforce', 'zoho']),
});

const activationSchema = z.object({
  source: z.enum(['manual_confirmation', 'test_send']).default('manual_confirmation'),
});

const ghlSsoExchangeSchema = z.object({
  encryptedData: z.string().min(1, 'Encrypted SSO payload is required'),
});

const listConnectionsHandler = asyncHandler(async (req, res) => {
  const connections = await platformService.getConnectionSummaries(
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
    installation: conn.installation,
  }));

  res.json({
    success: true,
    data: sanitizedConnections,
  });
});

/**
 * GET /platforms
 * List all platform connections for the organization
 */
router.get(
  '/',
  authenticate,
  listConnectionsHandler
);

/**
 * GET /platforms/connections
 * Backwards-compatible alias for older frontend bundles
 */
router.get(
  '/connections',
  authenticate,
  listConnectionsHandler
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
    const platformAdapter = platformAdapterRegistry.get(platform as Parameters<typeof platformAdapterRegistry.get>[0]);
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

    const authUrl = await platformAdapter.getAuthorizationUrl(state, redirectUri);

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
    const platformAdapter = platformAdapterRegistry.get(platform as Parameters<typeof platformAdapterRegistry.get>[0]);

    let storedOrganizationId: string | null = null;

    // Verify state if provided (app-initiated flow)
    // State is optional for GHL Marketplace installs where users install directly from GHL
    if (state) {
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

      storedOrganizationId = storedState.organizationId;
    } else {
      // Marketplace install - no state, which is fine for GHL
      logger.info({ platform }, 'OAuth callback without state (marketplace install)');
    }

    const redirectUri = `${config.apiUrl}/api/platforms/${platform}/callback`;

    const tokens = await platformAdapter.exchangeCodeForTokens(code as string, redirectUri);
    const accountInfo = await platformAdapter.getAccountInfo(
      tokens.accessToken,
      tokens.platformAccountId,
      tokens.companyId
    );

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

    if (!state) {
      const installCompleteUrl = new URL(`${config.webUrl}/auth/install-complete`);
      installCompleteUrl.searchParams.set('platform', platform);
      installCompleteUrl.searchParams.set('success', 'true');
      if (isNew) {
        installCompleteUrl.searchParams.set('isNew', 'true');
      }

      res.redirect(installCompleteUrl.toString());
      return;
    }

    // Auto-login: Create user session and get JWT tokens for app-initiated OAuth
    const authResult = await authService.loginViaOAuth(organizationId);

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
 * POST /platforms/leadconnector/sso/exchange
 * Exchange GHL custom-page SSO payload for app auth tokens
 */
router.post(
  '/leadconnector/sso/exchange',
  asyncHandler(async (req, res) => {
    const { encryptedData } = ghlSsoExchangeSchema.parse(req.body);
    const ghlAdapter = platformAdapterRegistry.get('leadconnector') as GHLAdapter;
    const ssoPayload = await ghlAdapter.decryptSsoData?.(encryptedData);

    if (!ssoPayload?.locationId) {
      throw new BadRequestError('Invalid GHL SSO payload');
    }

    const connection = await platformService.getByPlatformAccount(
      'leadconnector',
      ssoPayload.locationId
    );

    if (!connection) {
      throw new BadRequestError(
        'This GoHighLevel workspace is not connected yet. Install or reconnect the Signalmash app first.'
      );
    }

    const authResult = await authService.loginViaOAuth(connection.organizationId);

    res.json({
      success: true,
      data: {
        ...authResult,
        locationId: ssoPayload.locationId,
      },
    });
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
    const connection = await platformService.getConnectionSummaries(
      req.user!.organizationId
    ).then((connections) => connections.find((item) => item.id === req.params.id));

    if (!connection) {
      throw new BadRequestError('Platform connection not found');
    }

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
        installation: connection.installation,
      },
    });
  })
);

/**
 * DELETE /platforms/connections/:id
 * Backwards-compatible alias for older frontend bundles
 */
router.delete(
  '/connections/:id',
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

/**
 * GET /platforms/:id/readiness
 * Get onboarding readiness details for a connection
 */
router.get(
  '/:id/readiness',
  authenticate,
  validate({ params: idParamSchema }),
  asyncHandler(async (req, res) => {
    const connection = await platformService.getById(req.params.id, req.user!.organizationId);
    const readiness = await integrationService.getInstallationReadiness(
      req.user!.organizationId,
      connection.platform,
      connection.installationId
    );

    res.json({
      success: true,
      data: readiness,
    });
  })
);

/**
 * POST /platforms/:id/activate-provider
 * Mark manual provider activation as complete
 */
router.post(
  '/:id/activate-provider',
  authenticate,
  validate({ params: idParamSchema, body: activationSchema }),
  asyncHandler(async (req, res) => {
    const readiness = await integrationService.markProviderActivated(
      req.user!.organizationId,
      req.params.id,
      req.body
    );

    res.json({
      success: true,
      data: readiness,
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
