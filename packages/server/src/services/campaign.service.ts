// ===========================================
// Campaign Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Campaign, CampaignStatus, CampaignUseCase } from '@prisma/client';

interface CreateCampaignInput {
  organizationId: string;
  brandId: string;
  name: string;
  description: string;
  useCase: CampaignUseCase;
  sampleMessages: string[];
  optInKeywords?: string[];
  optOutKeywords?: string[];
  helpKeywords?: string[];
  optInMessage?: string;
  optOutMessage?: string;
  helpMessage?: string;
}

interface UpdateCampaignInput {
  name?: string;
  description?: string;
  useCase?: CampaignUseCase;
  sampleMessages?: string[];
  optInKeywords?: string[];
  optOutKeywords?: string[];
  helpKeywords?: string[];
  optInMessage?: string;
  optOutMessage?: string;
  helpMessage?: string;
}

export class CampaignService {
  /**
   * Create a new campaign (draft status)
   */
  async create(data: CreateCampaignInput): Promise<Campaign> {
    // Verify brand exists and belongs to organization
    const brand = await prisma.brand.findFirst({
      where: {
        id: data.brandId,
        organizationId: data.organizationId,
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    // Brand must be verified to create campaigns
    if (brand.status !== 'verified') {
      throw new BadRequestError('Brand must be verified before creating campaigns');
    }

    // Validate sample messages
    if (data.sampleMessages.length < 1) {
      throw new BadRequestError('At least one sample message is required');
    }

    if (data.sampleMessages.length > 5) {
      throw new BadRequestError('Maximum 5 sample messages allowed');
    }

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: data.organizationId,
        brandId: data.brandId,
        name: data.name,
        description: data.description,
        useCase: data.useCase,
        sampleMessages: data.sampleMessages,
        optInKeywords: data.optInKeywords ?? ['START', 'YES', 'SUBSCRIBE'],
        optOutKeywords: data.optOutKeywords ?? ['STOP', 'UNSUBSCRIBE', 'CANCEL'],
        helpKeywords: data.helpKeywords ?? ['HELP', 'INFO'],
        optInMessage: data.optInMessage ?? 'You have been subscribed to receive messages. Reply STOP to unsubscribe.',
        optOutMessage: data.optOutMessage ?? 'You have been unsubscribed and will no longer receive messages from us.',
        helpMessage: data.helpMessage ?? 'For assistance, please contact us at support@example.com',
        status: 'draft',
      },
    });

    logger.info({ campaignId: campaign.id, brandId: data.brandId }, 'Campaign created');

    return campaign;
  }

  /**
   * Get campaign by ID
   */
  async getById(id: string, organizationId: string): Promise<Campaign> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    return campaign;
  }

  /**
   * Get all campaigns for an organization
   */
  async getByOrganization(
    organizationId: string,
    options?: {
      brandId?: string;
      status?: CampaignStatus;
    }
  ): Promise<Campaign[]> {
    return prisma.campaign.findMany({
      where: {
        organizationId,
        ...(options?.brandId && { brandId: options.brandId }),
        ...(options?.status && { status: options.status }),
      },
      include: {
        brand: {
          select: {
            id: true,
            displayName: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update campaign
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateCampaignInput
  ): Promise<Campaign> {
    const campaign = await this.getById(id, organizationId);

    if (!['draft', 'rejected'].includes(campaign.status)) {
      throw new BadRequestError('Cannot update campaign in current status');
    }

    return prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        status: campaign.status === 'rejected' ? 'draft' : campaign.status,
        rejectionReason: campaign.status === 'rejected' ? null : undefined,
      },
    });
  }

  /**
   * Submit campaign for approval
   */
  async submitForApproval(id: string, organizationId: string): Promise<Campaign> {
    const campaign = await this.getById(id, organizationId);

    if (campaign.status !== 'draft' && campaign.status !== 'rejected') {
      throw new BadRequestError('Campaign is not in a submittable status');
    }

    // Get the brand to verify it's verified
    const brand = await prisma.brand.findFirst({
      where: { id: campaign.brandId },
    });

    if (!brand || brand.status !== 'verified') {
      throw new BadRequestError('Brand must be verified before submitting campaign');
    }

    try {
      // Parse sample messages from JSON
      const sampleMessages = campaign.sampleMessages as string[];

      // Submit to Signalmash
      const signalmashResult = await signalmashService.registerCampaign({
        brandId: brand.signalmashBrandId!,
        name: campaign.name,
        description: campaign.description,
        useCase: campaign.useCase,
        sampleMessages,
        optInKeywords: campaign.optInKeywords as string[],
        optOutKeywords: campaign.optOutKeywords as string[],
        helpKeywords: campaign.helpKeywords as string[],
        optInMessage: campaign.optInMessage,
        optOutMessage: campaign.optOutMessage,
        helpMessage: campaign.helpMessage,
      });

      // Update campaign with Signalmash IDs
      const updatedCampaign = await prisma.campaign.update({
        where: { id },
        data: {
          signalmashCampaignId: signalmashResult.campaignId,
          tcrCampaignId: signalmashResult.tcrCampaignId,
          status: 'pending_approval',
          dailyMessageLimit: signalmashResult.dailyMessageLimit,
          messagesPerSecond: signalmashResult.messagesPerSecond,
        },
      });

      logger.info(
        { campaignId: id, signalmashCampaignId: signalmashResult.campaignId },
        'Campaign submitted for approval'
      );

      return updatedCampaign;
    } catch (error) {
      logger.error({ campaignId: id, error }, 'Failed to submit campaign for approval');
      throw error;
    }
  }

  /**
   * Handle approval webhook from Signalmash
   */
  async handleApprovalResult(
    signalmashCampaignId: string,
    status: 'approved' | 'rejected' | 'suspended' | 'expired',
    rejectionReason?: string,
    throughput?: {
      dailyMessageLimit?: number;
      messagesPerSecond?: number;
    }
  ): Promise<Campaign> {
    const campaign = await prisma.campaign.findFirst({
      where: { signalmashCampaignId },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id: campaign.id },
      data: {
        status,
        rejectionReason,
        dailyMessageLimit: throughput?.dailyMessageLimit,
        messagesPerSecond: throughput?.messagesPerSecond,
      },
    });

    logger.info(
      { campaignId: campaign.id, status },
      'Campaign approval status updated'
    );

    return updatedCampaign;
  }

  /**
   * Delete campaign (only draft campaigns)
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const campaign = await this.getById(id, organizationId);

    if (campaign.status !== 'draft') {
      throw new BadRequestError('Only draft campaigns can be deleted');
    }

    await prisma.campaign.delete({
      where: { id },
    });

    logger.info({ campaignId: id }, 'Campaign deleted');
  }

  /**
   * Get campaign with phone numbers
   */
  async getWithPhoneNumbers(id: string, organizationId: string): Promise<Campaign & {
    phoneNumbers: Array<{
      id: string;
      phoneNumber: string;
      formattedNumber: string;
      status: string;
    }>;
  }> {
    const campaign = await prisma.campaign.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        phoneNumbers: {
          select: {
            id: true,
            phoneNumber: true,
            formattedNumber: true,
            status: true,
          },
        },
      },
    });

    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    return campaign;
  }
}

export const campaignService = new CampaignService();
