// Rate limiting utilities for authentication endpoints
import { NextApiRequest, NextApiResponse } from 'next';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

// Rate limiter configurations
const RATE_LIMITS = {
  // Login: 5 attempts per 15 minutes per IP
  login: {
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 15 * 60, // Block for 15 minutes after exceeding
  },
  // Registration: 3 per hour per IP
  register: {
    points: 3,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60,
  },
  // Password reset: 3 per hour per email
  passwordReset: {
    points: 3,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60,
  },
  // Email verification resend: 3 per hour per email
  verifyEmail: {
    points: 3,
    duration: 60 * 60, // 1 hour
    blockDuration: 60 * 60,
  },
  // 2FA verification: 5 attempts per 15 minutes
  twoFactor: {
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 15 * 60,
  },
  // General API: 100 requests per minute
  api: {
    points: 100,
    duration: 60, // 1 minute
    blockDuration: 60,
  },
  // Admin endpoints: 30 requests per minute
  admin: {
    points: 30,
    duration: 60, // 1 minute
    blockDuration: 60,
  },
};

// Create rate limiter instances
const rateLimiters = {
  login: new RateLimiterMemory({
    keyPrefix: 'login',
    ...RATE_LIMITS.login,
  }),
  register: new RateLimiterMemory({
    keyPrefix: 'register',
    ...RATE_LIMITS.register,
  }),
  passwordReset: new RateLimiterMemory({
    keyPrefix: 'password_reset',
    ...RATE_LIMITS.passwordReset,
  }),
  verifyEmail: new RateLimiterMemory({
    keyPrefix: 'verify_email',
    ...RATE_LIMITS.verifyEmail,
  }),
  twoFactor: new RateLimiterMemory({
    keyPrefix: '2fa',
    ...RATE_LIMITS.twoFactor,
  }),
  api: new RateLimiterMemory({
    keyPrefix: 'api',
    ...RATE_LIMITS.api,
  }),
  admin: new RateLimiterMemory({
    keyPrefix: 'admin',
    ...RATE_LIMITS.admin,
  }),
};

// Get client IP address
export function getClientIP(req: NextApiRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded 
    ? (typeof forwarded === 'string' ? forwarded : forwarded[0])?.split(',')[0]?.trim()
    : req.socket.remoteAddress;
  return ip || 'unknown';
}

// Rate limit check result
export interface RateLimitResult {
  allowed: boolean;
  retryAfter?: number;
  remainingPoints?: number;
}

// Check rate limit
export async function checkRateLimit(
  type: keyof typeof rateLimiters,
  key: string
): Promise<RateLimitResult> {
  const limiter = rateLimiters[type];
  
  try {
    const res = await limiter.consume(key);
    return {
      allowed: true,
      remainingPoints: res.remainingPoints,
    };
  } catch (rejRes) {
    if (rejRes instanceof RateLimiterRes) {
      return {
        allowed: false,
        retryAfter: Math.ceil(rejRes.msBeforeNext / 1000),
      };
    }
    // Unexpected error, allow the request but log it
    console.error('Rate limiter error:', rejRes);
    return { allowed: true };
  }
}

// Middleware-style rate limiter for API routes
export async function rateLimitMiddleware(
  req: NextApiRequest,
  res: NextApiResponse,
  type: keyof typeof rateLimiters,
  key?: string
): Promise<boolean> {
  const identifier = key || getClientIP(req);
  const result = await checkRateLimit(type, identifier);
  
  if (!result.allowed) {
    res.setHeader('Retry-After', result.retryAfter?.toString() || '60');
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: result.retryAfter,
      message: `Please try again in ${result.retryAfter} seconds`,
    });
    return false;
  }
  
  // Set rate limit headers
  if (result.remainingPoints !== undefined) {
    res.setHeader('X-RateLimit-Remaining', result.remainingPoints.toString());
  }
  
  return true;
}

// Create a custom rate limiter for specific use cases
export function createRateLimiter(
  keyPrefix: string,
  points: number,
  duration: number,
  blockDuration?: number
) {
  return new RateLimiterMemory({
    keyPrefix,
    points,
    duration,
    blockDuration: blockDuration || duration,
  });
}

// Reset rate limit for a specific key (useful for successful auth)
export async function resetRateLimit(
  type: keyof typeof rateLimiters,
  key: string
): Promise<void> {
  try {
    await rateLimiters[type].delete(key);
  } catch (error) {
    console.error('Error resetting rate limit:', error);
  }
}

// Get rate limit info without consuming a point
export async function getRateLimitInfo(
  type: keyof typeof rateLimiters,
  key: string
): Promise<{ remaining: number; resetTime: Date | null }> {
  const limiter = rateLimiters[type];
  
  try {
    const res = await limiter.get(key);
    if (res) {
      return {
        remaining: Math.max(0, limiter.points - res.consumedPoints),
        resetTime: new Date(Date.now() + res.msBeforeNext),
      };
    }
  } catch (error) {
    console.error('Error getting rate limit info:', error);
  }
  
  return {
    remaining: limiter.points,
    resetTime: null,
  };
}

// Brute force protection for login attempts
const loginAttempts = new Map<string, { count: number; firstAttempt: number; lockedUntil?: number }>();

export function checkBruteForceProtection(
  identifier: string,
  maxAttempts: number = 5,
  lockDurationMinutes: number = 15
): { allowed: boolean; lockedUntil?: Date; attemptsRemaining: number } {
  const now = Date.now();
  const lockDurationMs = lockDurationMinutes * 60 * 1000;
  
  const record = loginAttempts.get(identifier);
  
  // Check if currently locked
  if (record?.lockedUntil && now < record.lockedUntil) {
    return {
      allowed: false,
      lockedUntil: new Date(record.lockedUntil),
      attemptsRemaining: 0,
    };
  }
  
  // If lock expired, reset
  if (record?.lockedUntil && now >= record.lockedUntil) {
    loginAttempts.delete(identifier);
  }
  
  // Calculate remaining attempts
  const attemptsRemaining = maxAttempts - (record?.count || 0);
  
  return {
    allowed: attemptsRemaining > 0,
    attemptsRemaining: Math.max(0, attemptsRemaining),
  };
}

export function recordFailedAttempt(
  identifier: string,
  maxAttempts: number = 5,
  lockDurationMinutes: number = 15
): { locked: boolean; lockedUntil?: Date } {
  const now = Date.now();
  const lockDurationMs = lockDurationMinutes * 60 * 1000;
  
  const record = loginAttempts.get(identifier);
  
  if (!record) {
    loginAttempts.set(identifier, {
      count: 1,
      firstAttempt: now,
    });
    return { locked: false };
  }
  
  record.count++;
  
  // Check if should lock
  if (record.count >= maxAttempts) {
    record.lockedUntil = now + lockDurationMs;
    return {
      locked: true,
      lockedUntil: new Date(record.lockedUntil),
    };
  }
  
  return { locked: false };
}

export function resetBruteForceProtection(identifier: string): void {
  loginAttempts.delete(identifier);
}

// Clean up old entries periodically (every hour)
setInterval(() => {
  const now = Date.now();
  const oneHour = 60 * 60 * 1000;
  
  loginAttempts.forEach((record, key) => {
    if (now - record.firstAttempt > oneHour && (!record.lockedUntil || now > record.lockedUntil)) {
      loginAttempts.delete(key);
    }
  });
}, 60 * 60 * 1000);
