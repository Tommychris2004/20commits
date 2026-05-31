import type { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

type ValidateTarget = 'body' | 'query' | 'params';

/**
 * Returns an Express middleware that validates the given request property
 * (body, query, or params) against a Zod schema.
 *
 * On success the parsed/coerced value replaces the raw value on req.
 * On failure a ZodError is forwarded to the central error handler.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validate(schema: z.ZodType<any, any, any>, target: ValidateTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(result.error);
      return;
    }
    // Replace with coerced/stripped value
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (req as any)[target] = result.data;
    next();
  };
}
