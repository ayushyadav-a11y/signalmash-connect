// ===========================================
// Port Order Service
// ===========================================

import { Prisma } from '@prisma/client';
import { prisma } from '../config/database.js';
import { BadRequestError, NotFoundError } from '../utils/errors.js';
import { integrationService } from './integration.service.js';

const ACTIVE_PORT_STATUSES = ['submitted', 'awaiting_documents', 'in_progress'] as const;

const ALLOWED_STATUS_TRANSITIONS: Record<
  'draft' | 'submitted' | 'awaiting_documents' | 'in_progress' | 'completed' | 'rejected' | 'cancelled',
  Array<'draft' | 'submitted' | 'awaiting_documents' | 'in_progress' | 'completed' | 'rejected' | 'cancelled'>
> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['awaiting_documents', 'in_progress', 'rejected', 'cancelled'],
  awaiting_documents: ['submitted', 'in_progress', 'rejected', 'cancelled'],
  in_progress: ['completed', 'rejected', 'cancelled'],
  completed: [],
  rejected: ['submitted', 'cancelled'],
  cancelled: ['draft', 'submitted'],
};

export class PortOrderService {
  async list(organizationId: string) {
    return prisma.portOrder.findMany({
      where: { organizationId },
      include: {
        phoneNumber: {
          select: {
            id: true,
            phoneNumber: true,
            formattedNumber: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(input: {
    organizationId: string;
    phoneNumberId?: string;
    losingCarrier?: string;
    requestedFocAt?: Date;
    metadata?: Record<string, unknown>;
  }) {
    if (input.phoneNumberId) {
      const number = await prisma.phoneNumber.findFirst({
        where: {
          id: input.phoneNumberId,
          organizationId: input.organizationId,
        },
      });

      if (!number) {
        throw new NotFoundError('Phone number not found');
      }
    }

    const portOrder = await prisma.portOrder.create({
      data: {
        organizationId: input.organizationId,
        phoneNumberId: input.phoneNumberId,
        losingCarrier: input.losingCarrier,
        requestedFocAt: input.requestedFocAt,
        status: 'draft',
        metadata: {
          ...(input.metadata ?? {}),
          lifecycleSource: 'embedded_ui',
        } as Prisma.InputJsonValue,
      },
      include: {
        phoneNumber: true,
      },
    });

    await integrationService.updateLifecycleState(
      input.organizationId,
      'port_in_progress',
      'leadconnector'
    );

    return portOrder;
  }

  async update(
    organizationId: string,
    portOrderId: string,
    input: {
      status?: 'draft' | 'submitted' | 'awaiting_documents' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
      rejectionReason?: string;
      requestedFocAt?: Date | null;
      completedAt?: Date | null;
      metadata?: Record<string, unknown>;
    }
  ) {
    const existing = await prisma.portOrder.findFirst({
      where: {
        id: portOrderId,
        organizationId,
      },
    });

    if (!existing) {
      throw new NotFoundError('Port order not found');
    }

    if (input.status && input.status !== existing.status) {
      const allowedNextStates = ALLOWED_STATUS_TRANSITIONS[existing.status];
      if (!allowedNextStates.includes(input.status)) {
        throw new BadRequestError(
          `Port order cannot move from ${existing.status} to ${input.status}`
        );
      }
    }

    if (input.status === 'rejected' && !input.rejectionReason?.trim()) {
      throw new BadRequestError('Rejected port orders must include a rejection reason');
    }

    const mergedMetadata = {
      ...this.asRecord(existing.metadata),
      ...(input.metadata ?? {}),
    };

    const nextStatus = input.status ?? existing.status;
    const completedAt = nextStatus === 'completed'
      ? (input.completedAt ?? existing.completedAt ?? new Date())
      : null;

    const updated = await prisma.portOrder.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        rejectionReason: nextStatus === 'rejected' ? input.rejectionReason : null,
        requestedFocAt: input.requestedFocAt,
        completedAt,
        metadata: mergedMetadata as Prisma.InputJsonValue,
      },
      include: {
        phoneNumber: true,
      },
    });

    if (ACTIVE_PORT_STATUSES.includes(updated.status as typeof ACTIVE_PORT_STATUSES[number])) {
      await integrationService.updateLifecycleState(organizationId, 'port_in_progress', 'leadconnector');
    } else {
      await integrationService.reconcileLifecycleState(organizationId, 'leadconnector');
    }

    return updated;
  }

  private asRecord(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return value as Record<string, unknown>;
  }
}

export const portOrderService = new PortOrderService();
