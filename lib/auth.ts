import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import AzureADProvider from "next-auth/providers/azure-ad"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import { prisma } from "./prisma"
import bcrypt from "bcryptjs"
import { checkBruteForceProtection, recordFailedAttempt, resetBruteForceProtection } from "./rateLimit"
import { sendSecurityAlertEmail } from "./email"

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is not set. Set a strong random secret before starting the server.")
}

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    role: string
    company?: string
    emailVerified?: Date | null
    twoFactorEnabled?: boolean
    requires2FA?: boolean
  }
  
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: string
      company?: string | null
      emailVerified?: Date | null
      twoFactorEnabled?: boolean
    }
    requires2FA?: boolean
    impersonation?: {
      isImpersonating: boolean
      originalUserId: string
      originalUserRole: string
      impersonatedUserId: string
      impersonatedUserRole: string
      impersonatedUserName?: string
      impersonatedUserEmail?: string
      startedAt: string
    } | null
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    company?: string | null
    emailVerified?: Date | null
    twoFactorEnabled?: boolean
    requires2FA?: boolean
    impersonation?: {
      isImpersonating: boolean
      originalUserId: string
      originalUserRole: string
      impersonatedUserId: string
      impersonatedUserRole: string
      impersonatedUserName?: string
      impersonatedUserEmail?: string
      startedAt: string
    } | null
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
    newUser: "/auth/register",
  },
  providers: [
    // Credentials Provider (Email/Password)
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        twoFactorCode: { label: "2FA Code", type: "text", optional: true }
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Invalid credentials")
        }

        const email = credentials.email.toLowerCase()
        const ip = (req?.headers?.['x-forwarded-for'] as string)?.split(',')[0]?.trim() || 'unknown'

        // Check brute force protection
        const bruteForceKey = `${email}:${ip}`
        const bruteForceCheck = checkBruteForceProtection(bruteForceKey)
        
        if (!bruteForceCheck.allowed) {
          throw new Error(`Account temporarily locked. Try again in ${Math.ceil((bruteForceCheck.lockedUntil!.getTime() - Date.now()) / 60000)} minutes`)
        }

        const user = await prisma.user.findUnique({
          where: { email }
        })

        if (!user || !user.password) {
          recordFailedAttempt(bruteForceKey)
          throw new Error("Invalid credentials")
        }

        // Check if account is locked
        if (user.lockedUntil && new Date() < user.lockedUntil) {
          const minutesRemaining = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000)
          throw new Error(`Account temporarily locked. Try again in ${minutesRemaining} minutes`)
        }

        // Check if email is verified
        if (!user.emailVerified) {
          throw new Error("Please verify your email address before signing in")
        }

        const isCorrectPassword = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isCorrectPassword) {
          // Record failed attempt
          const lockResult = recordFailedAttempt(bruteForceKey, 5, 15)
          
          // Update user's failed login attempts
          const newFailedAttempts = user.failedLoginAttempts + 1
          const updateData: any = { failedLoginAttempts: newFailedAttempts }
          
          if (newFailedAttempts >= 5) {
            // Lock account for 15 minutes
            updateData.lockedUntil = new Date(Date.now() + 15 * 60 * 1000)
            
            // Send account locked notification
            try {
              await sendSecurityAlertEmail(
                user.email,
                user.name || 'there',
                'login',
                { ip, time: new Date().toISOString() }
              )
            } catch (e) {
              console.error('Failed to send security alert:', e)
            }
          }
          
          await prisma.user.update({
            where: { id: user.id },
            data: updateData
          })
          
          throw new Error("Invalid credentials")
        }

        // Check if 2FA is required
        if (user.twoFactorEnabled && !credentials.twoFactorCode) {
          // Return partial authentication - require 2FA
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            company: user.company || undefined,
            emailVerified: user.emailVerified,
            twoFactorEnabled: user.twoFactorEnabled,
            requires2FA: true,
          }
        }

        // Verify 2FA code if provided
        if (user.twoFactorEnabled && credentials.twoFactorCode) {
          const speakeasy = await import('speakeasy')
          const verified = speakeasy.totp.verify({
            secret: user.twoFactorSecret!,
            encoding: 'base32',
            token: credentials.twoFactorCode,
            window: 2,
          })

          if (!verified) {
            // Check backup codes
            const backupCodes = user.backupCodes ? JSON.parse(user.backupCodes) : []
            let backupCodeValid = false
            let usedBackupCodeIndex = -1
            
            for (let i = 0; i < backupCodes.length; i++) {
              if (bcrypt.compareSync(credentials.twoFactorCode, backupCodes[i])) {
                backupCodeValid = true
                usedBackupCodeIndex = i
                break
              }
            }

            if (!backupCodeValid) {
              throw new Error("Invalid 2FA code")
            }

            // Remove used backup code
            if (usedBackupCodeIndex >= 0) {
              backupCodes.splice(usedBackupCodeIndex, 1)
              await prisma.user.update({
                where: { id: user.id },
                data: { backupCodes: JSON.stringify(backupCodes) }
              })
            }
          }
        }

        // Successful login - reset failed attempts
        resetBruteForceProtection(bruteForceKey)
        
        // Update user's last login and reset failed attempts
        await prisma.user.update({
          where: { id: user.id },
          data: {
            lastLoginAt: new Date(),
            failedLoginAttempts: 0,
            lockedUntil: null,
          }
        })

        // Log successful login
        try {
          await prisma.loginHistory.create({
            data: {
              userId: user.id,
              ipAddress: ip,
              userAgent: req?.headers?.['user-agent'] || null,
              success: true,
            }
          })
        } catch (e) {
          console.error('Failed to log login history:', e)
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          company: user.company || undefined,
          emailVerified: user.emailVerified,
          twoFactorEnabled: user.twoFactorEnabled,
          requires2FA: false,
        }
      }
    }),
    
    // Google OAuth Provider
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: 'fleet_manager', // Default role for OAuth users
          emailVerified: new Date(), // Google emails are pre-verified
        }
      },
    }),
    
    // Microsoft/Azure AD OAuth Provider
    AzureADProvider({
      clientId: process.env.MICROSOFT_CLIENT_ID || '',
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
      tenantId: process.env.MICROSOFT_TENANT_ID || 'common',
      allowDangerousEmailAccountLinking: true,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
          role: 'fleet_manager', // Default role for OAuth users
          emailVerified: new Date(), // Microsoft emails are pre-verified
        }
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      // Allow sign-in for credentials provider
      if (account?.provider === 'credentials') {
        return true
      }
      
      // For OAuth providers, check if user exists
      if (account?.provider === 'google' || account?.provider === 'azure-ad') {
        const existingUser = await prisma.user.findUnique({
          where: { email: user.email! }
        })
        
        if (existingUser) {
          // Update OAuth ID if not set
          if (account.provider === 'google' && !existingUser.googleId) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { googleId: user.id }
            })
          }
          if (account.provider === 'azure-ad' && !existingUser.microsoftId) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { microsoftId: user.id }
            })
          }
          
          // Update last login
          await prisma.user.update({
            where: { id: existingUser.id },
            data: { lastLoginAt: new Date() }
          })
        }
        
        return true
      }
      
      return true
    },
    
    async jwt({ token, user, trigger, session, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role
        token.company = user.company
        token.emailVerified = user.emailVerified
        token.twoFactorEnabled = user.twoFactorEnabled
        token.requires2FA = user.requires2FA
      }
      
      // Handle impersonation update from client
      if (trigger === "update" && session?.impersonation) {
        token.impersonation = session.impersonation
      }
      
      // If impersonating, swap the user data
      if (token.impersonation?.isImpersonating) {
        token.id = token.impersonation.impersonatedUserId
        token.role = token.impersonation.impersonatedUserRole
      }
      
      return token
    },
    
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id
        session.user.role = token.role
        session.user.company = token.company || null
        session.user.emailVerified = token.emailVerified
        session.user.twoFactorEnabled = token.twoFactorEnabled
        
        // Check if 2FA is still required
        session.requires2FA = token.requires2FA || false
        
        // Include impersonation info in session
        if (token.impersonation?.isImpersonating) {
          session.impersonation = token.impersonation
          // Update displayed user info to impersonated user
          session.user.id = token.impersonation.impersonatedUserId
          session.user.role = token.impersonation.impersonatedUserRole
          session.user.name = token.impersonation.impersonatedUserName || session.user.name
          session.user.email = token.impersonation.impersonatedUserEmail || session.user.email
        }
      }
      return session
    }
  },
  events: {
    async signIn({ user, account, isNewUser }) {
      console.log(`User signed in: ${user.email} (${account?.provider})`)
    },
    async createUser({ user }) {
      console.log(`New user created: ${user.email}`)
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}
