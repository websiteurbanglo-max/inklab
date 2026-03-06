import { PrismaClient } from "@prisma/client";

// Singleton pattern — applies in both dev (hot-reload safe) and production
if (!global.prismaGlobal) {
  console.log(
    "[db] Creating new PrismaClient (NODE_ENV:",
    process.env.NODE_ENV,
    ")",
  );
  global.prismaGlobal = new PrismaClient();
  // Verify the DB connection immediately so startup failures are visible
  global.prismaGlobal
    .$connect()
    .then(() => console.log("[db] Prisma connected to SQLite OK"))
    .catch((err) => console.error("[db] Prisma $connect() FAILED:", err));
}

const prisma = global.prismaGlobal;

export default prisma;
