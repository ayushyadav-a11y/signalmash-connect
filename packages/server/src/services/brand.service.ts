// ===========================================
// Brand Registration Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { NotFoundError, BadRequestError, ConflictError, AppError, ExternalServiceError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Brand, BrandStatus, EntityType, BusinessVertical, BrandRelationship } from '@prisma/client';
import { integrationService } from './integration.service.js';

interface CreateBrandInput {
  organizationId: string;
  legalName: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  ein?: string;
  einIssuingCountry?: string;
  entityType: EntityType;
  providerEntityType?: string;
  vertical: BusinessVertical;
  providerVertical?: string;
  brandRelationship?: BrandRelationship;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  website: string;
  phone: string;
  mobilePhone?: string;
  email: string;
  businessContactEmail?: string;
  stockSymbol?: string;
  stockExchange?: string;
  ipAddress?: string;
  altBusinessId?: string;
  altBusinessIdType?: string;
  referenceId?: string;
  tags?: string[];
}

interface UpdateBrandInput {
  legalName?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  ein?: string;
  einIssuingCountry?: string;
  entityType?: EntityType;
  providerEntityType?: string;
  vertical?: BusinessVertical;
  providerVertical?: string;
  brandRelationship?: BrandRelationship;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  phone?: string;
  mobilePhone?: string;
  email?: string;
  businessContactEmail?: string;
  stockSymbol?: string;
  stockExchange?: string;
  ipAddress?: string;
  altBusinessId?: string;
  altBusinessIdType?: string;
  referenceId?: string;
  tags?: string[];
}

export class BrandService {
  /**
   * Create a new brand (draft status)
   */
  async create(data: CreateBrandInput): Promise<Brand> {
    // Check if organization already has a brand with same legal name
    const existingBrand = await prisma.brand.findFirst({
      where: {
        organizationId: data.organizationId,
        legalName: data.legalName,
      },
    });

    if (existingBrand) {
      throw new ConflictError('A brand with this legal name already exists');
    }

    const brand = await prisma.brand.create({
      data: {
        ...data,
        country: data.country ?? 'US',
        providerEntityType: data.providerEntityType ?? null,
        providerVertical: data.providerVertical ?? null,
        tags: data.tags ?? [],
        status: 'draft',
      },
    });

    logger.info({ brandId: brand.id }, 'Brand created');

    return brand;
  }

  /**
   * Get brand by ID
   */
  async getById(id: string, organizationId: string): Promise<Brand> {
    const brand = await prisma.brand.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    return brand;
  }

  /**
   * Get all brands for an organization
   */
  async getByOrganization(organizationId: string): Promise<Brand[]> {
    return prisma.brand.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Update brand (only allowed for draft or unverified status)
   */
  async update(
    id: string,
    organizationId: string,
    data: UpdateBrandInput
  ): Promise<Brand> {
    const brand = await this.getById(id, organizationId);

    if (!['draft', 'unverified', 'rejected'].includes(brand.status)) {
      throw new BadRequestError('Cannot update brand in current status');
    }

    return prisma.brand.update({
      where: { id },
      data: {
        ...data,
        // Reset status if significant changes are made
        status: brand.status === 'rejected' ? 'draft' : brand.status,
        rejectionReason: brand.status === 'rejected' ? null : brand.rejectionReason,
      },
    });
  }

  /**
   * Submit brand for verification
   */
  async submitForVerification(_id: string, _organizationId: string): Promise<Brand> {
    throw new BadRequestError(
      'In-app brand registration is disabled. Link an existing Signalmash brand from Phone Numbers instead.'
    );
  }

  /**
   * Handle verification webhook from Signalmash
   */
  async handleVerificationResult(
    signalmashBrandId: string,
    status: 'verified' | 'unverified' | 'rejected',
    verificationScore?: number,
    rejectionReason?: string,
    tcrBrandId?: string
  ): Promise<Brand> {
    const brand = await prisma.brand.findFirst({
      where: { signalmashBrandId },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    const updatedBrand = await prisma.brand.update({
      where: { id: brand.id },
      data: {
        status,
        verificationScore,
        rejectionReason,
        tcrBrandId: tcrBrandId ?? brand.tcrBrandId,
      },
    });

    logger.info(
      { brandId: brand.id, status, verificationScore },
      'Brand verification status updated'
    );

    await integrationService.syncBrandMapping(updatedBrand);

    return updatedBrand;
  }

  async refreshVerificationStatus(id: string, organizationId: string): Promise<Brand> {
    const brand = await this.getById(id, organizationId);

    if (!brand.signalmashBrandId) {
      throw new BadRequestError('Brand has not been submitted to Signalmash yet');
    }

    try {
      const providerStatus = await signalmashService.getBrandStatus(brand.signalmashBrandId);
      const nextStatus = this.mapProviderBrandStatus(providerStatus.status, brand.status);

      const updatedBrand = await prisma.brand.update({
        where: { id: brand.id },
        data: {
          status: nextStatus,
          verificationScore: providerStatus.verificationScore ?? brand.verificationScore,
          rejectionReason: providerStatus.rejectionReason ?? (nextStatus === 'rejected' ? brand.rejectionReason : null),
          tcrBrandId: providerStatus.tcrBrandId ?? brand.tcrBrandId,
          referenceId: providerStatus.referenceId ?? brand.referenceId,
        },
      });

      logger.info(
        {
          brandId: brand.id,
          signalmashBrandId: brand.signalmashBrandId,
          providerStatus: providerStatus.status,
          nextStatus,
          tcrBrandId: updatedBrand.tcrBrandId,
        },
        'Brand verification status refreshed from Signalmash'
      );

      await integrationService.syncBrandMapping(updatedBrand);

      return updatedBrand;
    } catch (error) {
      if (error instanceof ExternalServiceError) {
        throw new AppError(
          'Unable to refresh brand status from Signalmash right now.',
          'PROVIDER_STATUS_REFRESH_FAILED',
          503,
          true,
          {
            provider: 'signalmash',
            operation: 'refresh_brand_status',
            brandId: brand.id,
            signalmashBrandId: brand.signalmashBrandId,
            upstreamMessage: error.message,
          }
        );
      }

      throw error;
    }
  }

  private mapProviderBrandStatus(providerStatus: string, currentStatus: BrandStatus): BrandStatus {
    const normalized = providerStatus.trim().toLowerCase();

    if (['active', 'verified', 'approved'].includes(normalized)) {
      return 'verified';
    }

    if (['rejected', 'declined', 'failed'].includes(normalized)) {
      return 'rejected';
    }

    if (['unverified', 'needs_info'].includes(normalized)) {
      return 'unverified';
    }

    if (['pending', 'pending_verification', 'in_review', 'submitted', 'review'].includes(normalized)) {
      return 'pending_verification';
    }

    return currentStatus;
  }

  /**
   * Delete brand (only draft brands)
   */
  async delete(id: string, organizationId: string): Promise<void> {
    const brand = await this.getById(id, organizationId);

    if (brand.status !== 'draft') {
      throw new BadRequestError('Only draft brands can be deleted');
    }

    await prisma.brand.delete({
      where: { id },
    });

    logger.info({ brandId: id }, 'Brand deleted');
  }

  /**
   * Get brand with campaigns
   */
  async getWithCampaigns(id: string, organizationId: string): Promise<Brand & {
    campaigns: Array<{
      id: string;
      name: string;
      status: string;
      useCase: string;
    }>;
  }> {
    const brand = await prisma.brand.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        campaigns: {
          select: {
            id: true,
            name: true,
            status: true,
            useCase: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!brand) {
      throw new NotFoundError('Brand not found');
    }

    return brand;
  }
}

export const brandService = new BrandService();
