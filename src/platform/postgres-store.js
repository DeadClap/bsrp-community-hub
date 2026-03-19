import { badRequest } from "../shared/errors.js";
import { migrateDatabase } from "./migrations.js";

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

function normalizeTimestamp(value) {
  if (value == null) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
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
        createdAt: normalizeTimestamp(row.created_at),
        reviewedAt: normalizeTimestamp(row.reviewed_at),
        reviewedBy: row.reviewed_by,
        reviewNotes: row.review_notes,
      };
    },
  },
  connectedAccounts: {
    table: "hub_connected_accounts",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        lastSyncedAt: normalizeTimestamp(row.last_synced_at),
        provisionedAt: normalizeTimestamp(row.provisioned_at),
      };
    },
  },
  departments: {
    table: "hub_departments",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
    columns: [
      { name: "department_id" },
      { name: "slug" },
      { name: "name" },
      { name: "sort_order" },
      jsonColumn("permissions", []),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        department_id: value.departmentId,
        slug: value.slug,
        name: value.name,
        sort_order: value.sortOrder ?? 0,
        permissions: value.permissions ?? [],
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        departmentId: row.department_id,
        slug: row.slug,
        name: row.name,
        sortOrder: row.sort_order ?? 0,
        permissions: row.permissions ?? [],
      };
    },
  },
  memberships: {
    table: "hub_memberships",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        assignedAt: normalizeTimestamp(row.assigned_at),
      };
    },
  },
  permissionGrants: {
    table: "hub_permission_grants",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        linkedAt: normalizeTimestamp(row.linked_at),
      };
    },
  },
  userGameAccess: {
    table: "hub_user_game_access",
    idColumn: "id",
    normalizeId: normalizeTextId,
    columns: [
      { name: "user_id" },
      { name: "primary_license" },
      { name: "whitelist_status" },
      { name: "ban_status" },
      jsonColumn("notes", []),
    ],
    toRow(value) {
      return {
        id: String(value.id),
        user_id: normalizeIntegerId(value.userId),
        primary_license: value.primaryLicense,
        whitelist_status: value.whitelistStatus,
        ban_status: value.banStatus,
        notes: value.notes ?? [],
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        userId: row.user_id,
        primaryLicense: row.primary_license,
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
    columns: [
      { name: "kind" },
      { name: "server_id" },
      { name: "access_id" },
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
        access_id: value.accessId ?? null,
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
        accessId: row.access_id,
        actorUserId: row.actor_user_id,
        action: row.action,
        createdAt: normalizeTimestamp(row.created_at),
        metadata: row.metadata ?? {},
      };
    },
  },
  auditEvents: {
    table: "hub_audit_events",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        createdAt: normalizeTimestamp(row.created_at),
        metadata: row.metadata ?? {},
      };
    },
  },
  accessRequests: {
    table: "hub_access_requests",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        submittedAt: normalizeTimestamp(row.submitted_at),
        notes: row.notes,
        decidedAt: normalizeTimestamp(row.decided_at),
        decidedBy: row.decided_by,
        decisionNotes: row.decision_notes,
      };
    },
  },
  sessions: {
    table: "hub_sessions",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
        createdAt: normalizeTimestamp(row.created_at),
        revokedAt: normalizeTimestamp(row.revoked_at),
      };
    },
  },
  oauthStates: {
    table: "hub_oauth_states",
    idColumn: "id",
    normalizeId: normalizeTextId,
    columns: [
      { name: "status" },
      { name: "created_at" },
      { name: "expires_at" },
      { name: "consumed_at" },
      { name: "expired_at" },
      { name: "discord_user_id" },
      { name: "return_to" },
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
        return_to: value.returnTo ?? null,
      };
    },
    fromRow(row) {
      return {
        id: row.id,
        status: row.status,
        createdAt: normalizeTimestamp(row.created_at),
        expiresAt: normalizeTimestamp(row.expires_at),
        consumedAt: normalizeTimestamp(row.consumed_at),
        expiredAt: normalizeTimestamp(row.expired_at),
        discordUserId: row.discord_user_id,
        returnTo: row.return_to,
      };
    },
  },
  integrationMappings: {
    table: "hub_integration_mappings",
    idColumn: "id",
    normalizeId: normalizeTextId,
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
    await migrateDatabase(pool);
    const store = new PostgresStore(pool);

    if (seedOnBoot && (await store.isEmpty())) {
      await store.seed(initialState);
    }

    return store;
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
    const result = await this.pool.query(`SELECT * FROM ${spec.table} ORDER BY ${spec.idColumn}`);
    return result.rows.map((row) => spec.fromRow(row));
  }

  async get(collection, id) {
    const spec = getSpec(collection);
    const normalizedId = spec.normalizeId(id);
    const result = await this.pool.query(`SELECT * FROM ${spec.table} WHERE ${spec.idColumn} = $1`, [normalizedId]);
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

