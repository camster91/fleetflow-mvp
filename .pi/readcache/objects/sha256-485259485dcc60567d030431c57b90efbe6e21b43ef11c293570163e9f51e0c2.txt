import { prisma } from './prisma'
import { PrismaAdapter } from "@next-auth/prisma-adapter"
import CredentialsProvider from "next-auth/providers/credentials"
import bcrypt from 'bcryptjs'

export const authOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials: any) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid email or password')
        }
        
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() }
        })
        
        if (!user || !user.password) {
          throw new Error('Invalid email or password')
        }
        
        const isValidPassword = await bcrypt.compare(credentials.password, user.password)
        
        if (!isValidPassword) {
          throw new Error('Invalid email or password')
        }
        
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }: any) {
      if (user) {
        // Fresh login — store role and password change sentinel
        token.role = user.role
        token.passwordChangedAt = null
      } else if (token.sub) {
        // Token refresh — check if password was changed since token was issued
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { passwordChangedAt: true, role: true },
        })
        if (dbUser) {
          // If password was changed after this token was issued, invalidate it
          if (dbUser.passwordChangedAt && token.iat) {
            const changedAt = new Date(dbUser.passwordChangedAt).getTime() / 1000
            if (changedAt > (token.iat as number)) {
              // Return empty token to force re-login
              return {}
            }
          }
          token.role = dbUser.role
        }
      }
      return token
    },
    async session({ session, token }: any) {
      // If token was invalidated (empty), clear the session
      if (!token.sub) return { ...session, user: undefined }
      if (session.user) {
        session.user.id = token.sub          // Prisma user ID
        session.user.role = token.role
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt' as const,
  },
  secret: process.env.NEXTAUTH_SECRET ?? (() => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXTAUTH_SECRET environment variable is not set');
    }
    return 'dev-only-placeholder-not-for-production';
  })(),
}
