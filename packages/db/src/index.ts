import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/client/client";

/**
 * v7 removed the built-in connection layer: the client no longer reads
 * DATABASE_URL itself, so it is handed a driver adapter instead. `pg` pools
 * over the Neon pooler endpoint, which is what the deployment already used.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export * from "../generated/client/client";
