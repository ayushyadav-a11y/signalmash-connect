// ===========================================
// Request Validation Middleware
// ===========================================

import type { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface ValidationSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request against Zod schemas
 */
export function validate(schemas: ValidationSchemas) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }

      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query);
      }

      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors: Record<string, string[]> = {};

        for (const issue of error.issues) {
          const path = issue.path.join('.');
          if (!formattedErrors[path]) {
            formattedErrors[path] = [];
          }
          formattedErrors[path].push(issue.message);
        }

        return next(new ValidationError('Validation failed', { errors: formattedErrors }));
      }

      next(error);
    }
  };
}

// ===========================================
// Common Validation Schemas
// ===========================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const emailSchema = z.string().email('Invalid email address');

const normalizePhoneNumber = (value: string) =>
  value
    .trim()
    .replace(/[\s\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g, '')
    .replace(/[().-]/g, '');

export const phoneSchema = z.preprocess(
  (value) => (typeof value === 'string' ? normalizePhoneNumber(value) : value),
  z.string().regex(/^\+?[1-9]\d{1,14}$/, 'Invalid phone number format')
);

export const einSchema = z
  .string()
  .regex(/^\d{2}-?\d{7}$/, 'Invalid EIN format (XX-XXXXXXX)');

export const urlSchema = z.string().url('Invalid URL format');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number');
