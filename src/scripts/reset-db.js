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

await store.reset();

if (config.seedOnBoot) {
  await store.seed(createSeedState());
  console.log(`Reset and reseeded Postgres data using ${config.databaseUrl}`);
} else {
  console.log(`Reset Postgres data using ${config.databaseUrl}`);
}

await store.close();
