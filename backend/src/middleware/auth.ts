import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { JwtPayload, UserRole } from '../types/index.js';
import { UnauthorizedError, ForbiddenError } from './errorHandler.js';

/**
 * Extracts and verifies the Bearer JWT from the Authorization header.
 * Attaches the decoded payload to req.user.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers['authorization'];
  if (!authHeader?.startsWith('Bearer ')) {
    next(new UnauthorizedError('Missing or malformed Authorization header'));
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Access token expired'));
    } else {
      next(new UnauthorizedError('Invalid access token'));
    }
  }
}

/**
 * Factory: returns middleware that ensures req.user has one of the
 * allowed roles. Must be used after requireAuth.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new ForbiddenError(`Requires role: ${roles.join(' | ')}`));
      return;
    }
    next();
  };
}

/**
 * Convenience: require estate_manager or admin.
 */
export const requireManager = requireRole('estate_manager', 'admin');

/**
 * Convenience: require admin.
 */
export const requireAdmin = requireRole('admin');
