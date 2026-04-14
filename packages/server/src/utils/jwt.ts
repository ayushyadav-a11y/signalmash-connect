// ===========================================
// JWT Utilities (using jose)
// ===========================================

import * as jose from 'jose';
import { config } from '../config/index.js';
import { UnauthorizedError } from './errors.js';

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

interface TokenPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: string;
  [key: string]: unknown;
}

interface DecodedToken extends TokenPayload {
  iat: number;
  exp: number;
  jti: string;
}

const accessTokenSecret = new TextEncoder().encode(config.jwtSecret);
const refreshTokenSecret = new TextEncoder().encode(config.jwtRefreshSecret);

/**
 * Generate access token
 */
export async function generateAccessToken(payload: TokenPayload): Promise<string> {
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(accessTokenSecret);

  return token;
}

/**
 * Generate refresh token
 */
export async function generateRefreshToken(payload: TokenPayload): Promise<string> {
  const token = await new jose.SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(refreshTokenSecret);

  return token;
}

/**
 * Verify access token
 */
export async function verifyAccessToken(token: string): Promise<DecodedToken> {
  try {
    const { payload } = await jose.jwtVerify(token, accessTokenSecret);
    return payload as unknown as DecodedToken;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Token has expired');
    }
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Verify refresh token
 */
export async function verifyRefreshToken(token: string): Promise<DecodedToken> {
  try {
    const { payload } = await jose.jwtVerify(token, refreshTokenSecret);
    return payload as unknown as DecodedToken;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    throw new UnauthorizedError('Invalid refresh token');
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): DecodedToken | null {
  try {
    const decoded = jose.decodeJwt(token);
    return decoded as unknown as DecodedToken;
  } catch {
    return null;
  }
}

/**
 * Generate token pair (access + refresh)
 */
export async function generateTokenPair(payload: TokenPayload): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAccessToken(payload),
    generateRefreshToken(payload),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}

// ===========================================
// Admin Token Functions
// ===========================================

interface AdminTokenPayload {
  adminId: string;
  email: string;
}

interface DecodedAdminToken extends AdminTokenPayload {
  iat: number;
  exp: number;
  jti: string;
  type: string;
}

/**
 * Generate admin access token
 */
export async function generateAdminAccessToken(payload: AdminTokenPayload): Promise<string> {
  const token = await new jose.SignJWT({ ...payload, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(accessTokenSecret);

  return token;
}

/**
 * Generate admin refresh token
 */
export async function generateAdminRefreshToken(payload: AdminTokenPayload): Promise<string> {
  const token = await new jose.SignJWT({ ...payload, type: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(refreshTokenSecret);

  return token;
}

/**
 * Verify admin access token
 */
export async function verifyAdminAccessToken(token: string): Promise<DecodedAdminToken> {
  try {
    const { payload } = await jose.jwtVerify(token, accessTokenSecret);
    if (payload.type !== 'admin') {
      throw new UnauthorizedError('Invalid admin token');
    }
    return payload as unknown as DecodedAdminToken;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Token has expired');
    }
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid token');
  }
}

/**
 * Verify admin refresh token
 */
export async function verifyAdminRefreshToken(token: string): Promise<DecodedAdminToken> {
  try {
    const { payload } = await jose.jwtVerify(token, refreshTokenSecret);
    if (payload.type !== 'admin') {
      throw new UnauthorizedError('Invalid admin refresh token');
    }
    return payload as unknown as DecodedAdminToken;
  } catch (error) {
    if (error instanceof jose.errors.JWTExpired) {
      throw new UnauthorizedError('Refresh token has expired');
    }
    if (error instanceof UnauthorizedError) {
      throw error;
    }
    throw new UnauthorizedError('Invalid refresh token');
  }
}

/**
 * Generate admin token pair (access + refresh)
 */
export async function generateTokens(payload: AdminTokenPayload): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    generateAdminAccessToken(payload),
    generateAdminRefreshToken(payload),
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: 15 * 60, // 15 minutes in seconds
  };
}
