import { PrismaClient } from "@prisma/client";

// Fix DATABASE_URL for Supabase compatibility
function fixDatabaseUrl(url: string): string {
  if (!url) return url;
  
  // Supabase requires sslmode=require - add it if missing
  if (!url.includes("sslmode=")) {
    url += url.includes("?") ? "&sslmode=require" : "?sslmode=require";
  }
  
  // Ensure pgbouncer=true is present for Supabase pooler (port 6543)
  if (url.includes(":6543") && !url.includes("pgbouncer=true")) {
    url += "&pgbouncer=true";
  }
  
  return url;
}

const fixedDatabaseUrl = fixDatabaseUrl(process.env.DATABASE_URL || "");
const fixedDirectUrl = process.env.DIRECT_DATABASE_URL 
  ? fixDatabaseUrl(process.env.DIRECT_DATABASE_URL) 
  : undefined;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Prisma Client with serverless-optimized settings
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    datasources: {
      db: {
        url: fixedDatabaseUrl,
        ...(fixedDirectUrl ? { directUrl: fixedDirectUrl } : {}),
      },
    },
    // Serverless connection pool settings for Vercel
    // Each serverless function instance gets its own PrismaClient
    // With pgbouncer, we keep connection_limit small
    ...(process.env.NODE_ENV === "production" ? {
      __internal: {
        engine: {
          // Reduce connection overhead in serverless
          connectionLimit: 3,
          poolTimeout: 15,
        },
      },
    } : {}),
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Log fixed URL on startup (hide password)
if (process.env.NODE_ENV === "development") {
  const safeUrl = fixedDatabaseUrl.replace(/\/\/[^:]+:[^@]+@/, "//***:***@");
  console.log(`[DB] Using database URL: ${safeUrl}`);
}
