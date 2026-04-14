// ===========================================
// Brand Registration Service
// ===========================================

import { prisma } from '../config/database.js';
import { signalmashService } from './signalmash.service.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Brand, BrandStatus, EntityType, BusinessVertical } from '@prisma/client';

interface CreateBrandInput {
  organizationId: string;
  legalName: string;
  displayName: string;
  ein?: string;
  entityType: EntityType;
  vertical: BusinessVertical;
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country?: string;
  website: string;
  phone: string;
  email: string;
}

interface UpdateBrandInput {
  legalName?: string;
  displayName?: string;
  ein?: string;
  entityType?: EntityType;
  vertical?: BusinessVertical;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  website?: string;
  phone?: string;
  email?: string;
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
  async submitForVerification(id: string, organizationId: string): Promise<Brand> {
    const brand = await this.getById(id, organizationId);

    if (brand.status !== 'draft' && brand.status !== 'unverified' && brand.status !== 'rejected') {
      throw new BadRequestError('Brand is not in a submittable status');
    }

    // Validate required fields
    if (!brand.ein && brand.entityType !== 'sole_proprietor') {
      throw new BadRequestError('EIN is required for non-sole proprietor entities');
    }

    try {
      // Submit to Signalmash
      const signalmashResult = await signalmashService.registerBrand({
        legalName: brand.legalName,
        displayName: brand.displayName,
        ein: brand.ein ?? undefined,
        entityType: brand.entityType,
        vertical: brand.vertical,
        streetAddress: brand.streetAddress,
        city: brand.city,
        state: brand.state,
        postalCode: brand.postalCode,
        country: brand.country,
        website: brand.website,
        phone: brand.phone,
        email: brand.email,
      });

      // Update brand with Signalmash IDs
      const updatedBrand = await prisma.brand.update({
        where: { id },
        data: {
          signalmashBrandId: signalmashResult.brandId,
          tcrBrandId: signalmashResult.tcrBrandId,
          status: 'pending_verification',
          verificationScore: signalmashResult.verificationScore,
        },
      });

      logger.info({ brandId: id, signalmashBrandId: signalmashResult.brandId }, 'Brand submitted for verification');

      return updatedBrand;
    } catch (error) {
      logger.error({ brandId: id, error }, 'Failed to submit brand for verification');
      throw error;
    }
  }

  /**
   * Handle verification webhook from Signalmash
   */
  async handleVerificationResult(
    signalmashBrandId: string,
    status: 'verified' | 'unverified' | 'rejected',
    verificationScore?: number,
    rejectionReason?: string
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
      },
    });

    logger.info(
      { brandId: brand.id, status, verificationScore },
      'Brand verification status updated'
    );

    return updatedBrand;
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
