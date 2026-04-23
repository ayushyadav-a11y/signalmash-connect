// ===========================================
// Operations Service
// ===========================================

import { prisma } from '../config/database.js';
import { billingService } from './billing.service.js';

export class OperationsService {
  async getSummary(organizationId: string) {
    const [billing, deadLetters, portOrders, suppressions] = await Promise.all([
      billingService.getSummary(organizationId),
      prisma.deadLetterJob.count({
        where: {
          OR: [{ organizationId }, { organizationId: null }],
          status: 'pending',
        },
      }),
      prisma.portOrder.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: true,
      }),
      prisma.suppressionEvent.count({
        where: {
          organizationId,
          action: 'opt_out',
          active: true,
        },
      }),
    ]);

    return {
      billing,
      pendingDeadLetters: deadLetters,
      activeSuppressions: suppressions,
      portOrders: {
        total: portOrders.reduce((sum, item) => sum + item._count, 0),
        submitted: portOrders.find((item) => item.status === 'submitted')?._count ?? 0,
        inProgress: portOrders.find((item) => item.status === 'in_progress')?._count ?? 0,
        awaitingDocuments: portOrders.find((item) => item.status === 'awaiting_documents')?._count ?? 0,
        completed: portOrders.find((item) => item.status === 'completed')?._count ?? 0,
      },
    };
  }
}

export const operationsService = new OperationsService();
