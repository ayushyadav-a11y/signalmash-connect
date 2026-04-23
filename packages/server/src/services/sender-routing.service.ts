// ===========================================
// Sender Routing Service
// ===========================================

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';

export class SenderRoutingService {
  async resolveDefaultSenderForConnection(connectionId: string): Promise<string> {
    const connection = await prisma.platformConnection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        organizationId: true,
        platform: true,
        installationId: true,
      },
    });

    if (!connection) {
      throw new NotFoundError('Platform connection not found');
    }

    const senderProfile = await prisma.senderProfile.findFirst({
      where: {
        organizationId: connection.organizationId,
        platform: connection.platform,
        ...(connection.installationId ? { installationId: connection.installationId } : {}),
        isDefault: true,
        phoneNumber: {
          status: 'active',
        },
      },
      include: {
        phoneNumber: {
          select: {
            phoneNumber: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!senderProfile?.phoneNumber?.phoneNumber) {
      throw new NotFoundError('No active default sender is configured for this installation');
    }

    return senderProfile.phoneNumber.phoneNumber;
  }
}

export const senderRoutingService = new SenderRoutingService();
