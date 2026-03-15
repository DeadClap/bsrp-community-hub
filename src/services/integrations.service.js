import { EVENT_KIND, MEMBERSHIP_STATUS } from "../shared/constants.js";
import { badRequest, forbidden, notFound } from "../shared/errors.js";
import { now, requireFields } from "../shared/utils.js";

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
      (item) => item.provider === "discord" && item.direction === "inbound",
    );

    for (const mapping of mappings) {
      if (!payload.roles.includes(mapping.externalRoleId)) {
        continue;
      }

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
      playerId: payload.playerId ?? null,
      actorUserId: payload.actorUserId,
      action: payload.action ?? payload.kind,
      createdAt: now(),
      metadata: payload.metadata ?? {},
    };

    await this.store.insert("operationalEvents", event);
    await this.store.insert("processedEventKeys", payload.eventKey);

    if (payload.kind === EVENT_KIND.BAN_SYNCED && payload.playerId) {
      await this.store.replace("playerProfiles", payload.playerId, (player) => ({
        ...player,
        banStatus: payload.metadata?.banStatus ?? "banned",
      }));
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

    const player = await this.store.find("playerProfiles", (item) => item.license === payload.license);
    if (!player) {
      return {
        allowed: false,
        reason: "player_profile_missing",
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
        player.whitelistStatus === "approved" &&
        player.banStatus === "clear" &&
        !suspendedMembership,
      reason:
        player.banStatus !== "clear"
          ? "player_banned"
          : suspendedMembership
            ? "membership_suspended"
            : player.whitelistStatus !== "approved"
              ? "whitelist_not_approved"
              : "ok",
      playerId: player.id,
      userId: identity.userId,
    };
  }
}
