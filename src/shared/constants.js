export const ACCOUNT_PROVIDER = {
  DISCORD: "discord",
};

export const USER_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  SUSPENDED: "suspended",
  REJECTED: "rejected",
};

export const MEMBERSHIP_STATUS = {
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REVOKED: "revoked",
};

export const ACCESS_REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  DENIED: "denied",
};

export const SESSION_STATUS = {
  ACTIVE: "active",
  REVOKED: "revoked",
};

export const EVENT_KIND = {
  ADMIN_ACTION: "admin.action",
  PLAYER_CONNECTED: "player.connected",
  PLAYER_DISCONNECTED: "player.disconnected",
  BAN_SYNCED: "ban.synced",
};

export const PERMISSIONS = [
  {
    key: "rbac.manage",
    domain: "rbac",
    description: "Manage departments, roles, and assignments",
  },
  {
    key: "community.review_access",
    domain: "community",
    description: "Approve or deny staff access requests",
  },
  {
    key: "community.manage_members",
    domain: "community",
    description: "Suspend or revoke community member access",
  },
  {
    key: "integrations.manage_discord",
    domain: "integrations",
    description: "Manage Discord role mappings and sync jobs",
  },
  {
    key: "integrations.manage_fivem",
    domain: "integrations",
    description: "Manage FiveM integration events and whitelist decisions",
  },
  {
    key: "operations.view_player",
    domain: "operations",
    description: "View player profiles and operational history",
  },
  {
    key: "audit.view",
    domain: "audit",
    description: "View immutable audit events",
  },
];
