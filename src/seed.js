import {
  ACCESS_REQUEST_STATUS,
  ACCOUNT_PROVIDER,
  EVENT_KIND,
  MEMBERSHIP_STATUS,
  SESSION_STATUS,
  USER_STATUS,
} from "./shared/constants.js";

export function createSeedState() {
  return {
    users: [
      {
        id: 1,
        displayName: "Chief Harper",
        email: "harper@bsrp.local",
        status: USER_STATUS.ACTIVE,
        createdAt: "2026-03-15T12:00:00.000Z",
      },
      {
        id: 2,
        displayName: "Officer Lane",
        email: "lane@bsrp.local",
        status: USER_STATUS.ACTIVE,
        createdAt: "2026-03-15T12:00:00.000Z",
      },
    ],
    connectedAccounts: [
      {
        id: "connected_1",
        userId: 1,
        provider: ACCOUNT_PROVIDER.DISCORD,
        providerAccountId: "discord-chief",
        username: "chiefharper",
        guildMember: true,
        roles: ["guild_member", "leo_command"],
      },
      {
        id: "connected_2",
        userId: 2,
        provider: ACCOUNT_PROVIDER.DISCORD,
        providerAccountId: "discord-lane",
        username: "officerlane",
        guildMember: true,
        roles: ["guild_member", "leo_member"],
      },
    ],
    departments: [
      {
        id: "dept_1",
        slug: "law-enforcement",
        name: "Law Enforcement",
      },
      {
        id: "dept_2",
        slug: "staff",
        name: "Community Staff",
      },
    ],
    roles: [
      {
        id: "role_1",
        departmentId: "dept_1",
        slug: "chief",
        name: "Chief",
        permissions: [
          "rbac.manage",
          "community.review_access",
          "operations.view_player",
          "integrations.manage_discord",
          "integrations.manage_fivem",
        ],
      },
      {
        id: "role_2",
        departmentId: "dept_1",
        slug: "officer",
        name: "Officer",
        permissions: ["operations.view_player"],
      },
      {
        id: "role_3",
        departmentId: "dept_2",
        slug: "community-admin",
        name: "Community Admin",
        permissions: [
          "community.review_access",
          "audit.view",
          "integrations.manage_discord",
        ],
      },
    ],
    memberships: [
      {
        id: "membership_1",
        userId: 1,
        departmentId: "dept_1",
        roleId: "role_1",
        status: MEMBERSHIP_STATUS.ACTIVE,
        assignedBy: "system",
      },
      {
        id: "membership_2",
        userId: 2,
        departmentId: "dept_1",
        roleId: "role_2",
        status: MEMBERSHIP_STATUS.ACTIVE,
        assignedBy: 1,
      },
    ],
    permissionGrants: [
      {
        id: "grant_1",
        userId: 1,
        permission: "audit.view",
        effect: "allow",
        scope: "global",
      },
    ],
    identityLinks: [
      {
        id: "identity_1",
        userId: 1,
        type: "fivem",
        license: "license:chief-harper",
        discordId: "discord-chief",
        linkedAt: "2026-03-15T12:00:00.000Z",
      },
      {
        id: "identity_2",
        userId: 2,
        type: "fivem",
        license: "license:lane",
        discordId: "discord-lane",
        linkedAt: "2026-03-15T12:00:00.000Z",
      },
    ],
    playerProfiles: [
      {
        id: "player_1",
        userId: 1,
        characterName: "Avery Harper",
        license: "license:chief-harper",
        whitelistStatus: "approved",
        banStatus: "clear",
        notes: [],
      },
      {
        id: "player_2",
        userId: 2,
        characterName: "Jamie Lane",
        license: "license:lane",
        whitelistStatus: "approved",
        banStatus: "clear",
        notes: [],
      },
    ],
    serverConnections: [
      {
        id: "server_1",
        name: "BSRP Main",
        environment: "production",
        status: "online",
      },
    ],
    operationalEvents: [
      {
        id: "event_1",
        kind: EVENT_KIND.ADMIN_ACTION,
        serverId: "server_1",
        playerId: "player_2",
        actorUserId: 1,
        action: "warned",
        createdAt: "2026-03-15T12:15:00.000Z",
        metadata: { reason: "Scene disruption" },
      },
    ],
    auditEvents: [
      {
        id: "audit_1",
        action: "seed.initialized",
        actorUserId: "system",
        targetType: "platform",
        targetId: "seed",
        createdAt: "2026-03-15T12:00:00.000Z",
        metadata: {},
      },
    ],
    accessRequests: [
      {
        id: "request_1",
        userId: 2,
        departmentId: "dept_2",
        requestedRoleId: "role_3",
        status: ACCESS_REQUEST_STATUS.PENDING,
        submittedAt: "2026-03-15T12:30:00.000Z",
      },
    ],
    sessions: [
      {
        id: "session_1",
        userId: 1,
        status: SESSION_STATUS.ACTIVE,
        createdAt: "2026-03-15T12:00:00.000Z",
      },
    ],
    oauthStates: [],
    integrationMappings: [
      {
        id: "mapping_1",
        provider: ACCOUNT_PROVIDER.DISCORD,
        externalRoleId: "leo_command",
        departmentId: "dept_1",
        roleId: "role_1",
        direction: "inbound",
      },
      {
        id: "mapping_2",
        provider: ACCOUNT_PROVIDER.DISCORD,
        externalRoleId: "leo_member",
        departmentId: "dept_1",
        roleId: "role_2",
        direction: "inbound",
      },
    ],
    processedEventKeys: [],
  };
}
