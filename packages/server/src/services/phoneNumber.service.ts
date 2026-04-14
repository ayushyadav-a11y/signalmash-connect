// ===========================================
// Phone Number (DID) Management Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { PhoneNumberStatus } from '@prisma/client';

interface AvailableNumber {
  phoneNumber: string;
  formattedNumber: string;
  areaCode: string;
  capabilities: {
    sms: boolean;
    mms: boolean;
    voice: boolean;
  };
  monthlyPrice: number;
}

interface SearchOptions {
  areaCode?: string;
  contains?: string;
  state?: string;
  limit?: number;
}

export class PhoneNumberService {
  // ===========================================
  // Search Available Numbers
  // ===========================================

  /**
   * Search for available phone numbers to purchase
   */
  async searchAvailableNumbers(options: SearchOptions): Promise<AvailableNumber[]> {
    logger.info({ options }, 'Searching available phone numbers');

    try {
      const numbers = await signalmashService.listAvailableNumbers({
        areaCode: options.areaCode,
        contains: options.contains,
        limit: options.limit || 20,
      });

      return numbers.map((n) => ({
        phoneNumber: n.phoneNumber,
        formattedNumber: n.formattedNumber,
        areaCode: n.phoneNumber.slice(2, 5), // Extract area code from +1XXXNNNNNNN
        capabilities: {
          sms: n.capabilities.sms,
          mms: n.capabilities.mms,
          voice: n.capabilities.voice,
        },
        monthlyPrice: n.monthlyPrice,
      }));
    } catch (error) {
      logger.error({ error }, 'Failed to search available numbers');
      throw error;
    }
  }

  // ===========================================
  // Purchase Number
  // ===========================================

  /**
   * Purchase a phone number for an organization
   */
  async purchaseNumber(
    organizationId: string,
    phoneNumber: string,
    options: {
      campaignId?: string;
      friendlyName?: string;
    } = {}
  ) {
    logger.info({ organizationId, phoneNumber }, 'Purchasing phone number');

    // Check if number is already owned
    const existing = await prisma.phoneNumber.findUnique({
      where: { phoneNumber },
    });

    if (existing) {
      throw new AppError('Phone number is already owned', 'NUMBER_ALREADY_OWNED', 400);
    }

    // Validate campaign if provided
    if (options.campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: options.campaignId,
          organizationId,
        },
      });

      if (!campaign) {
        throw new AppError('Campaign not found', 'CAMPAIGN_NOT_FOUND', 404);
      }

      if (campaign.status !== 'approved') {
        throw new AppError(
          'Campaign must be approved before assigning phone numbers',
          'CAMPAIGN_NOT_APPROVED',
          400
        );
      }
    }

    try {
      // Purchase from Signalmash
      const result = await signalmashService.purchaseNumber(
        phoneNumber,
        options.campaignId || ''
      );

      // Extract area code
      const areaCode = phoneNumber.replace(/\D/g, '').slice(1, 4);

      // Store in database
      const number = await prisma.phoneNumber.create({
        data: {
          phoneNumber,
          formattedNumber: this.formatPhoneNumber(phoneNumber),
          friendlyName: options.friendlyName,
          areaCode,
          signalmashNumberId: result.numberId,
          status: 'active',
          organizationId,
          campaignId: options.campaignId,
          smsCapable: true,
          mmsCapable: true,
          voiceCapable: false,
        },
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      });

      logger.info({ numberId: number.id, phoneNumber }, 'Phone number purchased');

      return number;
    } catch (error) {
      logger.error({ error, phoneNumber }, 'Failed to purchase phone number');
      throw error;
    }
  }

  // ===========================================
  // List Organization Numbers
  // ===========================================

  /**
   * Get all phone numbers for an organization
   */
  async getOrganizationNumbers(
    organizationId: string,
    options: {
      status?: PhoneNumberStatus;
      campaignId?: string;
      page?: number;
      limit?: number;
    } = {}
  ) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = { organizationId };

    if (options.status) {
      where.status = options.status;
    }

    if (options.campaignId) {
      where.campaignId = options.campaignId;
    }

    const [numbers, total] = await Promise.all([
      prisma.phoneNumber.findMany({
        where,
        skip,
        take: limit,
        include: {
          campaign: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
          _count: {
            select: {
              messages: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.phoneNumber.count({ where }),
    ]);

    return {
      data: numbers,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ===========================================
  // Get Single Number
  // ===========================================

  /**
   * Get a single phone number by ID
   */
  async getNumber(organizationId: string, numberId: string) {
    const number = await prisma.phoneNumber.findFirst({
      where: {
        id: numberId,
        organizationId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
            brand: {
              select: {
                id: true,
                displayName: true,
              },
            },
          },
        },
        _count: {
          select: {
            messages: true,
          },
        },
      },
    });

    if (!number) {
      throw new AppError('Phone number not found', 'NUMBER_NOT_FOUND', 404);
    }

    return number;
  }

  // ===========================================
  // Update Number
  // ===========================================

  /**
   * Update a phone number's settings
   */
  async updateNumber(
    organizationId: string,
    numberId: string,
    data: {
      friendlyName?: string;
      campaignId?: string | null;
    }
  ) {
    const number = await this.getNumber(organizationId, numberId);

    // Validate new campaign if provided
    if (data.campaignId) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          id: data.campaignId,
          organizationId,
        },
      });

      if (!campaign) {
        throw new AppError('Campaign not found', 'CAMPAIGN_NOT_FOUND', 404);
      }

      if (campaign.status !== 'approved') {
        throw new AppError(
          'Campaign must be approved before assigning phone numbers',
          'CAMPAIGN_NOT_APPROVED',
          400
        );
      }
    }

    const updated = await prisma.phoneNumber.update({
      where: { id: numberId },
      data: {
        friendlyName: data.friendlyName,
        campaignId: data.campaignId,
      },
      include: {
        campaign: {
          select: {
            id: true,
            name: true,
            status: true,
          },
        },
      },
    });

    logger.info({ numberId }, 'Phone number updated');

    return updated;
  }

  // ===========================================
  // Release Number
  // ===========================================

  /**
   * Release (delete) a phone number
   */
  async releaseNumber(organizationId: string, numberId: string) {
    const number = await this.getNumber(organizationId, numberId);

    try {
      // Release from Signalmash
      if (number.signalmashNumberId) {
        await signalmashService.releaseNumber(number.signalmashNumberId);
      }

      // Update status in database (keep record for history)
      await prisma.phoneNumber.update({
        where: { id: numberId },
        data: {
          status: 'released',
          campaignId: null,
        },
      });

      logger.info({ numberId, phoneNumber: number.phoneNumber }, 'Phone number released');

      return { success: true };
    } catch (error) {
      logger.error({ error, numberId }, 'Failed to release phone number');
      throw error;
    }
  }

  // ===========================================
  // Stats
  // ===========================================

  /**
   * Get phone number stats for an organization
   */
  async getStats(organizationId: string) {
    const [total, active, pending, byAreaCode] = await Promise.all([
      prisma.phoneNumber.count({
        where: { organizationId },
      }),
      prisma.phoneNumber.count({
        where: { organizationId, status: 'active' },
      }),
      prisma.phoneNumber.count({
        where: { organizationId, status: 'pending' },
      }),
      prisma.phoneNumber.groupBy({
        by: ['areaCode'],
        where: { organizationId, status: 'active' },
        _count: { _all: true },
        orderBy: { _count: { areaCode: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      total,
      active,
      pending,
      released: total - active - pending,
      byAreaCode: byAreaCode.map((g) => ({
        areaCode: g.areaCode,
        count: g._count._all,
      })),
    };
  }

  // ===========================================
  // Helpers
  // ===========================================

  private formatPhoneNumber(phoneNumber: string): string {
    const cleaned = phoneNumber.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `+1 (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    if (cleaned.length === 10) {
      return `+1 (${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phoneNumber;
  }
}

export const phoneNumberService = new PhoneNumberService();
