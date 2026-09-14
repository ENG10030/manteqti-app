import "next-auth"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
      role: string
      isBlocked: boolean
    }
  }

  interface User {
    id: string
    role: string
    isBlocked: boolean
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    isBlocked: boolean
  }
}
