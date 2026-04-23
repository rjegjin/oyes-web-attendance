import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

declare global {
  var prisma: PrismaClient | undefined;
  var prismaAdapter: PrismaPg | undefined;
}

function getRuntimeConnectionString() {
  const rawUrl =
    process.env.DATABASE_URL ??
    process.env.PRISMA_DATABASE_URL ??
    "postgresql://oyes:oyes@localhost:55432/oyes_attendance?schema=public";

  try {
    const url = new URL(rawUrl);

    if (url.hostname === "db.prisma.io") {
      url.hostname = "pooled.db.prisma.io";
    }

    return url.toString();
  } catch {
    return rawUrl;
  }
}

const connectionString = getRuntimeConnectionString();

const adapter =
  global.prismaAdapter ??
  new PrismaPg({
    connectionString,
    max: 1,
  });

if (!global.prismaAdapter) {
  global.prismaAdapter = adapter;
}

export const prisma =
  global.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (!global.prisma) {
  global.prisma = prisma;
}
