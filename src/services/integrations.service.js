import { EVENT_KIND, MEMBERSHIP_STATUS } from "../shared/constants.js";
import { badRequest, forbidden, notFound } from "../shared/errors.js";
import { now, requireFields } from "../shared/utils.js";

function rolePriority(role) {
  return Number(role?.sortOrder ?? role?.priority ?? 0);
}

export class IntegrationsService {
  constructor(store, audit, policy, rbac) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
    this.rbac = rbac;
  }

  async syncDiscordRoles(payload) {
    const missingField = requireFields(payload, ["actorUserId", "discordId", "roles"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "integrations.manage_discord"))) {
      forbidden("Actor lacks integrations.manage_discord");
    }

    const account = await this.store.find(
      "connectedAccounts",
      (item) => item.provider === "discord" && item.providerAccountId === payload.discordId,
    );
    if (!account) {
      notFound("Discord account not found");
    }

    await this.store.replace("connectedAccounts", account.id, (existing) => ({
      ...existing,
      roles: payload.roles,
      lastSyncedAt: now(),
    }));

    const mappings = await this.store.filter(
      "integrationMappings",
      (item) => item.provider === "discord" && item.direction === "inbound" && payload.roles.includes(item.externalRoleId),
    );
    const roles = await this.store.list("roles");
    const preferredMappingsByDepartment = new Map();

    for (const mapping of mappings) {
      const mappedRole = roles.find((role) => role.id === mapping.roleId) ?? null;
      const existing = preferredMappingsByDepartment.get(mapping.departmentId);
      const existingRole = existing ? roles.find((role) => role.id === existing.roleId) ?? null : null;

      if (!existing || rolePriority(mappedRole) > rolePriority(existingRole)) {
        preferredMappingsByDepartment.set(mapping.departmentId, mapping);
      }
    }

    for (const mapping of preferredMappingsByDepartment.values()) {
      const alreadyAssigned = await this.store.find(
        "memberships",
        (membership) =>
          membership.userId === account.userId &&
          membership.departmentId === mapping.departmentId &&
          membership.roleId === mapping.roleId &&
          membership.status === MEMBERSHIP_STATUS.ACTIVE,
      );

      if (!alreadyAssigned) {
        await this.rbac.assignMembership({
          actorUserId: payload.actorUserId,
          userId: account.userId,
          departmentId: mapping.departmentId,
          roleId: mapping.roleId,
        });
      }
    }

    await this.audit.record({
      action: "integrations.discord_roles_synced",
      actorUserId: payload.actorUserId,
      targetType: "connected_account",
      targetId: account.id,
      metadata: { discordId: payload.discordId, roles: payload.roles },
    });

    return { synced: true };
  }

  async ingestFiveMEvent(payload) {
    const missingField = requireFields(payload, ["actorUserId", "eventKey", "kind", "serverId"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "integrations.manage_fivem"))) {
      forbidden("Actor lacks integrations.manage_fivem");
    }

    if ((await this.store.list("processedEventKeys")).includes(payload.eventKey)) {
      return { accepted: true, duplicate: true };
    }

    const event = {
      id: `event_${(await this.store.list("operationalEvents")).length + 1}`,
      kind: payload.kind,
      serverId: payload.serverId,
      accessId: payload.accessId ?? null,
      actorUserId: payload.actorUserId,
      action: payload.action ?? payload.kind,
      createdAt: now(),
      metadata: payload.metadata ?? {},
    };

    await this.store.insert("operationalEvents", event);
    await this.store.insert("processedEventKeys", payload.eventKey);

    if (payload.kind === EVENT_KIND.BAN_SYNCED) {
      if (payload.accessId) {
        await this.store.replace("userGameAccess", payload.accessId, (access) => ({
          ...access,
          banStatus: payload.metadata?.banStatus ?? "banned",
        }));
      } else if (payload.metadata?.license) {
        const access = await this.store.find("userGameAccess", (item) => item.primaryLicense === payload.metadata.license);
        if (access) {
          await this.store.replace("userGameAccess", access.id, (current) => ({
            ...current,
            banStatus: payload.metadata?.banStatus ?? "banned",
          }));
        }
      }
    }

    await this.audit.record({
      action: "integrations.fivem_event_ingested",
      actorUserId: payload.actorUserId,
      targetType: "operational_event",
      targetId: event.id,
      metadata: { eventKey: payload.eventKey, kind: payload.kind },
    });

    return { accepted: true, event };
  }

  async whitelistCheck(payload) {
    const missingField = requireFields(payload, ["actorUserId", "license"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "integrations.manage_fivem"))) {
      forbidden("Actor lacks integrations.manage_fivem");
    }

    const identity = await this.store.find("identityLinks", (item) => item.license === payload.license);
    if (!identity) {
      return {
        allowed: false,
        reason: "identity_not_linked",
      };
    }

    const access = await this.store.find("userGameAccess", (item) => item.userId === identity.userId);
    if (!access) {
      return {
        allowed: false,
        reason: "game_access_missing",
      };
    }

    const user = await this.store.get("users", identity.userId);
    const suspendedMembership = await this.store.find(
      "memberships",
      (membership) => membership.userId === identity.userId && membership.status === MEMBERSHIP_STATUS.SUSPENDED,
    );

    return {
      allowed:
        user?.status === "active" &&
        access.whitelistStatus === "approved" &&
        access.banStatus === "clear" &&
        !suspendedMembership,
      reason:
        access.banStatus !== "clear"
          ? "player_banned"
          : suspendedMembership
            ? "membership_suspended"
            : access.whitelistStatus !== "approved"
              ? "whitelist_not_approved"
              : "ok",
      accessId: access.id,
      userId: identity.userId,
    };
  }
}
