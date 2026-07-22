import { PrismaClient } from "@prisma/client";

// In development, Next.js hot-reloads modules which would create a new
// PrismaClient on every reload — eventually exhausting connections.
// This singleton pattern reuses the client across reloads.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
