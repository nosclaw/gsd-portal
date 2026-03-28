import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";

import { appEnv, ensureRuntimePaths } from "@/lib/env";
import { ensureSchema, seedIfEmpty } from "@/lib/db/init";
import * as schema from "./schema";

const initializeDb = async () => {
  await ensureRuntimePaths();
  const client = createClient({ url: `file:${appEnv.sqliteDbPath}` });
  const db = drizzle(client, { schema });
  await ensureSchema(db);
  await seedIfEmpty(db);
  return db;
};

let dbInstance: any;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await initializeDb();
  }
  return dbInstance;
};
