import { UserRole } from './index'
import 'next-auth'

declare module 'next-auth' {
  interface User {
    role: UserRole
    company?: string
  }
  
  interface Session {
    user: {
      id: string
      name?: string | null
      email?: string | null
      image?: string | null
      role: UserRole
      company?: string | null
    }
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    role: UserRole
    company?: string | null
  }
}