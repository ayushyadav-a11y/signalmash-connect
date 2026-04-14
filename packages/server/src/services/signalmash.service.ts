// ===========================================
// Signalmash API Service
// ===========================================

import { config } from '../config/index.js';
import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { decrypt } from '../utils/crypto.js';
import { ExternalServiceError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { retry } from '@signalmash-connect/shared';

// Settings keys (must match admin.service.ts)
const SETTINGS_KEYS = {
  SIGNALMASH_API_KEY: 'signalmash_api_key',
  SIGNALMASH_API_URL: 'signalmash_api_url',
} as const;

// Cache TTL for settings (5 minutes)
const SETTINGS_CACHE_TTL = 300;

interface BrandRegistrationInput {
  legalName: string;
  displayName: string;
  ein?: string;
  entityType: string;
  vertical: string;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  website: string;
  phone: string;
  email: string;
}

interface BrandRegistrationResult {
  brandId: string;
  tcrBrandId?: string;
  status: string;
  verificationScore?: number;
}

interface CampaignRegistrationInput {
  brandId: string;
  name: string;
  description: string;
  useCase: string;
  sampleMessages: string[];
  optInKeywords: string[];
  optOutKeywords: string[];
  helpKeywords: string[];
  optInMessage: string;
  optOutMessage: string;
  helpMessage: string;
}

interface CampaignRegistrationResult {
  campaignId: string;
  tcrCampaignId?: string;
  status: string;
  dailyMessageLimit?: number;
  messagesPerSecond?: number;
}

interface SendMessageInput {
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  webhookUrl?: string;
}

interface SendMessageResult {
  messageId: string;
  status: string;
  from: string;
  to: string;
}

interface MessageStatusResult {
  messageId: string;
  status: string;
  errorCode?: string;
  errorMessage?: string;
  sentAt?: string;
  deliveredAt?: string;
}

export class SignalmashService {
  /**
   * Get a setting value from database with caching
   * Falls back to environment variables if not set in database
   */
  private async getSetting(key: string, envFallback: string): Promise<string> {
    // Check cache first
    const cacheKey = `setting:${key}`;
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (error) {
      // Redis might not be available, continue without cache
      logger.debug({ error }, 'Redis cache unavailable');
    }

    // Check database
    try {
      const setting = await prisma.appSettings.findUnique({
        where: { key },
      });

      if (setting && setting.value) {
        const value = setting.isEncrypted ? decrypt(setting.value) : setting.value;

        // Cache the value
        try {
          await redis.setex(cacheKey, SETTINGS_CACHE_TTL, value);
        } catch {
          // Ignore cache errors
        }

        return value;
      }
    } catch (error) {
      logger.debug({ error, key }, 'Failed to get setting from database');
    }

    // Fall back to environment variable
    return envFallback;
  }

  /**
   * Get the current Signalmash API configuration
   * This is fetched fresh for each request to support runtime updates
   */
  private async getConfig(): Promise<{ apiUrl: string; apiKey: string }> {
    const [apiUrl, apiKey] = await Promise.all([
      this.getSetting(SETTINGS_KEYS.SIGNALMASH_API_URL, config.signalmashApiUrl),
      this.getSetting(SETTINGS_KEYS.SIGNALMASH_API_KEY, config.signalmashApiKey || ''),
    ]);

    return {
      apiUrl,
      apiKey,
    };
  }

  /**
   * Make authenticated request to Signalmash API
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: unknown
  ): Promise<T> {
    // Get fresh config (supports runtime API key updates)
    const signalmashConfig = await this.getConfig();

    if (!signalmashConfig.apiKey) {
      throw new ExternalServiceError(
        'Signalmash',
        'API key not configured. Please configure it in Admin Settings.'
      );
    }

    const url = `${signalmashConfig.apiUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${signalmashConfig.apiKey}`,
    };

    try {
      const response = await retry(
        async () => {
          const res = await fetch(url, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined,
          });

          if (!res.ok) {
            const errorBody = await res.json().catch(() => ({})) as { message?: string };
            throw new ExternalServiceError(
              'Signalmash',
              `${res.status}: ${errorBody.message || res.statusText}`
            );
          }

          return res.json() as Promise<T>;
        },
        { maxRetries: 3, initialDelay: 1000 }
      );

      return response;
    } catch (error) {
      logger.error({ error, endpoint, method }, 'Signalmash API request failed');
      throw error;
    }
  }

  /**
   * Register a brand for 10DLC
   */
  async registerBrand(input: BrandRegistrationInput): Promise<BrandRegistrationResult> {
    logger.info({ legalName: input.legalName }, 'Registering brand with Signalmash');

    const result = await this.request<BrandRegistrationResult>(
      'POST',
      '/v1/brands',
      {
        legal_name: input.legalName,
        display_name: input.displayName,
        ein: input.ein,
        entity_type: input.entityType,
        vertical: input.vertical,
        address: {
          street: input.streetAddress,
          city: input.city,
          state: input.state,
          postal_code: input.postalCode,
          country: input.country,
        },
        website: input.website,
        phone: input.phone,
        email: input.email,
      }
    );

    logger.info(
      { brandId: result.brandId, status: result.status },
      'Brand registered with Signalmash'
    );

    return result;
  }

  /**
   * Get brand status
   */
  async getBrandStatus(brandId: string): Promise<{
    status: string;
    verificationScore?: number;
    rejectionReason?: string;
  }> {
    return this.request('GET', `/v1/brands/${brandId}`);
  }

  /**
   * Register a campaign
   */
  async registerCampaign(input: CampaignRegistrationInput): Promise<CampaignRegistrationResult> {
    logger.info({ name: input.name, brandId: input.brandId }, 'Registering campaign with Signalmash');

    const result = await this.request<CampaignRegistrationResult>(
      'POST',
      '/v1/campaigns',
      {
        brand_id: input.brandId,
        name: input.name,
        description: input.description,
        use_case: input.useCase,
        sample_messages: input.sampleMessages,
        opt_in: {
          keywords: input.optInKeywords,
          message: input.optInMessage,
        },
        opt_out: {
          keywords: input.optOutKeywords,
          message: input.optOutMessage,
        },
        help: {
          keywords: input.helpKeywords,
          message: input.helpMessage,
        },
      }
    );

    logger.info(
      { campaignId: result.campaignId, status: result.status },
      'Campaign registered with Signalmash'
    );

    return result;
  }

  /**
   * Get campaign status
   */
  async getCampaignStatus(campaignId: string): Promise<{
    status: string;
    rejectionReason?: string;
    dailyMessageLimit?: number;
    messagesPerSecond?: number;
  }> {
    return this.request('GET', `/v1/campaigns/${campaignId}`);
  }

  /**
   * Send an SMS message
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    logger.debug({ from: input.from, to: input.to }, 'Sending SMS via Signalmash');

    const result = await this.request<SendMessageResult>(
      'POST',
      '/v1/messages',
      {
        from: input.from,
        to: input.to,
        body: input.body,
        media_urls: input.mediaUrls,
        webhook_url: input.webhookUrl,
      }
    );

    logger.info(
      { messageId: result.messageId, status: result.status },
      'Message sent via Signalmash'
    );

    return result;
  }

  /**
   * Get message status
   */
  async getMessageStatus(messageId: string): Promise<MessageStatusResult> {
    return this.request('GET', `/v1/messages/${messageId}`);
  }

  /**
   * List available phone numbers for purchase
   */
  async listAvailableNumbers(options?: {
    areaCode?: string;
    contains?: string;
    limit?: number;
  }): Promise<Array<{
    phoneNumber: string;
    formattedNumber: string;
    capabilities: { sms: boolean; mms: boolean; voice: boolean };
    monthlyPrice: number;
  }>> {
    const params = new URLSearchParams();
    if (options?.areaCode) params.append('area_code', options.areaCode);
    if (options?.contains) params.append('contains', options.contains);
    if (options?.limit) params.append('limit', String(options.limit));

    const queryString = params.toString();
    const endpoint = `/v1/numbers/available${queryString ? `?${queryString}` : ''}`;

    return this.request('GET', endpoint);
  }

  /**
   * Purchase a phone number
   */
  async purchaseNumber(
    phoneNumber: string,
    campaignId: string
  ): Promise<{
    numberId: string;
    phoneNumber: string;
    status: string;
  }> {
    return this.request('POST', '/v1/numbers', {
      phone_number: phoneNumber,
      campaign_id: campaignId,
    });
  }

  /**
   * Release a phone number
   */
  async releaseNumber(numberId: string): Promise<void> {
    await this.request('DELETE', `/v1/numbers/${numberId}`);
  }

  /**
   * Configure webhook for a number
   */
  async configureWebhook(
    numberId: string,
    webhookUrl: string
  ): Promise<void> {
    await this.request('PATCH', `/v1/numbers/${numberId}`, {
      webhook_url: webhookUrl,
    });
  }
}

export const signalmashService = new SignalmashService();
