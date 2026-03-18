import { loadEnvFile } from "../platform/env.js";
import { getConfig, validateConfig } from "../platform/config.js";
import { PostgresStore } from "../platform/postgres-store.js";
import { createSeedState } from "../seed.js";

loadEnvFile();

const config = validateConfig(getConfig());
const store = await PostgresStore.create({
  databaseUrl: config.databaseUrl,
  initialState: {},
  seedOnBoot: false,
});

const seedState = createSeedState();
await store.seed(seedState);

console.log(`Seeded Postgres data using ${config.databaseUrl}`);
await store.close();
