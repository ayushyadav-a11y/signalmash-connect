// ===========================================
// Campaign Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { NotFoundError, BadRequestError, AppError, ExternalServiceError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Campaign, CampaignStatus, CampaignUseCase } from '@prisma/client';
import { integrationService } from './integration.service.js';

interface CreateCampaignInput {
  organizationId: string;
  brandId: string;
  name: string;
  description: string;
  useCase: CampaignUseCase;
  subUsecases?: string[];
  embeddedLink?: boolean;
  embeddedPhone?: boolean;
  affiliateMarketing?: boolean;
  termsAndConditions?: boolean;
  numberPool?: boolean;
  ageGated?: boolean;
  directLending?: boolean;
  subscriberOptin?: boolean;
  subscriberOptout?: boolean;
  subscriberHelp?: boolean;
  sampleMessages: string[];
  messageFlow?: string;
  mnoIds?: string[];
  referenceId?: string;
  tags?: string[];
  autoRenewal?: boolean;
  optInKeywords?: string[];
  optOutKeywords?: string[];
  helpKeywords?: string[];
  optInMessage?: string;
  optOutMessage?: string;
  helpMessage?: string;
  privacyPolicyLink?: string;
  termsAndConditionsLink?: string;
  embeddedLinkSample?: string;
}

interface UpdateCampaignInput {
  name?: string;
  description?: string;
  useCase?: CampaignUseCase;
  subUsecases?: string[];
  embeddedLink?: boolean;
  embeddedPhone?: boolean;
  affiliateMarketing?: boolean;
  termsAndConditions?: boolean;
  numberPool?: boolean;
  ageGated?: boolean;
  directLending?: boolean;
  subscriberOptin?: boolean;
  subscriberOptout?: boolean;
  subscriberHelp?: boolean;
  sampleMessages?: string[];
  messageFlow?: string;
  mnoIds?: string[];
  referenceId?: string;
  tags?: string[];
  autoRenewal?: boolean;
  optInKeywords?: string[];
  optOutKeywords?: string[];
  helpKeywords?: string[];
  optInMessage?: string;
  optOutMessage?: string;
  helpMessage?: string;
  privacyPolicyLink?: string;
  termsAndConditionsLink?: string;
  embeddedLinkSample?: string;
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
        subUsecases: data.subUsecases ?? [],
        embeddedLink: data.embeddedLink ?? false,
        embeddedPhone: data.embeddedPhone ?? false,
        affiliateMarketing: data.affiliateMarketing ?? false,
        termsAndConditions: data.termsAndConditions ?? true,
        numberPool: data.numberPool ?? false,
        ageGated: data.ageGated ?? false,
        directLending: data.directLending ?? false,
        subscriberOptin: data.subscriberOptin ?? true,
        subscriberOptout: data.subscriberOptout ?? true,
        subscriberHelp: data.subscriberHelp ?? true,
        sampleMessages: data.sampleMessages,
        messageFlow: data.messageFlow ?? data.description,
        mnoIds: data.mnoIds ?? [],
        referenceId: data.referenceId ?? null,
        tags: data.tags ?? [],
        autoRenewal: data.autoRenewal ?? true,
        optInKeywords: data.optInKeywords ?? ['START', 'YES', 'SUBSCRIBE'],
        optOutKeywords: data.optOutKeywords ?? ['STOP', 'UNSUBSCRIBE', 'CANCEL'],
        helpKeywords: data.helpKeywords ?? ['HELP', 'INFO'],
        optInMessage: data.optInMessage ?? 'You have been subscribed to receive messages. Reply STOP to unsubscribe.',
        optOutMessage: data.optOutMessage ?? 'You have been unsubscribed and will no longer receive messages from us.',
        helpMessage: data.helpMessage ?? 'For assistance, please contact us at support@example.com',
        privacyPolicyLink: data.privacyPolicyLink ?? null,
        termsAndConditionsLink: data.termsAndConditionsLink ?? null,
        embeddedLinkSample: data.embeddedLinkSample ?? null,
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

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: {
        ...data,
        status: campaign.status === 'rejected' ? 'draft' : campaign.status,
        rejectionReason: campaign.status === 'rejected' ? null : undefined,
      },
    });

    if (updatedCampaign.signalmashCampaignId) {
      const brand = await prisma.brand.findFirst({
        where: {
          id: updatedCampaign.brandId,
          organizationId,
        },
      });

      if (!brand?.signalmashBrandId) {
        throw new BadRequestError('Brand provider mapping is required before updating a provider campaign');
      }

      try {
        const signalmashResult = await signalmashService.updateCampaign({
          campaignId: updatedCampaign.signalmashCampaignId,
          brandId: brand.signalmashBrandId,
          name: updatedCampaign.name,
          description: updatedCampaign.description,
          useCase: updatedCampaign.useCase,
          subUsecases: updatedCampaign.subUsecases as string[],
          embeddedLink: updatedCampaign.embeddedLink,
          embeddedPhone: updatedCampaign.embeddedPhone,
          affiliateMarketing: updatedCampaign.affiliateMarketing,
          termsAndConditions: updatedCampaign.termsAndConditions,
          numberPool: updatedCampaign.numberPool,
          ageGated: updatedCampaign.ageGated,
          directLending: updatedCampaign.directLending,
          subscriberOptin: updatedCampaign.subscriberOptin,
          subscriberOptout: updatedCampaign.subscriberOptout,
          subscriberHelp: updatedCampaign.subscriberHelp,
          sampleMessages: updatedCampaign.sampleMessages as string[],
          messageFlow: updatedCampaign.messageFlow,
          mnoIds: updatedCampaign.mnoIds as string[],
          referenceId: updatedCampaign.referenceId ?? undefined,
          tag: updatedCampaign.tags as string[],
          autoRenewal: updatedCampaign.autoRenewal,
          optInKeywords: updatedCampaign.optInKeywords as string[],
          optOutKeywords: updatedCampaign.optOutKeywords as string[],
          helpKeywords: updatedCampaign.helpKeywords as string[],
          optInMessage: updatedCampaign.optInMessage,
          optOutMessage: updatedCampaign.optOutMessage,
          helpMessage: updatedCampaign.helpMessage,
          privacyPolicyLink: updatedCampaign.privacyPolicyLink ?? undefined,
          termsAndConditionsLink: updatedCampaign.termsAndConditionsLink ?? undefined,
          embeddedLinkSample: updatedCampaign.embeddedLinkSample ?? undefined,
        });

        const syncedCampaign = await prisma.campaign.update({
          where: { id },
          data: {
            tcrCampaignId: signalmashResult.tcrCampaignId ?? updatedCampaign.tcrCampaignId,
            dailyMessageLimit: signalmashResult.dailyMessageLimit ?? updatedCampaign.dailyMessageLimit,
            messagesPerSecond: signalmashResult.messagesPerSecond ?? updatedCampaign.messagesPerSecond,
          },
        });

        await integrationService.syncCampaignMapping(syncedCampaign);

        return syncedCampaign;
      } catch (error) {
        if (error instanceof ExternalServiceError) {
          throw new AppError(
            'Campaign was updated locally, but pushing the changes to Signalmash failed.',
            'PROVIDER_CAMPAIGN_UPDATE_FAILED',
            502,
            true,
            {
              provider: 'signalmash',
              operation: 'update_campaign',
              campaignId: updatedCampaign.id,
              signalmashCampaignId: updatedCampaign.signalmashCampaignId,
              upstreamMessage: error.message,
            }
          );
        }

        throw error;
      }
    }

    return updatedCampaign;
  }

  /**
   * Submit campaign for approval
   */
  async submitForApproval(_id: string, _organizationId: string): Promise<Campaign> {
    throw new BadRequestError(
      'In-app campaign registration is disabled. Link an existing Signalmash campaign from Phone Numbers instead.'
    );
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
    },
    tcrCampaignId?: string
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
        tcrCampaignId: tcrCampaignId ?? campaign.tcrCampaignId,
      },
    });

    logger.info(
      { campaignId: campaign.id, status },
      'Campaign approval status updated'
    );

    await integrationService.syncCampaignMapping(updatedCampaign);

    return updatedCampaign;
  }

  async refreshApprovalStatus(id: string, organizationId: string): Promise<Campaign> {
    const campaign = await this.getById(id, organizationId);

    if (!campaign.signalmashCampaignId) {
      throw new BadRequestError('Campaign has not been submitted to Signalmash yet');
    }

    try {
      const providerStatus = await signalmashService.getCampaignStatus(campaign.signalmashCampaignId);
      const nextStatus = this.mapProviderCampaignStatus(providerStatus.status, campaign.status);

      const updatedCampaign = await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: nextStatus,
          rejectionReason:
            providerStatus.rejectionReason ??
            (nextStatus === 'rejected' ? campaign.rejectionReason : null),
          dailyMessageLimit: providerStatus.dailyMessageLimit ?? campaign.dailyMessageLimit,
          messagesPerSecond: providerStatus.messagesPerSecond ?? campaign.messagesPerSecond,
          tcrCampaignId: providerStatus.tcrCampaignId ?? campaign.tcrCampaignId,
        },
      });

      logger.info(
        {
          campaignId: campaign.id,
          signalmashCampaignId: campaign.signalmashCampaignId,
          providerStatus: providerStatus.status,
          nextStatus,
          tcrCampaignId: updatedCampaign.tcrCampaignId,
        },
        'Campaign approval status refreshed from Signalmash'
      );

      await integrationService.syncCampaignMapping(updatedCampaign);

      return updatedCampaign;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new AppError(
          'Unable to refresh campaign status from Signalmash right now.',
          'PROVIDER_STATUS_REFRESH_FAILED',
          503,
          true,
          {
            provider: 'signalmash',
            operation: 'refresh_campaign_status',
            campaignId: campaign.id,
            signalmashCampaignId: campaign.signalmashCampaignId,
            upstreamMessage: error.message,
          }
        );
      }

      throw error;
    }
  }

  private mapProviderCampaignStatus(providerStatus: string, currentStatus: CampaignStatus): CampaignStatus {
    const normalized = providerStatus.trim().toLowerCase();

    if (['approved', 'active', 'verified'].includes(normalized)) {
      return 'approved';
    }

    if (['rejected', 'declined', 'failed'].includes(normalized)) {
      return 'rejected';
    }

    if (['suspended'].includes(normalized)) {
      return 'suspended';
    }

    if (['expired'].includes(normalized)) {
      return 'expired';
    }

    if (['pending', 'pending_approval', 'submitted', 'in_review', 'review'].includes(normalized)) {
      return 'pending_approval';
    }

    return currentStatus;
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
