import { badRequest } from "../shared/errors.js";

const COLLECTION_SPECS = {
  users: { table: "hub_users", kind: "record" },
  connectedAccounts: { table: "hub_connected_accounts", kind: "record" },
  departments: { table: "hub_departments", kind: "record" },
  roles: { table: "hub_roles", kind: "record" },
  memberships: { table: "hub_memberships", kind: "record" },
  permissionGrants: { table: "hub_permission_grants", kind: "record" },
  identityLinks: { table: "hub_identity_links", kind: "record" },
  playerProfiles: { table: "hub_player_profiles", kind: "record" },
  serverConnections: { table: "hub_server_connections", kind: "record" },
  operationalEvents: { table: "hub_operational_events", kind: "record" },
  auditEvents: { table: "hub_audit_events", kind: "record" },
  accessRequests: { table: "hub_access_requests", kind: "record" },
  sessions: { table: "hub_sessions", kind: "record" },
  integrationMappings: { table: "hub_integration_mappings", kind: "record" },
  processedEventKeys: { table: "hub_processed_event_keys", kind: "scalar" },
};

function getSpec(collection) {
  const spec = COLLECTION_SPECS[collection];
  if (!spec) {
    badRequest(`Unknown collection: ${collection}`);
  }
  return spec;
}

export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }

  static async create({ databaseUrl, initialState = {}, seedOnBoot = true }) {
    if (!databaseUrl) {
      badRequest("DATABASE_URL is required when STORAGE_DRIVER=postgres");
    }

    const { Pool } = await import("pg");
    const pool = new Pool({ connectionString: databaseUrl });
    const store = new PostgresStore(pool);
    await store.ensureSchema();

    if (seedOnBoot && (await store.isEmpty())) {
      await store.seed(initialState);
    }

    return store;
  }

  async ensureSchema() {
    for (const spec of Object.values(COLLECTION_SPECS)) {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS ${spec.table} (
          id TEXT PRIMARY KEY,
          payload JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
    }
  }

  async isEmpty() {
    const result = await this.pool.query("SELECT COUNT(*)::int AS count FROM hub_users");
    return result.rows[0].count === 0;
  }

  async seed(state) {
    for (const collection of Object.keys(COLLECTION_SPECS)) {
      for (const item of state[collection] ?? []) {
        await this.insert(collection, item);
      }
    }
  }

  async list(collection) {
    const spec = getSpec(collection);
    const result = await this.pool.query(`SELECT id, payload FROM ${spec.table} ORDER BY id`);

    if (spec.kind === "scalar") {
      return result.rows.map((row) => row.id);
    }

    return result.rows.map((row) => row.payload);
  }

  async get(collection, id) {
    const spec = getSpec(collection);
    const result = await this.pool.query(`SELECT id, payload FROM ${spec.table} WHERE id = $1`, [id]);
    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return spec.kind === "scalar" ? row.id : row.payload;
  }

  async insert(collection, value) {
    const spec = getSpec(collection);
    const id = spec.kind === "scalar" ? value : value.id;
    const payload = spec.kind === "scalar" ? { value } : value;

    await this.pool.query(
      `INSERT INTO ${spec.table} (id, payload, updated_at) VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (id) DO NOTHING`,
      [id, JSON.stringify(payload)],
    );

    return value;
  }

  async replace(collection, id, updater) {
    const current = await this.get(collection, id);
    if (!current) {
      return null;
    }

    const next = await updater(current);
    const spec = getSpec(collection);
    const nextId = spec.kind === "scalar" ? next : next.id;
    const payload = spec.kind === "scalar" ? { value: next } : next;

    await this.pool.query(
      `UPDATE ${spec.table} SET id = $2, payload = $3::jsonb, updated_at = NOW() WHERE id = $1`,
      [id, nextId, JSON.stringify(payload)],
    );

    return next;
  }

  async find(collection, predicate) {
    return (await this.list(collection)).find(predicate) ?? null;
  }

  async filter(collection, predicate) {
    return (await this.list(collection)).filter(predicate);
  }

  async snapshot() {
    const snapshot = {};

    for (const collection of Object.keys(COLLECTION_SPECS)) {
      snapshot[collection] = await this.list(collection);
    }

    return snapshot;
  }

  async close() {
    await this.pool.end();
  }
}

export { COLLECTION_SPECS };
