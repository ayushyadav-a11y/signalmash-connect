// ===========================================
// Base Platform Adapter Interface
// ===========================================

import type { Platform, PlatformConnection } from '@prisma/client';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresIn?: number;
  tokenType: string;
  scope?: string;
}

export interface PlatformAccountInfo {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  metadata?: Record<string, unknown>;
}

export interface OutboundMessagePayload {
  conversationId?: string;
  contactId?: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
}

export interface InboundMessageData {
  platformMessageId: string;
  platformConversationId?: string;
  from: string;
  to: string;
  body: string;
  mediaUrls?: string[];
  timestamp: Date;
}

export interface MessageStatusUpdate {
  platformMessageId: string;
  status: 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  errorMessage?: string;
  timestamp: Date;
}

/**
 * Base adapter interface for all platform integrations
 */
export interface PlatformAdapter {
  readonly platform: Platform;

  // OAuth
  getAuthorizationUrl(state: string, redirectUri: string): string | Promise<string>;
  exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  refreshTokens(refreshToken: string): Promise<OAuthTokens>;

  // Account Info
  getAccountInfo(accessToken: string): Promise<PlatformAccountInfo>;

  // Messaging
  sendMessage?(
    connection: PlatformConnection,
    payload: OutboundMessagePayload
  ): Promise<{ platformMessageId: string }>;

  updateMessageStatus?(
    connection: PlatformConnection,
    platformMessageId: string,
    status: string
  ): Promise<void>;

  // Webhooks
  verifyWebhookSignature?(payload: string, signature: string): boolean;
  parseInboundMessage?(payload: unknown): InboundMessageData | null;
  parseStatusUpdate?(payload: unknown): MessageStatusUpdate | null;
}

/**
 * Abstract base class with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: Platform;

  abstract getAuthorizationUrl(state: string, redirectUri: string): string | Promise<string>;
  abstract exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  abstract getAccountInfo(accessToken: string): Promise<PlatformAccountInfo>;

  /**
   * Helper to make authenticated API requests
   */
  protected async apiRequest<T>(
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
}
