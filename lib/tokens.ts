// Token generation utilities for authentication
import crypto from 'crypto'

// Generate a cryptographically secure random token
export function generateSecureToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex')
}

// Generate a short numeric code (for 2FA, etc.)
export function generateNumericCode(length: number = 6): string {
  const min = Math.pow(10, length - 1)
  const range = Math.pow(10, length) - min
  const randomValue = crypto.randomInt(range)
  return (min + randomValue).toString()
}

// Generate verification token
export function generateVerificationToken(): string {
  return generateSecureToken(32)
}

// Generate password reset token
export function generatePasswordResetToken(): string {
  return generateSecureToken(32)
}

// Hash a token for storage
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

// Generate backup codes for 2FA
export function generateBackupCodes(count: number = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    // Format: XXXX-XXXX-XXXX (12 characters, grouped for readability)
    const part1 = generateNumericCode(4)
    const part2 = generateNumericCode(4)
    const part3 = generateNumericCode(4)
    codes.push(`${part1}-${part2}-${part3}`)
  }
  return codes
}

// Hash backup codes for storage
export function hashBackupCodes(codes: string[]): string[] {
  return codes.map((code) => hashToken(code))
}

// Verify a backup code against hashed codes
export function verifyBackupCode(code: string, hashedCodes: string[]): boolean {
  const hashedInput = hashToken(code)
  return hashedCodes.includes(hashedInput)
}

// Generate session ID
export function generateSessionId(): string {
  return generateSecureToken(24)
}

// Generate CSRF token
export function generateCSRFToken(): string {
  return generateSecureToken(32)
}

// Token expiry times
export const TOKEN_EXPIRY = {
  // Verification tokens: 24 hours
  verification: 24 * 60 * 60 * 1000,
  // Password reset: 1 hour
  passwordReset: 60 * 60 * 1000,
  // Session tokens: 30 days
  session: 30 * 24 * 60 * 60 * 1000,
  // 2FA temporary tokens: 10 minutes
  twoFactor: 10 * 60 * 1000,
  // Magic link tokens: 15 minutes
  magicLink: 15 * 60 * 1000,
}

// Calculate expiry date
export function getExpiryDate(durationMs: number): Date {
  return new Date(Date.now() + durationMs)
}

// Check if a token is expired
export function isTokenExpired(expiresAt: Date): boolean {
  return new Date() > expiresAt
}

// Generate API key
export function generateAPIKey(): { key: string; hashedKey: string } {
  const key = `ff_${generateSecureToken(32)}`
  const hashedKey = hashToken(key)
  return { key, hashedKey }
}

// Constant-time comparison to prevent timing attacks
export function constantTimeCompare(a: string, b: string): boolean {
  const left = crypto.createHash('sha256').update(a).digest()
  const right = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(left, right)
}
