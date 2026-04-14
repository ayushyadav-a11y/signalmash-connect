// ===========================================
// Platform Connection Service
// ===========================================

import { prisma } from '../config/database.js';
import { encrypt, decrypt } from '../utils/crypto.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { PlatformConnection, Platform, PlatformStatus } from '@prisma/client';

interface CreateConnectionInput {
  organizationId: string;
  platform: Platform;
  platformAccountId: string;
  platformAccountName?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes: string[];
  metadata?: Record<string, unknown>;
}

interface UpdateConnectionInput {
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  scopes?: string[];
  status?: PlatformStatus;
  metadata?: Record<string, unknown>;
  lastSyncAt?: Date;
}

export class PlatformService {
  /**
   * Create a new platform connection
   */
  async createConnection(data: CreateConnectionInput): Promise<PlatformConnection> {
    // Check if connection already exists
    const existing = await prisma.platformConnection.findFirst({
      where: {
        organizationId: data.organizationId,
        platform: data.platform,
        platformAccountId: data.platformAccountId,
      },
    });

    if (existing) {
      // Update existing connection instead
      return this.updateConnection(existing.id, {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        status: 'connected',
        metadata: data.metadata,
      });
    }

    // Encrypt tokens before storing
    const encryptedAccessToken = encrypt(data.accessToken);
    const encryptedRefreshToken = data.refreshToken ? encrypt(data.refreshToken) : null;

    const connection = await prisma.platformConnection.create({
      data: {
        organizationId: data.organizationId,
        platform: data.platform,
        platformAccountId: data.platformAccountId,
        platformAccountName: data.platformAccountName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        scopes: data.scopes,
        status: 'connected',
        metadata: (data.metadata ?? {}) as any,
      },
    });

    logger.info(
      { connectionId: connection.id, platform: data.platform },
      'Platform connection created'
    );

    return connection;
  }

  /**
   * Get connection by ID
   */
  async getById(id: string, organizationId: string): Promise<PlatformConnection> {
    const connection = await prisma.platformConnection.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    return connection;
  }

  /**
   * Get connection by platform and account ID
   */
  async getByPlatformAccount(
    platform: Platform,
    platformAccountId: string
  ): Promise<PlatformConnection | null> {
    return prisma.platformConnection.findFirst({
      where: {
        platform,
        platformAccountId,
      },
    });
  }

  /**
   * Get all connections for an organization
   */
  async getByOrganization(
    organizationId: string,
    platform?: Platform
  ): Promise<PlatformConnection[]> {
    return prisma.platformConnection.findMany({
      where: {
        organizationId,
        ...(platform && { platform }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update connection
   */
  async updateConnection(
    id: string,
    data: UpdateConnectionInput
  ): Promise<PlatformConnection> {
    const updateData: any = { ...data };

    // Encrypt new tokens if provided
    if (data.accessToken) {
      updateData.accessToken = encrypt(data.accessToken);
    }
    if (data.refreshToken) {
      updateData.refreshToken = encrypt(data.refreshToken);
    }

    const connection = await prisma.platformConnection.update({
      where: { id },
      data: updateData,
    });

    logger.info({ connectionId: id }, 'Platform connection updated');

    return connection;
  }

  /**
   * Get decrypted tokens for a connection
   */
  async getDecryptedTokens(connectionId: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
  }> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    return {
      accessToken: decrypt(connection.accessToken),
      refreshToken: connection.refreshToken ? decrypt(connection.refreshToken) : null,
    };
  }

  /**
   * Check if token needs refresh
   */
  async needsTokenRefresh(connectionId: string): Promise<boolean> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    if (!connection.tokenExpiresAt) {
      return false;
    }

    // Refresh if token expires in less than 5 minutes
    const fiveMinutesFromNow = new Date(Date.now() + 5 * 60 * 1000);
    return connection.tokenExpiresAt < fiveMinutesFromNow;
  }

  /**
   * Disconnect platform
   */
  async disconnect(id: string, organizationId: string): Promise<void> {
    const connection = await this.getById(id, organizationId);

    await prisma.platformConnection.update({
      where: { id: connection.id },
      data: {
        status: 'disconnected',
        accessToken: '',
        refreshToken: null,
      },
    });

    logger.info({ connectionId: id }, 'Platform disconnected');
  }

  /**
   * Delete connection
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const connection = await this.getById(id, organizationId);

    await prisma.platformConnection.delete({
      where: { id: connection.id },
    });

    logger.info({ connectionId: id }, 'Platform connection deleted');
  }

  /**
   * Find or create organization from platform connection
   * Used during OAuth when a new user connects
   */
  async findOrCreateOrganization(
    platform: Platform,
    platformAccountId: string,
    accountInfo: {
      name: string;
      email: string;
      phone?: string;
      website?: string;
    }
  ): Promise<{ organizationId: string; isNew: boolean }> {
    // Check if this platform account is already connected
    const existingConnection = await this.getByPlatformAccount(platform, platformAccountId);

    if (existingConnection) {
      return {
        organizationId: existingConnection.organizationId,
        isNew: false,
      };
    }

    // Check if organization exists by email
    const existingOrg = await prisma.organization.findFirst({
      where: { email: accountInfo.email.toLowerCase() },
    });

    if (existingOrg) {
      return {
        organizationId: existingOrg.id,
        isNew: false,
      };
    }

    // Create new organization
    const newOrg = await prisma.organization.create({
      data: {
        name: accountInfo.name,
        email: accountInfo.email.toLowerCase(),
        phone: accountInfo.phone,
        website: accountInfo.website,
      },
    });

    logger.info(
      { organizationId: newOrg.id, platform, platformAccountId },
      'New organization created from platform connection'
    );

    return {
      organizationId: newOrg.id,
      isNew: true,
    };
  }
}

export const platformService = new PlatformService();
