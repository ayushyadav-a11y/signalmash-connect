// ===========================================
// Compliance Service
// ===========================================

import { prisma } from '../config/database.js';
import { formatPhoneE164 } from '@signalmash-connect/shared';
import { logger } from '../utils/logger.js';

const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
const OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES', 'SUBSCRIBE'];
const HELP_KEYWORDS = ['HELP', 'INFO'];

type ComplianceKeywordAction = 'opt_out' | 'opt_in' | 'help' | null;
export type ComplianceEventResult = {
  action: Exclude<ComplianceKeywordAction, null>;
  phoneNumber: string;
};

export class ComplianceService {
  classifyKeyword(messageBody: string): ComplianceKeywordAction {
    const normalized = messageBody.trim().toUpperCase();

    if (OPT_OUT_KEYWORDS.includes(normalized)) {
      return 'opt_out';
    }

    if (OPT_IN_KEYWORDS.includes(normalized)) {
      return 'opt_in';
    }

    if (HELP_KEYWORDS.includes(normalized)) {
      return 'help';
    }

    return null;
  }

  async handleInboundKeyword(input: {
    organizationId: string;
    from: string;
    body: string;
  }): Promise<ComplianceEventResult | null> {
    const action = this.classifyKeyword(input.body);

    if (!action) {
      return null;
    }

    const phoneNumber = formatPhoneE164(input.from);
    const keyword = input.body.trim().toUpperCase();

    if (action === 'opt_out') {
      await prisma.suppressionEvent.updateMany({
        where: {
          organizationId: input.organizationId,
          phoneNumber,
        },
        data: {
          active: false,
        },
      });

      const event = await prisma.suppressionEvent.create({
        data: {
          organizationId: input.organizationId,
          phoneNumber,
          action: 'opt_out',
          keyword,
          rawText: input.body,
          active: true,
        },
      });

      logger.info({ organizationId: input.organizationId, phoneNumber }, 'Contact opted out');
      return { action, phoneNumber };
    }

    if (action === 'opt_in') {
      await prisma.suppressionEvent.updateMany({
        where: {
          organizationId: input.organizationId,
          phoneNumber,
        },
        data: {
          active: false,
        },
      });

      const event = await prisma.suppressionEvent.create({
        data: {
          organizationId: input.organizationId,
          phoneNumber,
          action: 'opt_in',
          keyword,
          rawText: input.body,
          active: false,
        },
      });

      logger.info({ organizationId: input.organizationId, phoneNumber }, 'Contact opted back in');
      return { action, phoneNumber };
    }

    const event = await prisma.suppressionEvent.create({
      data: {
        organizationId: input.organizationId,
        phoneNumber,
        action: 'help',
        keyword,
        rawText: input.body,
        active: false,
      },
    });

    logger.info({ organizationId: input.organizationId, phoneNumber }, 'Contact requested help');
    return { action, phoneNumber };
  }

  async isSuppressed(organizationId: string, phoneNumber: string): Promise<boolean> {
    const normalizedPhoneNumber = formatPhoneE164(phoneNumber);

    const activeSuppression = await prisma.suppressionEvent.findFirst({
      where: {
        organizationId,
        phoneNumber: normalizedPhoneNumber,
        action: 'opt_out',
        active: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return Boolean(activeSuppression);
  }
}

export const complianceService = new ComplianceService();
