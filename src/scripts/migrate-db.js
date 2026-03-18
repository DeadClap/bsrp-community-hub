import { loadEnvFile } from "../platform/env.js";
import { getConfig, validateConfig } from "../platform/config.js";
import { PostgresStore } from "../platform/postgres-store.js";
import { migrateDatabase } from "../platform/migrations.js";

loadEnvFile();

const config = validateConfig(getConfig());
const { Pool } = await import("pg");
const pool = new Pool({ connectionString: config.databaseUrl });
await migrateDatabase(pool);
await pool.end();

console.log(`Applied database migrations using ${config.databaseUrl}`);

const store = await PostgresStore.create({
  databaseUrl: config.databaseUrl,
  initialState: {},
  seedOnBoot: false,
});
await store.close();
