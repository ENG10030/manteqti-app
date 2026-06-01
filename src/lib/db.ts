import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Vercel serverless: cache PrismaClient on global to avoid too many connections
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["error"],
  });

// Always cache on global (even in production) to avoid connection pool exhaustion on Vercel
if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = db;
}
