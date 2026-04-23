// ===========================================
// GoHighLevel (GHL) Platform Adapter
// ===========================================

import { config } from '../config/index.js';
import { redis } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import { ExternalServiceError } from '../utils/errors.js';
import {
  BasePlatformAdapter,
  type OAuthTokens,
  type PlatformAccountInfo,
  type OutboundMessagePayload,
  toPlatformAdapterConnection,
} from './base.adapter.js';
import type { PlatformConnection } from '@prisma/client';
import { decrypt } from '../utils/crypto.js';
import * as jose from 'jose';
import CryptoJS from 'crypto-js';
import { adminService, SETTINGS_KEYS } from '../services/admin.service.js';
import { platformService } from '../services/platform.service.js';
import type {
  InboundMessagePayload,
  MessageStatusUpdate,
  ParsedOutboundMessage,
  PlatformAdapterConnection,
  PlatformContact,
} from '@signalmash-connect/shared';
import crypto from 'crypto';

const GHL_WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

const GHL_WEBHOOK_LEGACY_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6
dO0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfB
csedpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpv
uxmZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF
3kvoV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKU
J062fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXp
IocmaiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzN
h/AMfHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhC
HULgCsnuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJ
PQe7z0cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAyk
T1hhTiaCeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

const GHL_OAUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';
const GHL_API_VERSION = '2021-07-28'; // Required API version header

interface GHLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
  userType?: string;
  isBulkInstallation?: boolean;
  installToFutureLocations?: boolean;
  approveAllLocations?: boolean;
}

interface GHLLocationResponse {
  location: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    logoUrl?: string;
  };
}

interface GHLLocationsListResponse {
  locations: Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
    website?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    logoUrl?: string;
  }>;
}

interface GHLConversationMessage {
  type: string;
  locationId: string;
  contactId: string;
  conversationId: string;
  body: string;
  attachments?: string[];
}

const TOKEN_REFRESH_LOCK_TTL_MS = 15_000;

type GHLConnection = PlatformAdapterConnection | PlatformConnection;

function normalizeConnection(connection: GHLConnection): PlatformAdapterConnection {
  if ('externalAccountId' in connection) {
    return connection;
  }

  return toPlatformAdapterConnection(connection);
}

export class GHLAdapter extends BasePlatformAdapter {
  readonly platform = 'leadconnector' as const;

  private async apiRequestWithConnection<T>(
    connection: GHLConnection,
    request: (accessToken: string) => Promise<T>
  ): Promise<T> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      return await request(decrypt(normalizedConnection.accessToken));
    } catch (error) {
      if (!this.isUnauthorizedError(error)) {
        throw error;
      }

      const refreshedConnection = await this.refreshConnectionTokens(normalizedConnection.id);
      return request(decrypt(refreshedConnection.accessToken));
    }
  }

  private isUnauthorizedError(error: unknown): boolean {
    return error instanceof Error && error.message.includes('401');
  }

  private async refreshConnectionTokens(connectionId: string) {
    const lockKey = `ghl:token-refresh:${connectionId}`;
    const lockValue = `${Date.now()}`;
    const lockAcquired = await redis.set(lockKey, lockValue, 'PX', TOKEN_REFRESH_LOCK_TTL_MS, 'NX');

    if (lockAcquired === 'OK') {
      try {
        const persistedConnection = await platformService.getByIdUnsafe(connectionId);
        const decryptedTokens = await platformService.getDecryptedTokens(connectionId);

        if (!decryptedTokens.refreshToken) {
          throw new ExternalServiceError('GHL', 'Refresh token is missing');
        }

        const refreshedTokens = await this.refreshTokens(decryptedTokens.refreshToken);

        return platformService.updateConnection(connectionId, {
          accessToken: refreshedTokens.accessToken,
          refreshToken: refreshedTokens.refreshToken ?? decryptedTokens.refreshToken,
          tokenExpiresAt: refreshedTokens.expiresIn
            ? new Date(Date.now() + refreshedTokens.expiresIn * 1000)
            : persistedConnection.tokenExpiresAt ?? undefined,
          scopes: refreshedTokens.scope?.split(' ') ?? persistedConnection.scopes as string[],
          status: 'connected',
        });
      } finally {
        await redis.del(lockKey);
      }
    }

    for (let attempt = 0; attempt < 15; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const persistedConnection = await platformService.getByIdUnsafe(connectionId);
      if (persistedConnection.updatedAt.getTime() > Date.now() - TOKEN_REFRESH_LOCK_TTL_MS) {
        return persistedConnection;
      }
    }

    throw new ExternalServiceError('GHL', 'Timed out waiting for token refresh');
  }

  /**
   * Override apiRequest to include GHL's required Version header
   */
  protected override async apiRequest<T>(
    url: string,
    options: {
      method?: string;
      accessToken: string;
      body?: unknown;
      headers?: Record<string, string>;
    }
  ): Promise<T> {
    const { method = 'GET', accessToken, body, headers = {} } = options;

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
        'Version': GHL_API_VERSION, // Required by GHL API
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<T>;
  }

  // ===========================================
  // Credential Getters (Database-first with env fallback)
  // ===========================================

  /**
   * Get GHL Client ID from database settings, falling back to env var
   */
  async getClientId(): Promise<string> {
    return adminService.getSettingWithFallback(
      SETTINGS_KEYS.GHL_APP_CLIENT_ID,
      config.ghlAppClientId
    );
  }

  /**
   * Get GHL Client Secret from database settings, falling back to env var
   */
  async getClientSecret(): Promise<string> {
    return adminService.getSettingWithFallback(
      SETTINGS_KEYS.GHL_APP_CLIENT_SECRET,
      config.ghlAppClientSecret
    );
  }

  /**
   * Get GHL shared secret from database settings, falling back to env var
   * Kept on the legacy setting key for backwards compatibility.
   */
  async getSsoKey(): Promise<string> {
    return adminService.getSettingWithFallback(
      SETTINGS_KEYS.GHL_APP_SSO_KEY,
      config.ghlAppSsoKey
    );
  }

  // ===========================================
  // OAuth Methods
  // ===========================================

  /**
   * Get GHL OAuth authorization URL
   */
  async getAuthorizationUrl(state: string, redirectUri: string): Promise<string> {
    const clientId = await this.getClientId();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      // Request location-level access
      scope: [
        'conversations.readonly',
        'conversations.write',
        'conversations/message.readonly',
        'conversations/message.write',
        'contacts.readonly',
        'contacts.write',
        'locations.readonly',
      ].join(' '),
    });

    return `${GHL_OAUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  async exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens> {
    try {
      const [clientId, clientSecret] = await Promise.all([
        this.getClientId(),
        this.getClientSecret(),
      ]);

      const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'GHL token exchange failed');
        throw new ExternalServiceError('GHL', `Token exchange failed: ${response.status}`);
      }

      const data = await response.json() as GHLTokenResponse;

      // Log the full response to understand what GHL returns
      logger.info({
        locationId: data.locationId,
        companyId: data.companyId,
        userId: data.userId,
        scope: data.scope,
        hasAccessToken: !!data.access_token,
        hasRefreshToken: !!data.refresh_token,
        allKeys: Object.keys(data),
      }, 'GHL tokens obtained');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
        platformAccountId: data.locationId, // Location-level install
        companyId: data.companyId, // Company-level (agency) install
        userId: data.userId,
        userType: data.userType,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to exchange GHL authorization code');
      throw error;
    }
  }

  /**
   * Refresh expired tokens
   */
  async refreshTokens(refreshToken: string): Promise<OAuthTokens> {
    try {
      const [clientId, clientSecret] = await Promise.all([
        this.getClientId(),
        this.getClientSecret(),
      ]);

      const response = await fetch(GHL_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error({ status: response.status, error: errorText }, 'GHL token refresh failed');
        throw new ExternalServiceError('GHL', `Token refresh failed: ${response.status}`);
      }

      const data = await response.json() as GHLTokenResponse;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to refresh GHL tokens');
      throw error;
    }
  }

  /**
   * Get locations for a company (agency-level token)
   */
  async getCompanyLocations(accessToken: string, companyId: string): Promise<Array<{
    id: string;
    name: string;
    email?: string;
    phone?: string;
  }>> {
    try {
      const response = await this.apiRequest<GHLLocationsListResponse>(
        `${config.ghlApiDomain}/locations/search?companyId=${companyId}&limit=100`,
        { accessToken }
      );

      return response.locations || [];
    } catch (error) {
      logger.error({ error, companyId }, 'Failed to get company locations');
      throw error;
    }
  }

  /**
   * Get GHL location (account) info
   */
  async getAccountInfo(accessToken: string, platformAccountId?: string, companyId?: string): Promise<PlatformAccountInfo> {
    try {
      // Use passed locationId, or try to decode from token as fallback
      let locationId = platformAccountId;

      if (!locationId) {
        try {
          const tokenInfo = jose.decodeJwt(accessToken);
          locationId = tokenInfo['locationId'] as string;
        } catch {
          // Token might not be a JWT or might not have locationId
        }
      }

      // If still no locationId but we have companyId, fetch locations from API
      if (!locationId && companyId) {
        logger.info({ companyId }, 'No locationId, fetching locations for company');
        const locations = await this.getCompanyLocations(accessToken, companyId);

        if (locations.length > 0) {
          const firstLocation = locations[0]!;
          locationId = firstLocation.id;
          logger.info({ companyId, locationId, totalLocations: locations.length }, 'Using first location from company');
        }
      }

      if (!locationId) {
        throw new ExternalServiceError('GHL', 'No location ID available');
      }

      // Fetch location details
      const response = await this.apiRequest<GHLLocationResponse>(
        `${config.ghlApiDomain}/locations/${locationId}`,
        { accessToken }
      );

      const { location } = response;

      return {
        id: location.id,
        name: location.name,
        email: location.email,
        phone: location.phone,
        website: location.website,
        metadata: {
          address: location.address,
          city: location.city,
          state: location.state,
          country: location.country,
          logoUrl: location.logoUrl,
        },
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get GHL location info');
      throw error;
    }
  }

  /**
   * Send message via GHL Conversations API
   * This is used when acting as a Conversation Provider
   */
  async sendMessage(
    connection: GHLConnection,
    payload: OutboundMessagePayload
  ): Promise<{ platformMessageId: string }> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      const response = await this.apiRequestWithConnection<{ messageId: string }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ messageId: string }>(
          `${config.ghlApiDomain}/conversations/messages`,
          {
            method: 'POST',
            accessToken,
            body: {
              type: 'SMS',
              contactId: payload.contactId,
              conversationId: payload.conversationId,
              message: payload.body,
              attachments: payload.mediaUrls,
            },
          }
        )
      );

      return { platformMessageId: response.messageId };
    } catch (error) {
      logger.error({ error, connectionId: normalizedConnection.id }, 'Failed to send GHL message');
      throw error;
    }
  }

  /**
   * Add inbound message to GHL conversation
   */
  async addInboundMessage(
    connection: GHLConnection,
    message: InboundMessagePayload
  ): Promise<{ externalMessageId: string }> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      const response = await this.apiRequestWithConnection<{ messageId: string }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ messageId: string }>(
          `${config.ghlApiDomain}/conversations/messages/inbound`,
          {
            method: 'POST',
            accessToken,
            body: {
              type: 'SMS',
              conversationId: message.conversationId,
              message: message.body,
              attachments: message.mediaUrls,
            },
          }
        )
      );

      return { externalMessageId: response.messageId };
    } catch (error) {
      logger.error({ error, connectionId: normalizedConnection.id }, 'Failed to add inbound message to GHL');
      throw error;
    }
  }

  /**
   * Update message status in GHL
   */
  async updateMessageStatus(
    connection: GHLConnection,
    externalMessageId: string,
    status: string
  ): Promise<void> {
    const normalizedConnection = normalizeConnection(connection);
    const ghlStatusMap: Record<string, string> = {
      queued: 'pending',
      sending: 'pending',
      sent: 'pending',
      delivered: 'delivered',
      undelivered: 'failed',
      failed: 'failed',
      read: 'read',
    };
    const ghlStatus = ghlStatusMap[status] ?? status;

    try {
      await this.apiRequestWithConnection(
        normalizedConnection,
        async (accessToken) => this.apiRequest(
          `${config.ghlApiDomain}/conversations/messages/${externalMessageId}/status`,
          {
            method: 'PUT',
            accessToken,
            body: { status: ghlStatus },
          }
        )
      );
    } catch (error) {
      logger.error(
        {
          error,
          errorMessage: error instanceof Error ? error.message : 'Unknown GHL status update error',
          connectionId: normalizedConnection.id,
          messageId: externalMessageId,
          status,
          ghlStatus,
        },
        'Failed to update GHL message status'
      );
      throw error;
    }
  }

  /**
   * Verify GHL webhook signature
   */
  verifyWebhookSignature(
    payload: string,
    signatures: {
      xGhlSignature?: string;
      xWhSignature?: string;
    }
  ): boolean {
    const payloadBuffer = Buffer.from(payload, 'utf8');

    if (signatures.xGhlSignature && signatures.xGhlSignature !== 'N/A') {
      try {
        const signatureBuffer = Buffer.from(signatures.xGhlSignature, 'base64');
        return crypto.verify(
          null,
          payloadBuffer,
          config.ghlWebhookPublicKey ?? GHL_WEBHOOK_PUBLIC_KEY,
          signatureBuffer
        );
      } catch (error) {
        logger.warn({ error }, 'Failed to verify X-GHL-Signature');
        return false;
      }
    }

    if (signatures.xWhSignature && signatures.xWhSignature !== 'N/A') {
      try {
        const verifier = crypto.createVerify('SHA256');
        verifier.update(payload);
        verifier.end();

        return verifier.verify(
          config.ghlWebhookLegacyPublicKey ?? GHL_WEBHOOK_LEGACY_PUBLIC_KEY,
          signatures.xWhSignature,
          'base64'
        );
      } catch (error) {
        logger.warn({ error }, 'Failed to verify X-WH-Signature');
        return false;
      }
    }

    return false;
  }

  /**
   * Parse GHL outbound message webhook
   * This is received when a user sends a message from GHL that should go through our provider
   */
  parseOutboundWebhook(payload: unknown): ParsedOutboundMessage | null {
    try {
      const data = payload as Record<string, unknown>;

      const body = data['message'] ?? data['body'];
      const to = data['phone'] ?? data['contactPhone'] ?? data['to'];
      const from = data['fromNumber'] ?? data['from'];
      const mediaUrls = data['attachments'] ?? data['mediaUrls'];

      if (!data['locationId'] || !data['messageId'] || !body) {
        return null;
      }

      return {
        providerMessageId: data['messageId'] as string,
        accountId: data['locationId'] as string,
        conversationId: data['conversationId'] as string | undefined,
        contactId: data['contactId'] as string | undefined,
        from: typeof from === 'string' && /^\+?\d[\d\s().-]*$/.test(from) ? from : undefined,
        to: to as string | undefined,
        body: body as string,
        mediaUrls: Array.isArray(mediaUrls) ? mediaUrls as string[] : undefined,
        rawPayload: payload,
      };
    } catch {
      return null;
    }
  }

  /**
   * Decrypt user context from a GHL Custom Page using the app shared secret.
   */
  async decryptSsoData(encryptedData: string): Promise<{
    locationId: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    try {
      const sharedSecret = await this.getSsoKey();
      const normalizedInput = decodeURIComponent(encryptedData.trim());

      const parsePayload = (raw: string): Record<string, unknown> | null => {
        try {
          return JSON.parse(raw) as Record<string, unknown>;
        } catch {
          return null;
        }
      };

      const candidates = [
        normalizedInput,
        CryptoJS.AES.decrypt(normalizedInput, sharedSecret).toString(CryptoJS.enc.Utf8),
      ].filter((value): value is string => Boolean(value));

      let payload: Record<string, unknown> | null = null;
      for (const candidate of candidates) {
        payload = parsePayload(candidate);
        if (payload) {
          break;
        }
      }

      if (!payload) {
        throw new Error('Unable to parse SSO payload');
      }

      const rawUserName =
        typeof payload.userName === 'string'
          ? payload.userName
          : typeof payload.name === 'string'
            ? payload.name
            : '';
      const userName = rawUserName.trim();
      const nameParts = userName.split(/\s+/).filter(Boolean);
      const firstName = typeof payload.firstName === 'string'
        ? payload.firstName
        : nameParts[0] ?? 'User';
      const lastName = typeof payload.lastName === 'string'
        ? payload.lastName
        : nameParts.slice(1).join(' ');
      const locationId =
        (typeof payload.activeLocation === 'string' && payload.activeLocation) ||
        (typeof payload.activeLocationId === 'string' && payload.activeLocationId) ||
        (typeof payload.locationId === 'string' && payload.locationId) ||
        (
          typeof payload.location === 'object' &&
          payload.location !== null &&
          typeof (payload.location as Record<string, unknown>).id === 'string' &&
          (payload.location as Record<string, unknown>).id as string
        ) ||
        (
          typeof payload.activeLocation === 'object' &&
          payload.activeLocation !== null &&
          typeof (payload.activeLocation as Record<string, unknown>).id === 'string' &&
          (payload.activeLocation as Record<string, unknown>).id as string
        );

      if (!locationId) {
        throw new Error('Missing active location');
      }

      return {
        locationId,
        userId: typeof payload.userId === 'string' ? payload.userId : '',
        email:
          typeof payload.email === 'string'
            ? payload.email
            : typeof payload.user === 'object' &&
                payload.user !== null &&
                typeof (payload.user as Record<string, unknown>).email === 'string'
              ? (payload.user as Record<string, unknown>).email as string
              : '',
        firstName,
        lastName,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to decrypt GHL SSO data');
      throw new ExternalServiceError('GHL', 'Invalid SSO data');
    }
  }

  /**
   * Get or create conversation for a contact
   */
  async getOrCreateConversation(
    connection: GHLConnection,
    contactId: string
  ): Promise<string> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      // First try to get existing conversation
      const response = await this.apiRequestWithConnection<{ conversations: Array<{ id: string }> }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ conversations: Array<{ id: string }> }>(
          `${config.ghlApiDomain}/conversations/search?contactId=${contactId}`,
          { accessToken }
        )
      );

      if (response.conversations.length > 0 && response.conversations[0]) {
        return response.conversations[0].id;
      }

      // Create new conversation
      const createResponse = await this.apiRequestWithConnection<{ conversation: { id: string } }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ conversation: { id: string } }>(
          `${config.ghlApiDomain}/conversations`,
          {
            method: 'POST',
            accessToken,
            body: {
              contactId,
              locationId: normalizedConnection.externalAccountId,
            },
          }
        )
      );

      return createResponse.conversation.id;
    } catch (error) {
      logger.error({ error, contactId }, 'Failed to get/create GHL conversation');
      throw error;
    }
  }

  /**
   * Get contact by phone number
   */
  async getContactByPhone(
    connection: GHLConnection,
    phoneNumber: string
  ): Promise<PlatformContact | null> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      const response = await this.apiRequestWithConnection<{ contacts: Array<{
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      }> }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ contacts: Array<{
          id: string;
          firstName?: string;
          lastName?: string;
          email?: string;
        }> }>(
          `${config.ghlApiDomain}/contacts/search/duplicate?phone=${encodeURIComponent(phoneNumber)}&locationId=${normalizedConnection.externalAccountId}`,
          { accessToken }
        )
      );

      if (response.contacts.length > 0) {
        return response.contacts[0] ?? null;
      }

      return null;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Failed to get GHL contact by phone');
      return null;
    }
  }

  /**
   * Create a contact in GHL
   */
  async createContact(
    connection: GHLConnection,
    data: {
      phone: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ): Promise<{ id: string }> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      const response = await this.apiRequestWithConnection<{ contact: { id: string } }>(
        normalizedConnection,
        async (accessToken) => this.apiRequest<{ contact: { id: string } }>(
          `${config.ghlApiDomain}/contacts`,
          {
            method: 'POST',
            accessToken,
            body: {
              locationId: normalizedConnection.externalAccountId,
              phone: data.phone,
              firstName: data.firstName,
              lastName: data.lastName,
              email: data.email,
            },
          }
        )
      );

      return { id: response.contact.id };
    } catch (error) {
      logger.error({ error, phone: data.phone }, 'Failed to create GHL contact');
      throw error;
    }
  }

  async updateContactPreferences(
    connection: GHLConnection,
    contactId: string,
    update: {
      dnd?: boolean;
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      metadata?: Record<string, unknown>;
    }
  ): Promise<void> {
    const normalizedConnection = normalizeConnection(connection);

    try {
      await this.apiRequestWithConnection(
        normalizedConnection,
        async (accessToken) => this.apiRequest(
          `${config.ghlApiDomain}/contacts/${contactId}`,
          {
            method: 'PUT',
            accessToken,
            body: {
              ...(update.firstName ? { firstName: update.firstName } : {}),
              ...(update.lastName ? { lastName: update.lastName } : {}),
              ...(update.email ? { email: update.email } : {}),
              ...(update.phone ? { phone: update.phone } : {}),
              ...(typeof update.dnd === 'boolean'
                ? {
                    dnd: update.dnd,
                  }
                : {}),
              ...(update.metadata ? { customFields: update.metadata } : {}),
            },
          }
        )
      );
    } catch (error) {
      logger.error({ error, contactId }, 'Failed to update GHL contact preferences');
      throw error;
    }
  }
}

export const ghlAdapter = new GHLAdapter();
