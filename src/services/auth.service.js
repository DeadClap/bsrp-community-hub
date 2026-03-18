import { randomUUID } from "node:crypto";
import { AppError, badRequest, forbidden, notFound } from "../shared/errors.js";
import { ACCOUNT_PROVIDER, SESSION_STATUS, USER_STATUS } from "../shared/constants.js";
import { now, requireFields } from "../shared/utils.js";

function buildStateExpiry(minutes = 10) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function nextNumericId(items) {
  return items.reduce((max, item) => {
    const value = Number(item.id);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0) + 1;
}

export class AuthService {
  constructor(store, audit, policy, discordOAuth, config) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
    this.discordOAuth = discordOAuth;
    this.config = config;
  }

  async createSessionForDiscordAccount(account, metadata = {}) {
    const user = await this.store.get("users", account.userId);
    if (!user) {
      notFound("User not found");
    }

    if (user.status === USER_STATUS.PENDING) {
      return {
        status: USER_STATUS.PENDING,
        user,
        permissions: [],
        message: "Your account is pending staff approval.",
      };
    }

    if (user.status !== USER_STATUS.ACTIVE) {
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
      action: metadata.authMethod === "oauth" ? "auth.discord_oauth_login" : "auth.discord_login",
      actorUserId: user.id,
      targetType: "session",
      targetId: session.id,
      metadata: {
        discordId: account.providerAccountId,
        authMethod: metadata.authMethod ?? "direct",
      },
    });

    return {
      status: USER_STATUS.ACTIVE,
      session,
      user,
      permissions: await this.policy.permissionsForUser(user.id),
    };
  }

  async provisionPendingDiscordMember({ discordUser, guildMember }) {
    const timestamp = now();
    const user = {
      id: nextNumericId(await this.store.list("users")),
      displayName: discordUser.global_name ?? discordUser.username,
      email: discordUser.email ?? null,
      status: USER_STATUS.PENDING,
      createdAt: timestamp,
    };

    await this.store.insert("users", user);

    const account = {
      id: `connected_${(await this.store.list("connectedAccounts")).length + 1}`,
      userId: user.id,
      provider: ACCOUNT_PROVIDER.DISCORD,
      providerAccountId: discordUser.id,
      username: discordUser.username,
      guildMember: true,
      roles: guildMember.roles ?? [],
      lastSyncedAt: timestamp,
      provisionedAt: timestamp,
    };

    await this.store.insert("connectedAccounts", account);

    await this.audit.record({
      action: "auth.discord_auto_provisioned",
      actorUserId: user.id,
      targetType: "user",
      targetId: user.id,
      metadata: {
        discordUserId: discordUser.id,
        roles: guildMember.roles ?? [],
      },
    });

    return { user, account };
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

    return this.createSessionForDiscordAccount(account, { authMethod: "direct" });
  }

  async startDiscordOAuth() {
    if (!this.config.discord.oauthEnabled) {
      throw new AppError(400, "Discord OAuth is not enabled in configuration");
    }

    const state = randomUUID();
    const oauthState = {
      id: state,
      status: "pending",
      createdAt: now(),
      expiresAt: buildStateExpiry(10),
    };

    await this.store.insert("oauthStates", oauthState);

    return {
      state,
      authorizationUrl: this.discordOAuth.createAuthorizationUrl(state),
      expiresAt: oauthState.expiresAt,
    };
  }

  async completeDiscordOAuth(payload) {
    const missingField = requireFields(payload, ["code", "state"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!this.config.discord.oauthEnabled) {
      throw new AppError(400, "Discord OAuth is not enabled in configuration");
    }

    const oauthState = await this.store.get("oauthStates", payload.state);
    if (!oauthState || oauthState.status !== "pending") {
      badRequest("OAuth state is invalid or already used");
    }

    if (Date.parse(oauthState.expiresAt) < Date.now()) {
      await this.store.replace("oauthStates", payload.state, (existing) => ({
        ...existing,
        status: "expired",
        expiredAt: now(),
      }));
      badRequest("OAuth state has expired");
    }

    const token = await this.discordOAuth.exchangeCodeForAccessToken(payload.code);
    const discordUser = await this.discordOAuth.fetchCurrentUser(token.access_token);
    const guildMember = await this.discordOAuth.fetchGuildMember(discordUser.id);

    let account = await this.store.find(
      "connectedAccounts",
      (item) =>
        item.provider === ACCOUNT_PROVIDER.DISCORD && item.providerAccountId === discordUser.id,
    );

    if (!account) {
      const provisioned = await this.provisionPendingDiscordMember({ discordUser, guildMember });
      account = provisioned.account;
    } else {
      await this.store.replace("connectedAccounts", account.id, (existing) => ({
        ...existing,
        username: discordUser.username,
        guildMember: true,
        roles: guildMember.roles ?? [],
        lastSyncedAt: now(),
      }));
      account = await this.store.get("connectedAccounts", account.id);
    }

    await this.store.replace("oauthStates", payload.state, (existing) => ({
      ...existing,
      status: "consumed",
      consumedAt: now(),
      discordUserId: discordUser.id,
    }));

    await this.audit.record({
      action: "auth.discord_oauth_completed",
      actorUserId: account.userId,
      targetType: "oauth_state",
      targetId: payload.state,
      metadata: { discordUserId: discordUser.id },
    });

    const result = await this.createSessionForDiscordAccount(account, { authMethod: "oauth" });

    if (result.status === USER_STATUS.PENDING) {
      await this.audit.record({
        action: "auth.discord_pending_login",
        actorUserId: account.userId,
        targetType: "user",
        targetId: account.userId,
        metadata: { discordUserId: discordUser.id },
      });
    }

    return result;
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
      userId: user.id,
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
      metadata: { userId: user.id, license: payload.license },
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
