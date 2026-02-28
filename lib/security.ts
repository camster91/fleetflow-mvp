// Security utilities for FleetFlow
import { NextApiRequest, NextApiResponse } from 'next'
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible'

// Rate limiters for different endpoints
const rateLimiters = {
  // Auth endpoints: 5 attempts per 15 minutes
  auth: new RateLimiterMemory({
    keyPrefix: 'auth',
    points: 5,
    duration: 15 * 60, // 15 minutes
  }),
  
  // API endpoints: 100 requests per minute
  api: new RateLimiterMemory({
    keyPrefix: 'api',
    points: 100,
    duration: 60, // 1 minute
  }),
  
  // Admin endpoints: 30 requests per minute
  admin: new RateLimiterMemory({
    keyPrefix: 'admin',
    points: 30,
    duration: 60, // 1 minute
  }),
}

/**
 * Apply rate limiting to an API route
 */
export async function rateLimit(
  req: NextApiRequest,
  res: NextApiResponse,
  type: 'auth' | 'api' | 'admin' = 'api'
): Promise<boolean> {
  const limiter = rateLimiters[type]
  
  // Get IP address (handle proxies)
  const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 
             req.socket.remoteAddress || 
             'unknown'
  
  try {
    await limiter.consume(ip)
    return true
  } catch (rejRes) {
    if (rejRes instanceof RateLimiterRes) {
      // Set rate limit headers
      res.setHeader('Retry-After', Math.round(rejRes.msBeforeNext / 1000))
      res.status(429).json({
        error: 'Too many requests',
        retryAfter: Math.round(rejRes.msBeforeNext / 1000)
      })
    }
    return false
  }
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email) && email.length <= 254
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (password.length < 8) {
    errors.push('Password must be at least 8 characters long')
  }
  if (password.length > 128) {
    errors.push('Password must not exceed 128 characters')
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter')
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter')
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number')
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character')
  }
  
  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Security headers to add to all responses
 */
export const securityHeaders = {
  // Prevent XSS attacks
  'X-Content-Type-Options': 'nosniff',
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  // Enable XSS protection
  'X-XSS-Protection': '1; mode=block',
  // Strict Transport Security (HTTPS only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // Permissions policy
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self), interest-cohort=()',
}

/**
 * Content Security Policy
 */
export const contentSecurityPolicy = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'", "'unsafe-inline'"],
  'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
  'img-src': ["'self'", 'data:', 'blob:', 'https:'],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': ["'self'", 'https://api.mailgun.net'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
}

/**
 * Build CSP string from policy object
 */
export function buildCSP(policy: Record<string, string[]>): string {
  return Object.entries(policy)
    .map(([key, values]) => `${key} ${values.join(' ')}`)
    .join('; ')
}

/**
 * Audit log for sensitive actions
 */
export async function auditLog(action: {
  type: string
  userId: string
  targetId?: string
  details: Record<string, any>
  ip?: string
  userAgent?: string
}) {
  // In production, write to database or external service
  console.log('AUDIT LOG:', {
    timestamp: new Date().toISOString(),
    ...action
  })
}

/**
 * Input validation helper
 */
export function validateInput(
  value: any,
  rules: {
    required?: boolean
    type?: 'string' | 'number' | 'email' | 'uuid'
    minLength?: number
    maxLength?: number
    min?: number
    max?: number
    pattern?: RegExp
  }
): { valid: boolean; error?: string } {
  // Check required
  if (rules.required && (value === undefined || value === null || value === '')) {
    return { valid: false, error: 'This field is required' }
  }
  
  if (!value && !rules.required) {
    return { valid: true }
  }
  
  // Type validation
  if (rules.type) {
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          return { valid: false, error: 'Must be a string' }
        }
        break
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          return { valid: false, error: 'Must be a number' }
        }
        break
      case 'email':
        if (!isValidEmail(value)) {
          return { valid: false, error: 'Invalid email format' }
        }
        break
    }
  }
  
  // String length validation
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      return { valid: false, error: `Minimum ${rules.minLength} characters required` }
    }
    if (rules.maxLength && value.length > rules.maxLength) {
      return { valid: false, error: `Maximum ${rules.maxLength} characters allowed` }
    }
  }
  
  // Number range validation
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      return { valid: false, error: `Minimum value is ${rules.min}` }
    }
    if (rules.max !== undefined && value > rules.max) {
      return { valid: false, error: `Maximum value is ${rules.max}` }
    }
  }
  
  // Pattern validation
  if (rules.pattern && !rules.pattern.test(String(value))) {
    return { valid: false, error: 'Invalid format' }
  }
  
  return { valid: true }
}
// Deploy cache bust: 2026-02-28 18:53:47
