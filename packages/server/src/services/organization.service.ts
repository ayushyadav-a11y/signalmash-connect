// ===========================================
// Organization Service
// ===========================================

import { prisma } from '../config/database.js';
import { NotFoundError } from '../utils/errors.js';
import type { Organization, User } from '@prisma/client';

interface UpdateOrganizationInput {
  name?: string;
  email?: string;
  phone?: string;
  website?: string;
  logoUrl?: string;
}

interface AddUserInput {
  email: string;
  firstName: string;
  lastName: string;
  role?: 'admin' | 'member';
  passwordHash: string;
}

export class OrganizationService {
  /**
   * Get organization by ID
   */
  async getById(id: string): Promise<Organization> {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return organization;
  }

  /**
   * Get organization with all related data
   */
  async getWithDetails(id: string): Promise<Organization & {
    users: User[];
    _count: {
      brands: number;
      campaigns: number;
      platformConnections: number;
      phoneNumbers: number;
      messages: number;
    };
  }> {
    const organization = await prisma.organization.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            avatarUrl: true,
            lastLoginAt: true,
            createdAt: true,
            updatedAt: true,
            organizationId: true,
            emailVerified: true,
            passwordHash: true,
          },
        },
        _count: {
          select: {
            brands: true,
            campaigns: true,
            platformConnections: true,
            phoneNumbers: true,
            messages: true,
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return organization as Organization & {
      users: User[];
      _count: {
        brands: number;
        campaigns: number;
        platformConnections: number;
        phoneNumbers: number;
        messages: number;
      };
    };
  }

  /**
   * Update organization
   */
  async update(id: string, data: UpdateOrganizationInput): Promise<Organization> {
    const organization = await prisma.organization.findUnique({
      where: { id },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return prisma.organization.update({
      where: { id },
      data,
    });
  }

  /**
   * Get organization users
   */
  async getUsers(organizationId: string): Promise<Omit<User, 'passwordHash'>[]> {
    const users = await prisma.user.findMany({
      where: { organizationId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        emailVerified: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        organizationId: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users as Omit<User, 'passwordHash'>[];
  }

  /**
   * Add user to organization
   */
  async addUser(organizationId: string, data: AddUserInput): Promise<User> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
    });

    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    return prisma.user.create({
      data: {
        ...data,
        organizationId,
        role: data.role ?? 'member',
      },
    });
  }

  /**
   * Remove user from organization
   */
  async removeUser(organizationId: string, userId: string): Promise<void> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found in organization');
    }

    if (user.role === 'owner') {
      throw new Error('Cannot remove the organization owner');
    }

    await prisma.user.delete({
      where: { id: userId },
    });
  }

  /**
   * Update user role
   */
  async updateUserRole(
    organizationId: string,
    userId: string,
    role: 'admin' | 'member'
  ): Promise<User> {
    const user = await prisma.user.findFirst({
      where: {
        id: userId,
        organizationId,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found in organization');
    }

    if (user.role === 'owner') {
      throw new Error('Cannot change the role of the organization owner');
    }

    return prisma.user.update({
      where: { id: userId },
      data: { role },
    });
  }

  /**
   * Get organization statistics
   */
  async getStats(organizationId: string): Promise<{
    totalMessages: number;
    messagesSent: number;
    messagesDelivered: number;
    messagesFailed: number;
    connectedPlatforms: number;
    activeCampaigns: number;
    verifiedBrands: number;
  }> {
    const [
      messageStats,
      platformCount,
      campaignCount,
      brandCount,
    ] = await Promise.all([
      prisma.message.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      prisma.platformConnection.count({
        where: {
          organizationId,
          status: 'connected',
        },
      }),
      prisma.campaign.count({
        where: {
          organizationId,
          status: 'approved',
        },
      }),
      prisma.brand.count({
        where: {
          organizationId,
          status: 'verified',
        },
      }),
    ]);

    const stats = {
      totalMessages: 0,
      messagesSent: 0,
      messagesDelivered: 0,
      messagesFailed: 0,
      connectedPlatforms: platformCount,
      activeCampaigns: campaignCount,
      verifiedBrands: brandCount,
    };

    for (const stat of messageStats) {
      stats.totalMessages += stat._count;
      if (stat.status === 'sent' || stat.status === 'delivered') {
        stats.messagesSent += stat._count;
      }
      if (stat.status === 'delivered') {
        stats.messagesDelivered += stat._count;
      }
      if (stat.status === 'failed' || stat.status === 'undelivered') {
        stats.messagesFailed += stat._count;
      }
    }

    return stats;
  }
}

export const organizationService = new OrganizationService();
