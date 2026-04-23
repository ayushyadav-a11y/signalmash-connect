// ===========================================
// Base Platform Adapter Interface
// ===========================================

import type { PlatformConnection } from '@prisma/client';
import type {
  OAuthTokenSet,
  OutboundMessagePayload,
  PlatformAccountProfile,
  PlatformAdapter,
  PlatformAdapterConnection,
} from '@signalmash-connect/shared';

export type OAuthTokens = OAuthTokenSet;
export type PlatformAccountInfo = PlatformAccountProfile;
export type { OutboundMessagePayload };

export function toPlatformAdapterConnection(
  connection: PlatformConnection
): PlatformAdapterConnection {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    platform: connection.platform,
    externalAccountId: connection.platformAccountId,
    externalAccountName: connection.platformAccountName ?? undefined,
    accessToken: connection.accessToken,
    refreshToken: connection.refreshToken,
    tokenExpiresAt: connection.tokenExpiresAt,
    metadata: (connection.metadata as Record<string, unknown> | null | undefined) ?? null,
  };
}

/**
 * Abstract base class with common functionality
 */
export abstract class BasePlatformAdapter implements PlatformAdapter {
  abstract readonly platform: PlatformAdapter['platform'];

  abstract getAuthorizationUrl(state: string, redirectUri: string): string | Promise<string>;
  abstract exchangeCodeForTokens(code: string, redirectUri: string): Promise<OAuthTokens>;
  abstract refreshTokens(refreshToken: string): Promise<OAuthTokens>;
  abstract getAccountInfo(accessToken: string, platformAccountId?: string, companyId?: string): Promise<PlatformAccountInfo>;

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
