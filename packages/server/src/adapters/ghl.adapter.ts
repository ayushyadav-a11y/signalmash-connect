// ===========================================
// GoHighLevel (GHL) Platform Adapter
// ===========================================

import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { ExternalServiceError } from '../utils/errors.js';
import {
  BasePlatformAdapter,
  type OAuthTokens,
  type PlatformAccountInfo,
  type OutboundMessagePayload,
  type InboundMessageData,
  type MessageStatusUpdate,
} from './base.adapter.js';
import type { PlatformConnection } from '@prisma/client';
import { decrypt } from '../utils/crypto.js';
import * as jose from 'jose';
import { adminService, SETTINGS_KEYS } from '../services/admin.service.js';

const GHL_OAUTH_URL = 'https://marketplace.gohighlevel.com/oauth/chooselocation';
const GHL_TOKEN_URL = 'https://services.leadconnectorhq.com/oauth/token';

interface GHLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  locationId?: string;
  companyId?: string;
  userId?: string;
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

interface GHLConversationMessage {
  type: string;
  locationId: string;
  contactId: string;
  conversationId: string;
  body: string;
  attachments?: string[];
}

export class GHLAdapter extends BasePlatformAdapter {
  readonly platform = 'ghl' as const;

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
   * Get GHL SSO Key from database settings, falling back to env var
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

      logger.info({ locationId: data.locationId }, 'GHL tokens obtained');

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
        scope: data.scope,
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
   * Get GHL location (account) info
   */
  async getAccountInfo(accessToken: string): Promise<PlatformAccountInfo> {
    try {
      // First, get the location ID from the token
      const tokenInfo = jose.decodeJwt(accessToken);
      const locationId = tokenInfo['locationId'] as string;

      if (!locationId) {
        throw new ExternalServiceError('GHL', 'No location ID in token');
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
    connection: PlatformConnection,
    payload: OutboundMessagePayload
  ): Promise<{ platformMessageId: string }> {
    const accessToken = decrypt(connection.accessToken);

    try {
      const response = await this.apiRequest<{ messageId: string }>(
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
      );

      return { platformMessageId: response.messageId };
    } catch (error) {
      logger.error({ error, connectionId: connection.id }, 'Failed to send GHL message');
      throw error;
    }
  }

  /**
   * Add inbound message to GHL conversation
   */
  async addInboundMessage(
    connection: PlatformConnection,
    message: {
      conversationId: string;
      body: string;
      attachments?: string[];
    }
  ): Promise<{ messageId: string }> {
    const accessToken = decrypt(connection.accessToken);

    try {
      const response = await this.apiRequest<{ messageId: string }>(
        `${config.ghlApiDomain}/conversations/messages/inbound`,
        {
          method: 'POST',
          accessToken,
          body: {
            type: 'SMS',
            conversationId: message.conversationId,
            message: message.body,
            attachments: message.attachments,
          },
        }
      );

      return response;
    } catch (error) {
      logger.error({ error, connectionId: connection.id }, 'Failed to add inbound message to GHL');
      throw error;
    }
  }

  /**
   * Update message status in GHL
   */
  async updateMessageStatus(
    connection: PlatformConnection,
    platformMessageId: string,
    status: string
  ): Promise<void> {
    const accessToken = decrypt(connection.accessToken);

    try {
      await this.apiRequest(
        `${config.ghlApiDomain}/conversations/messages/${platformMessageId}/status`,
        {
          method: 'PUT',
          accessToken,
          body: { status },
        }
      );
    } catch (error) {
      logger.error(
        { error, connectionId: connection.id, messageId: platformMessageId },
        'Failed to update GHL message status'
      );
      throw error;
    }
  }

  /**
   * Verify GHL webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    if (!config.ghlWebhookSecret) {
      logger.warn('GHL webhook secret not configured, skipping verification');
      return true;
    }

    // GHL uses a simple HMAC-SHA256 signature
    const crypto = require('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', config.ghlWebhookSecret)
      .update(payload)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Parse GHL outbound message webhook
   * This is received when a user sends a message from GHL that should go through our provider
   */
  parseOutboundWebhook(payload: unknown): {
    locationId: string;
    conversationId: string;
    contactId: string;
    message: string;
    attachments?: string[];
  } | null {
    try {
      const data = payload as Record<string, unknown>;

      if (!data['locationId'] || !data['conversationId'] || !data['message']) {
        return null;
      }

      return {
        locationId: data['locationId'] as string,
        conversationId: data['conversationId'] as string,
        contactId: data['contactId'] as string,
        message: data['message'] as string,
        attachments: data['attachments'] as string[] | undefined,
      };
    } catch {
      return null;
    }
  }

  /**
   * Decrypt SSO data from GHL Custom Page
   */
  async decryptSsoData(encryptedData: string): Promise<{
    locationId: string;
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
  }> {
    try {
      // GHL SSO data is encrypted with the app's SSO key (from database or env)
      const ssoKeyValue = await this.getSsoKey();
      const ssoKey = new TextEncoder().encode(ssoKeyValue);

      const { payload } = await jose.jwtDecrypt(encryptedData, ssoKey);

      return {
        locationId: payload['locationId'] as string,
        userId: payload['userId'] as string,
        email: payload['email'] as string,
        firstName: payload['firstName'] as string,
        lastName: payload['lastName'] as string,
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
    connection: PlatformConnection,
    contactId: string
  ): Promise<string> {
    const accessToken = decrypt(connection.accessToken);

    try {
      // First try to get existing conversation
      const response = await this.apiRequest<{ conversations: Array<{ id: string }> }>(
        `${config.ghlApiDomain}/conversations/search?contactId=${contactId}`,
        { accessToken }
      );

      if (response.conversations.length > 0 && response.conversations[0]) {
        return response.conversations[0].id;
      }

      // Create new conversation
      const createResponse = await this.apiRequest<{ conversation: { id: string } }>(
        `${config.ghlApiDomain}/conversations`,
        {
          method: 'POST',
          accessToken,
          body: {
            contactId,
            locationId: connection.platformAccountId,
          },
        }
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
    connection: PlatformConnection,
    phoneNumber: string
  ): Promise<{ id: string; firstName?: string; lastName?: string; email?: string } | null> {
    const accessToken = decrypt(connection.accessToken);

    try {
      const response = await this.apiRequest<{ contacts: Array<{
        id: string;
        firstName?: string;
        lastName?: string;
        email?: string;
      }> }>(
        `${config.ghlApiDomain}/contacts/search/duplicate?phone=${encodeURIComponent(phoneNumber)}&locationId=${connection.platformAccountId}`,
        { accessToken }
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
    connection: PlatformConnection,
    data: {
      phone: string;
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ): Promise<{ id: string }> {
    const accessToken = decrypt(connection.accessToken);

    try {
      const response = await this.apiRequest<{ contact: { id: string } }>(
        `${config.ghlApiDomain}/contacts`,
        {
          method: 'POST',
          accessToken,
          body: {
            locationId: connection.platformAccountId,
            phone: data.phone,
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
          },
        }
      );

      return { id: response.contact.id };
    } catch (error) {
      logger.error({ error, phone: data.phone }, 'Failed to create GHL contact');
      throw error;
    }
  }
}

export const ghlAdapter = new GHLAdapter();
