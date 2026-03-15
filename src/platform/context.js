import { MemoryStore } from "./store.js";
import { PostgresStore } from "./postgres-store.js";
import { getConfig } from "./config.js";
import { AuditService } from "../services/audit.service.js";
import { PermissionCatalog } from "../services/permission-catalog.service.js";
import { PolicyService } from "../services/policy.service.js";
import { AuthService } from "../services/auth.service.js";
import { RbacService } from "../services/rbac.service.js";
import { CommunityService } from "../services/community.service.js";
import { OperationsService } from "../services/operations.service.js";
import { IntegrationsService } from "../services/integrations.service.js";

async function createStore({ config, initialState }) {
  if (config.storageDriver === "postgres") {
    return PostgresStore.create({
      databaseUrl: config.databaseUrl,
      initialState,
      seedOnBoot: config.seedOnBoot,
    });
  }

  return new MemoryStore(initialState);
}

export async function createPlatformContext({ initialState = {}, config } = {}) {
  const resolvedConfig = config ?? getConfig();
  const store = await createStore({ config: resolvedConfig, initialState });
  const permissionCatalog = new PermissionCatalog();
  const audit = new AuditService(store);
  const policy = new PolicyService(store);
  const auth = new AuthService(store, audit, policy);
  const rbac = new RbacService(store, audit, policy);
  const community = new CommunityService(store, audit, policy, rbac);
  const operations = new OperationsService(store, policy);
  const integrations = new IntegrationsService(store, audit, policy, rbac);

  return {
    config: resolvedConfig,
    store,
    services: {
      permissionCatalog,
      audit,
      policy,
      auth,
      rbac,
      community,
      operations,
      integrations,
    },
    async close() {
      await store.close();
    },
  };
}
