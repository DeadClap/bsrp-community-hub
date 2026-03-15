import { createApp } from "./app.js";
import { loadEnvFile } from "./platform/env.js";
import { getConfig, validateConfig } from "./platform/config.js";
import { createSeedState } from "./seed.js";

loadEnvFile();

const config = validateConfig(getConfig());
const initialState = config.seedOnBoot ? createSeedState() : {};
const app = await createApp({ initialState, config });

app.server.listen(config.port, () => {
  console.log(`BSRP Community Hub listening on http://localhost:${config.port} using ${config.storageDriver} storage`);
});
