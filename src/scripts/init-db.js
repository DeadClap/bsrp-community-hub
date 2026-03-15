import { loadEnvFile } from "../platform/env.js";
import { getConfig, validateConfig } from "../platform/config.js";
import { PostgresStore } from "../platform/postgres-store.js";

loadEnvFile();

const config = validateConfig(getConfig());
const store = await PostgresStore.create({
  databaseUrl: config.databaseUrl,
  initialState: {},
  seedOnBoot: false,
});

console.log(`Initialized Postgres schema using ${config.databaseUrl}`);
await store.close();
