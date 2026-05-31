import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { query } from '../db/index.js';
import { config } from '../config.js';
import { validate } from '../middleware/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  ConflictError,
  UnauthorizedError,
  BadRequestError,
} from '../middleware/errorHandler.js';
import type { UserRow, JwtPayload, RefreshPayload } from '../types/index.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(100),
  estate_id: z.string().uuid().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

function issueTokens(user: UserRow) {
  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
    estateId: user.estate_id,
  };

  const accessToken = jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  const refreshPayload: RefreshPayload = { sub: user.id, type: 'refresh' };
  const refreshToken = jwt.sign(refreshPayload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

  return { accessToken, refreshToken };
}

// POST /api/auth/register
authRouter.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, estate_id } = req.body as z.infer<typeof registerSchema>;

    const existing = await query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    if (existing.rowCount && existing.rowCount > 0) {
      throw new ConflictError('An account with this email already exists');
    }

    // If estate_id provided, verify it exists
    if (estate_id) {
      const estateCheck = await query<{ id: string }>(
        'SELECT id FROM estates WHERE id = $1',
        [estate_id],
      );
      if (!estateCheck.rowCount || estateCheck.rowCount === 0) {
        throw new BadRequestError('Estate not found');
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await query<UserRow>(
      `INSERT INTO users (email, password_hash, name, estate_id, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [email.toLowerCase(), passwordHash, name, estate_id ?? null, 'resident'],
    );

    const user = result.rows[0];
    const { accessToken, refreshToken } = issueTokens(user);

    res.status(201).json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
authRouter.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body as z.infer<typeof loginSchema>;

    const result = await query<UserRow>(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()],
    );

    const user = result.rows[0];
    if (!user) throw new UnauthorizedError('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new UnauthorizedError('Invalid credentials');

    const { accessToken, refreshToken } = issueTokens(user);

    res.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role, estate_id: user.estate_id },
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh
authRouter.post('/refresh', validate(refreshSchema), async (req, res, next) => {
  try {
    const { refresh_token } = req.body as z.infer<typeof refreshSchema>;

    let payload: RefreshPayload;
    try {
      payload = jwt.verify(refresh_token, config.JWT_REFRESH_SECRET) as RefreshPayload;
    } catch {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') throw new UnauthorizedError('Invalid token type');

    const result = await query<UserRow>(
      'SELECT * FROM users WHERE id = $1',
      [payload.sub],
    );
    const user = result.rows[0];
    if (!user) throw new UnauthorizedError('User not found');

    const { accessToken, refreshToken } = issueTokens(user);

    res.json({ access_token: accessToken, refresh_token: refreshToken });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
authRouter.get('/me', requireAuth, async (req, res, next) => {
  try {
    const result = await query<UserRow>(
      'SELECT id, email, name, role, estate_id, created_at FROM users WHERE id = $1',
      [req.user!.sub],
    );
    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    next(err);
  }
});
