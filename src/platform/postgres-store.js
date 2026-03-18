import { badRequest } from "../shared/errors.js";

function normalizeTextId(id) {
  return String(id);
}

function normalizeIntegerId(id) {
  const value = Number(id);
  if (!Number.isInteger(value)) {
    badRequest(`Invalid integer id: ${id}`);
  }
  return value;
}

function jsonColumn(name, fallback) {
  return {
    name,
    cast: "jsonb",
    fallback,
  };
}

const COLLECTION_SPECS = {
  users: {
    table: "hub_users",
    idColumn: "id",
    normalizeId: normalizeIntegerId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_users (
        id INTEGER PRIMARY KEY,
        display_name TEXT NOT NULL,
        email TEXT,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        reviewed_at TIMESTAMPTZ,
        reviewed_by TEXT,
        review_notes TEXT
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_users_status_idx ON hub_users (status)",
    ],
    columns: [
      { name: "display_name" },
      { name: "email" },
      { name: "status" },
      { name: "created_at" },
      { name: "reviewed_at" },
      { name: "reviewed_by" },
      { name: "review_notes" },
    ],
    toRow(value) {
      return {
        id: normalizeIntegerId(value.id),
        display_name: value.displayName,
        email: value.email ?? null,
        status: value.status,
        created_at: value.createdAt,
        reviewed_at: value.reviewedAt ?? null,
        reviewed_by: value.reviewedBy ?? null,
        review_notes: value.reviewNotes ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        displayName: row.display_name,
        email: row.email,
        status: row.status,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
        reviewedBy: row.reviewed_by,
        reviewNotes: row.review_notes,
      };
    },
  },
  connectedAccounts: {
    table: "hub_connected_accounts",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_connected_accounts (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_account_id TEXT NOT NULL,
        username TEXT NOT NULL,
        guild_member BOOLEAN NOT NULL DEFAULT FALSE,
        roles JSONB NOT NULL DEFAULT '[]'::jsonb,
        last_synced_at TIMESTAMPTZ,
        provisioned_at TIMESTAMPTZ,
        UNIQUE (provider, provider_account_id)
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_connected_accounts_user_id_idx ON hub_connected_accounts (user_id)",
    ],
    columns: [
      { name: "user_id" },
      { name: "provider" },
      { name: "provider_account_id" },
      { name: "username" },
      { name: "guild_member" },
      jsonColumn("roles", []),
      { name: "last_synced_at" },
      { name: "provisioned_at" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        provider: value.provider,
        provider_account_id: value.providerAccountId,
        username: value.username,
        guild_member: Boolean(value.guildMember),
        roles: value.roles ?? [],
        last_synced_at: value.lastSyncedAt ?? null,
        provisioned_at: value.provisionedAt ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        provider: row.provider,
        providerAccountId: row.provider_account_id,
        username: row.username,
        guildMember: row.guild_member,
        roles: row.roles ?? [],
        lastSyncedAt: row.last_synced_at,
        provisionedAt: row.provisioned_at,
      };
    },
  },
  departments: {
    table: "hub_departments",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_departments (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL
      )
    `,
    indexes: [],
    columns: [{ name: "slug" }, { name: "name" }],
    toRow(value) {
      return {
        id: String(value.id),
        slug: value.slug,
        name: value.name,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        slug: row.slug,
        name: row.name,
      };
    },
  },
  roles: {
    table: "hub_roles",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_roles (
        id TEXT PRIMARY KEY,
        department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
        slug TEXT NOT NULL,
        name TEXT NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        UNIQUE (department_id, slug)
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_roles_department_id_idx ON hub_roles (department_id)",
    ],
    columns: [
      { name: "department_id" },
      { name: "slug" },
      { name: "name" },
      jsonColumn("permissions", []),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        department_id: value.departmentId,
        slug: value.slug,
        name: value.name,
        permissions: value.permissions ?? [],
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        departmentId: row.department_id,
        slug: row.slug,
        name: row.name,
        permissions: row.permissions ?? [],
      };
    },
  },
  memberships: {
    table: "hub_memberships",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_memberships (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        assigned_by TEXT,
        assigned_at TIMESTAMPTZ
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_memberships_user_id_idx ON hub_memberships (user_id)",
      "CREATE INDEX IF NOT EXISTS hub_memberships_department_id_idx ON hub_memberships (department_id)",
      "CREATE INDEX IF NOT EXISTS hub_memberships_role_id_idx ON hub_memberships (role_id)",
      "CREATE INDEX IF NOT EXISTS hub_memberships_status_idx ON hub_memberships (status)",
    ],
    columns: [
      { name: "user_id" },
      { name: "department_id" },
      { name: "role_id" },
      { name: "status" },
      { name: "assigned_by" },
      { name: "assigned_at" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        department_id: value.departmentId,
        role_id: value.roleId,
        status: value.status,
        assigned_by: value.assignedBy != null ? String(value.assignedBy) : null,
        assigned_at: value.assignedAt ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        departmentId: row.department_id,
        roleId: row.role_id,
        status: row.status,
        assignedBy: row.assigned_by,
        assignedAt: row.assigned_at,
      };
    },
  },
  permissionGrants: {
    table: "hub_permission_grants",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_permission_grants (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        permission TEXT NOT NULL,
        effect TEXT NOT NULL,
        scope TEXT NOT NULL
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_permission_grants_user_id_idx ON hub_permission_grants (user_id)",
    ],
    columns: [
      { name: "user_id" },
      { name: "permission" },
      { name: "effect" },
      { name: "scope" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        permission: value.permission,
        effect: value.effect,
        scope: value.scope,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        permission: row.permission,
        effect: row.effect,
        scope: row.scope,
      };
    },
  },
  identityLinks: {
    table: "hub_identity_links",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_identity_links (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        license TEXT NOT NULL UNIQUE,
        discord_id TEXT,
        linked_at TIMESTAMPTZ NOT NULL
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_identity_links_user_id_idx ON hub_identity_links (user_id)",
      "CREATE INDEX IF NOT EXISTS hub_identity_links_discord_id_idx ON hub_identity_links (discord_id)",
    ],
    columns: [
      { name: "user_id" },
      { name: "type" },
      { name: "license" },
      { name: "discord_id" },
      { name: "linked_at" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        type: value.type,
        license: value.license,
        discord_id: value.discordId ?? null,
        linked_at: value.linkedAt,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        type: row.type,
        license: row.license,
        discordId: row.discord_id,
        linkedAt: row.linked_at,
      };
    },
  },
  playerProfiles: {
    table: "hub_player_profiles",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_player_profiles (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        character_name TEXT NOT NULL,
        license TEXT NOT NULL UNIQUE,
        whitelist_status TEXT NOT NULL,
        ban_status TEXT NOT NULL,
        notes JSONB NOT NULL DEFAULT '[]'::jsonb
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_player_profiles_user_id_idx ON hub_player_profiles (user_id)",
    ],
    columns: [
      { name: "user_id" },
      { name: "character_name" },
      { name: "license" },
      { name: "whitelist_status" },
      { name: "ban_status" },
      jsonColumn("notes", []),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        character_name: value.characterName,
        license: value.license,
        whitelist_status: value.whitelistStatus,
        ban_status: value.banStatus,
        notes: value.notes ?? [],
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        characterName: row.character_name,
        license: row.license,
        whitelistStatus: row.whitelist_status,
        banStatus: row.ban_status,
        notes: row.notes ?? [],
      };
    },
  },
  serverConnections: {
    table: "hub_server_connections",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_server_connections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        environment TEXT NOT NULL,
        status TEXT NOT NULL
      )
    `,
    indexes: [],
    columns: [{ name: "name" }, { name: "environment" }, { name: "status" }],
    toRow(value) {
      return {
        id: String(value.id),
        name: value.name,
        environment: value.environment,
        status: value.status,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        name: row.name,
        environment: row.environment,
        status: row.status,
      };
    },
  },
  operationalEvents: {
    table: "hub_operational_events",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_operational_events (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        server_id TEXT REFERENCES hub_server_connections (id) ON DELETE SET NULL,
        player_id TEXT REFERENCES hub_player_profiles (id) ON DELETE SET NULL,
        actor_user_id TEXT,
        action TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_operational_events_player_id_idx ON hub_operational_events (player_id)",
      "CREATE INDEX IF NOT EXISTS hub_operational_events_server_id_idx ON hub_operational_events (server_id)",
      "CREATE INDEX IF NOT EXISTS hub_operational_events_kind_idx ON hub_operational_events (kind)",
      "CREATE INDEX IF NOT EXISTS hub_operational_events_created_at_idx ON hub_operational_events (created_at)",
    ],
    columns: [
      { name: "kind" },
      { name: "server_id" },
      { name: "player_id" },
      { name: "actor_user_id" },
      { name: "action" },
      { name: "created_at" },
      jsonColumn("metadata", {}),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        kind: value.kind,
        server_id: value.serverId ?? null,
        player_id: value.playerId ?? null,
        actor_user_id: value.actorUserId != null ? String(value.actorUserId) : null,
        action: value.action,
        created_at: value.createdAt,
        metadata: value.metadata ?? {},
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        kind: row.kind,
        serverId: row.server_id,
        playerId: row.player_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        createdAt: row.created_at,
        metadata: row.metadata ?? {},
      };
    },
  },
  auditEvents: {
    table: "hub_audit_events",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_audit_events (
        id TEXT PRIMARY KEY,
        action TEXT NOT NULL,
        actor_user_id TEXT,
        target_type TEXT NOT NULL,
        target_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_audit_events_created_at_idx ON hub_audit_events (created_at)",
      "CREATE INDEX IF NOT EXISTS hub_audit_events_actor_user_id_idx ON hub_audit_events (actor_user_id)",
    ],
    columns: [
      { name: "action" },
      { name: "actor_user_id" },
      { name: "target_type" },
      { name: "target_id" },
      { name: "created_at" },
      jsonColumn("metadata", {}),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        action: value.action,
        actor_user_id: value.actorUserId != null ? String(value.actorUserId) : null,
        target_type: value.targetType,
        target_id: String(value.targetId),
        created_at: value.createdAt,
        metadata: value.metadata ?? {},
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        action: row.action,
        actorUserId: row.actor_user_id,
        targetType: row.target_type,
        targetId: row.target_id,
        createdAt: row.created_at,
        metadata: row.metadata ?? {},
      };
    },
  },
  accessRequests: {
    table: "hub_access_requests",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_access_requests (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
        requested_role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        submitted_at TIMESTAMPTZ NOT NULL,
        notes TEXT,
        decided_at TIMESTAMPTZ,
        decided_by TEXT,
        decision_notes TEXT
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_access_requests_user_id_idx ON hub_access_requests (user_id)",
      "CREATE INDEX IF NOT EXISTS hub_access_requests_status_idx ON hub_access_requests (status)",
    ],
    columns: [
      { name: "user_id" },
      { name: "department_id" },
      { name: "requested_role_id" },
      { name: "status" },
      { name: "submitted_at" },
      { name: "notes" },
      { name: "decided_at" },
      { name: "decided_by" },
      { name: "decision_notes" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        department_id: value.departmentId,
        requested_role_id: value.requestedRoleId,
        status: value.status,
        submitted_at: value.submittedAt,
        notes: value.notes ?? null,
        decided_at: value.decidedAt ?? null,
        decided_by: value.decidedBy != null ? String(value.decidedBy) : null,
        decision_notes: value.decisionNotes ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        departmentId: row.department_id,
        requestedRoleId: row.requested_role_id,
        status: row.status,
        submittedAt: row.submitted_at,
        notes: row.notes,
        decidedAt: row.decided_at,
        decidedBy: row.decided_by,
        decisionNotes: row.decision_notes,
      };
    },
  },
  sessions: {
    table: "hub_sessions",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES hub_users (id) ON DELETE CASCADE,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_sessions_user_id_idx ON hub_sessions (user_id)",
      "CREATE INDEX IF NOT EXISTS hub_sessions_status_idx ON hub_sessions (status)",
    ],
    columns: [
      { name: "user_id" },
      { name: "status" },
      { name: "created_at" },
      { name: "revoked_at" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        status: value.status,
        created_at: value.createdAt,
        revoked_at: value.revokedAt ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        status: row.status,
        createdAt: row.created_at,
        revokedAt: row.revoked_at,
      };
    },
  },
  oauthStates: {
    table: "hub_oauth_states",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_oauth_states (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        expired_at TIMESTAMPTZ,
        discord_user_id TEXT
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_oauth_states_status_idx ON hub_oauth_states (status)",
      "CREATE INDEX IF NOT EXISTS hub_oauth_states_expires_at_idx ON hub_oauth_states (expires_at)",
    ],
    columns: [
      { name: "status" },
      { name: "created_at" },
      { name: "expires_at" },
      { name: "consumed_at" },
      { name: "expired_at" },
      { name: "discord_user_id" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        status: value.status,
        created_at: value.createdAt,
        expires_at: value.expiresAt,
        consumed_at: value.consumedAt ?? null,
        expired_at: value.expiredAt ?? null,
        discord_user_id: value.discordUserId ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        status: row.status,
        createdAt: row.created_at,
        expiresAt: row.expires_at,
        consumedAt: row.consumed_at,
        expiredAt: row.expired_at,
        discordUserId: row.discord_user_id,
      };
    },
  },
  integrationMappings: {
    table: "hub_integration_mappings",
    idColumn: "id",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_integration_mappings (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        external_role_id TEXT NOT NULL,
        department_id TEXT NOT NULL REFERENCES hub_departments (id) ON DELETE CASCADE,
        role_id TEXT NOT NULL REFERENCES hub_roles (id) ON DELETE CASCADE,
        direction TEXT NOT NULL,
        UNIQUE (provider, external_role_id, direction)
      )
    `,
    indexes: [
      "CREATE INDEX IF NOT EXISTS hub_integration_mappings_role_id_idx ON hub_integration_mappings (role_id)",
    ],
    columns: [
      { name: "provider" },
      { name: "external_role_id" },
      { name: "department_id" },
      { name: "role_id" },
      { name: "direction" },
    ],
    toRow(value) {
      return {
        id: String(value.id),
        provider: value.provider,
        external_role_id: value.externalRoleId,
        department_id: value.departmentId,
        role_id: value.roleId,
        direction: value.direction,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        provider: row.provider,
        externalRoleId: row.external_role_id,
        departmentId: row.department_id,
        roleId: row.role_id,
        direction: row.direction,
      };
    },
  },
  processedEventKeys: {
    table: "hub_processed_event_keys",
    idColumn: "event_key",
    normalizeId: normalizeTextId,
    createTable: `
      CREATE TABLE IF NOT EXISTS hub_processed_event_keys (
        event_key TEXT PRIMARY KEY
      )
    `,
    indexes: [],
    columns: [],
    toRow(value) {
      return {
        event_key: String(value),
      };
    },
    fromRow(row) {
      return row.event_key;
    },
  },
};

function getSpec(collection) {
  const spec = COLLECTION_SPECS[collection];
  if (!spec) {
    badRequest(`Unknown collection: ${collection}`);
  }
  return spec;
}

function prepareColumnValue(spec, column, value) {
  const columnSpec = spec.columns.find((entry) => entry.name === column);
  if (columnSpec?.cast === "jsonb") {
    return JSON.stringify(value ?? columnSpec.fallback ?? null);
  }
  return value;
}

function buildInsertStatement(spec, row) {
  const columnNames = Object.keys(row);
  const values = columnNames.map((column) => prepareColumnValue(spec, column, row[column]));
  const placeholders = columnNames.map((column, index) => {
    const columnSpec = spec.columns.find((entry) => entry.name === column);
    const cast = columnSpec?.cast;
    return `$${index + 1}${cast ? `::${cast}` : ""}`;
  });

  return {
    sql: `INSERT INTO ${spec.table} (${columnNames.join(", ")}) VALUES (${placeholders.join(", ")}) ON CONFLICT (${spec.idColumn}) DO NOTHING`,
    values,
  };
}

function buildUpdateStatement(spec, row) {
  const entries = Object.entries(row).filter(([column]) => column !== spec.idColumn);
  const assignments = entries.map(([column], index) => {
    const columnSpec = spec.columns.find((entry) => entry.name === column);
    const cast = columnSpec?.cast;
    return `${column} = $${index + 2}${cast ? `::${cast}` : ""}`;
  });

  return {
    sql: `UPDATE ${spec.table} SET ${assignments.join(", ")} WHERE ${spec.idColumn} = $1`,
    values: [
      row[spec.idColumn],
      ...entries.map(([column, value]) => prepareColumnValue(spec, column, value)),
    ],
  };
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
      await this.ensureTableShape(spec);
      await this.pool.query(spec.createTable);
      for (const indexSql of spec.indexes) {
        await this.pool.query(indexSql);
      }
    }
  }

  async ensureTableShape(spec) {
    const result = await this.pool.query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
      `,
      [spec.table],
    );

    if (result.rows.length === 0) {
      return;
    }

    const columns = new Set(result.rows.map((row) => row.column_name));
    if (columns.has("payload") && columns.has("updated_at")) {
      await this.pool.query(`DROP TABLE IF EXISTS ${spec.table} CASCADE`);
    }
  }

  async reset() {
    const tables = Object.values(COLLECTION_SPECS)
      .map((spec) => spec.table)
      .reverse()
      .join(", ");

    await this.pool.query(`TRUNCATE TABLE ${tables} RESTART IDENTITY CASCADE`);
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
    const result = await this.pool.query(
      `SELECT * FROM ${spec.table} ORDER BY ${spec.idColumn}`,
    );
    return result.rows.map((row) => spec.fromRow(row));
  }

  async get(collection, id) {
    const spec = getSpec(collection);
    const normalizedId = spec.normalizeId(id);
    const result = await this.pool.query(
      `SELECT * FROM ${spec.table} WHERE ${spec.idColumn} = $1`,
      [normalizedId],
    );
    const row = result.rows[0];
    return row ? spec.fromRow(row) : null;
  }

  async insert(collection, value) {
    const spec = getSpec(collection);
    const row = spec.toRow(value);
    const statement = buildInsertStatement(spec, row);
    await this.pool.query(statement.sql, statement.values);
    return value;
  }

  async replace(collection, id, updater) {
    const spec = getSpec(collection);
    const current = await this.get(collection, id);
    if (!current) {
      return null;
    }

    const next = await updater(current);
    const row = spec.toRow(next);
    const statement = buildUpdateStatement(spec, row);
    await this.pool.query(statement.sql, statement.values);
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
