import { ACCOUNT_PROVIDER, SESSION_STATUS } from "../shared/constants.js";
import { badRequest, forbidden, notFound } from "../shared/errors.js";
import { now, requireFields } from "../shared/utils.js";

export class AuthService {
  constructor(store, audit, policy) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
  }

  async loginWithDiscord(payload) {
    const missingField = requireFields(payload, ["discordId", "username"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    const account = await this.store.find(
      "connectedAccounts",
      (item) =>
        item.provider === ACCOUNT_PROVIDER.DISCORD && item.providerAccountId === payload.discordId,
    );

    if (!account) {
      badRequest("Discord account is not linked to a member");
    }

    const user = await this.store.get("users", account.userId);
    if (!user || user.status !== "active") {
      forbidden("User is not active");
    }

    const session = {
      id: `session_${(await this.store.list("sessions")).length + 1}`,
      userId: user.id,
      status: SESSION_STATUS.ACTIVE,
      createdAt: now(),
    };

    await this.store.insert("sessions", session);
    await this.audit.record({
      action: "auth.discord_login",
      actorUserId: user.id,
      targetType: "session",
      targetId: session.id,
      metadata: { discordId: payload.discordId },
    });

    return {
      session,
      user,
      permissions: await this.policy.permissionsForUser(user.id),
    };
  }

  async linkFiveMIdentity(payload) {
    const missingField = requireFields(payload, ["actorUserId", "userId", "license", "discordId"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "integrations.manage_fivem"))) {
      forbidden("Actor lacks integrations.manage_fivem");
    }

    const user = await this.store.get("users", payload.userId);
    if (!user) {
      notFound("User not found");
    }

    const existing = await this.store.find("identityLinks", (item) => item.license === payload.license);
    if (existing) {
      badRequest("License is already linked");
    }

    const identity = {
      id: `identity_${(await this.store.list("identityLinks")).length + 1}`,
      userId: payload.userId,
      type: "fivem",
      license: payload.license,
      discordId: payload.discordId,
      linkedAt: now(),
    };

    await this.store.insert("identityLinks", identity);

    await this.audit.record({
      action: "auth.link_fivem_identity",
      actorUserId: payload.actorUserId,
      targetType: "identity",
      targetId: identity.id,
      metadata: { userId: payload.userId, license: payload.license },
    });

    return { identity };
  }

  async revokeSession(sessionId) {
    const session = await this.store.replace("sessions", sessionId, (existing) => ({
      ...existing,
      status: SESSION_STATUS.REVOKED,
      revokedAt: now(),
    }));

    if (!session) {
      notFound("Session not found");
    }
  }
}
