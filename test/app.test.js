import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import { loadEnvFile } from "../src/platform/env.js";
import { getConfig, validateConfig } from "../src/platform/config.js";
import { createSeedState } from "../src/seed.js";
import { EVENT_KIND, MEMBERSHIP_STATUS, USER_STATUS } from "../src/shared/constants.js";

function createDiscordFetchStub({ userId = "discord-chief", username = "chiefharper-real", roles = ["guild_member", "leo_command"] } = {}) {
  return async (url, options = {}) => {
    if (url === "https://discord.com/api/v10/oauth2/token") {
      assert.equal(options.method, "POST");
      return {
        ok: true,
        status: 200,
        async json() {
          return { access_token: "discord-access-token", token_type: "Bearer" };
        },
      };
    }

    if (url === "https://discord.com/api/v10/users/@me") {
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: userId, username, global_name: username };
        },
      };
    }

    if (url === `https://discord.com/api/v10/guilds/guild-123/members/${userId}`) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { user: { id: userId }, roles };
        },
      };
    }

    throw new Error(`Unexpected fetch URL: ${url}`);
  };
}

async function createTestApp(options = {}) {
  const config = validateConfig(
    getConfig({
      STORAGE_DRIVER: "memory",
      ...options.env,
    }),
  );

  return createApp({
    initialState: createSeedState(),
    config,
    dependencies: options.dependencies,
  });
}

test("env loader reads values without overwriting existing env", () => {
  const dir = mkdtempSync(join(tmpdir(), "bsrp-env-"));
  const envPath = join(dir, ".env.test");
  const env = { PORT: "9999" };

  writeFileSync(envPath, "PORT=3000\nSTORAGE_DRIVER=postgres\nSEED_ON_BOOT=false\n");
  loadEnvFile(envPath, env);

  assert.equal(env.PORT, "9999");
  assert.equal(env.STORAGE_DRIVER, "postgres");
  assert.equal(env.SEED_ON_BOOT, "false");

  rmSync(dir, { recursive: true, force: true });
});

test("discord oauth validation requires the full credential set when enabled", () => {
  assert.throws(
    () =>
      validateConfig(
        getConfig({
          DISCORD_OAUTH_ENABLED: "true",
          DISCORD_CLIENT_ID: "client-id",
        }),
      ),
    /Discord OAuth is enabled but missing:/,
  );
});

test("discord authorize returns a stateful authorization url", async () => {
  const app = await createTestApp({
    env: {
      DISCORD_OAUTH_ENABLED: "true",
      DISCORD_CLIENT_ID: "client-id",
      DISCORD_CLIENT_SECRET: "client-secret",
      DISCORD_REDIRECT_URI: "http://localhost:3000/api/auth/discord/callback",
      DISCORD_GUILD_ID: "guild-123",
      DISCORD_BOT_TOKEN: "bot-token",
    },
    dependencies: { fetch: createDiscordFetchStub() },
  });

  const response = await app.inject({
    method: "GET",
    path: "/api/auth/discord/authorize",
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.state);
  assert.ok(response.body.authorizationUrl.includes("client_id=client-id"));
  assert.ok(response.body.authorizationUrl.includes(encodeURIComponent(response.body.state)));

  const snapshot = await app.context.store.snapshot();
  assert.equal(snapshot.oauthStates.length, 1);
  await app.close();
});

test("discord callback exchanges code and creates a session for a linked member", async () => {
  const app = await createTestApp({
    env: {
      DISCORD_OAUTH_ENABLED: "true",
      DISCORD_CLIENT_ID: "client-id",
      DISCORD_CLIENT_SECRET: "client-secret",
      DISCORD_REDIRECT_URI: "http://localhost:3000/api/auth/discord/callback",
      DISCORD_GUILD_ID: "guild-123",
      DISCORD_BOT_TOKEN: "bot-token",
    },
    dependencies: { fetch: createDiscordFetchStub() },
  });

  const authorize = await app.inject({
    method: "GET",
    path: "/api/auth/discord/authorize",
  });

  const callback = await app.inject({
    method: "GET",
    path: `/api/auth/discord/callback?code=oauth-code&state=${authorize.body.state}`,
  });

  assert.equal(callback.statusCode, 201);
  assert.equal(callback.body.user.id, "user_1");
  assert.equal(callback.body.status, "active");
  assert.equal(callback.body.session.status, "active");
  assert.ok(callback.body.permissions.includes("rbac.manage"));

  const snapshot = await app.context.store.snapshot();
  const oauthState = snapshot.oauthStates.find((item) => item.id === authorize.body.state);
  assert.equal(oauthState.status, "consumed");
  await app.close();
});

test("discord callback auto-provisions unknown members in pending state", async () => {
  const app = await createTestApp({
    env: {
      DISCORD_OAUTH_ENABLED: "true",
      DISCORD_CLIENT_ID: "client-id",
      DISCORD_CLIENT_SECRET: "client-secret",
      DISCORD_REDIRECT_URI: "http://localhost:3000/api/auth/discord/callback",
      DISCORD_GUILD_ID: "guild-123",
      DISCORD_BOT_TOKEN: "bot-token",
    },
    dependencies: {
      fetch: createDiscordFetchStub({
        userId: "discord-new-user",
        username: "newmember",
        roles: ["guild_member"],
      }),
    },
  });

  const authorize = await app.inject({ method: "GET", path: "/api/auth/discord/authorize" });
  const callback = await app.inject({
    method: "GET",
    path: `/api/auth/discord/callback?code=oauth-code&state=${authorize.body.state}`,
  });

  assert.equal(callback.statusCode, 202);
  assert.equal(callback.body.status, "pending");
  assert.equal(callback.body.user.status, USER_STATUS.PENDING);
  assert.equal(callback.body.session ?? null, null);
  assert.deepEqual(callback.body.permissions, []);

  const snapshot = await app.context.store.snapshot();
  const provisionedUser = snapshot.users.find((user) => user.displayName === "newmember");
  const provisionedAccount = snapshot.connectedAccounts.find(
    (account) => account.providerAccountId === "discord-new-user",
  );

  assert.ok(provisionedUser);
  assert.ok(provisionedAccount);
  assert.equal(provisionedUser.status, USER_STATUS.PENDING);
  assert.equal(provisionedAccount.userId, provisionedUser.id);
  await app.close();
});

test("staff can approve a pending auto-provisioned member and enable login", async () => {
  const app = await createTestApp({
    env: {
      DISCORD_OAUTH_ENABLED: "true",
      DISCORD_CLIENT_ID: "client-id",
      DISCORD_CLIENT_SECRET: "client-secret",
      DISCORD_REDIRECT_URI: "http://localhost:3000/api/auth/discord/callback",
      DISCORD_GUILD_ID: "guild-123",
      DISCORD_BOT_TOKEN: "bot-token",
    },
    dependencies: {
      fetch: createDiscordFetchStub({
        userId: "discord-approve-user",
        username: "approveme",
        roles: ["guild_member"],
      }),
    },
  });

  const authorize = await app.inject({ method: "GET", path: "/api/auth/discord/authorize" });
  const callback = await app.inject({
    method: "GET",
    path: `/api/auth/discord/callback?code=oauth-code&state=${authorize.body.state}`,
  });

  assert.equal(callback.statusCode, 202);

  const snapshot = await app.context.store.snapshot();
  const pendingUser = snapshot.users.find((user) => user.displayName === "approveme");
  assert.ok(pendingUser);
  assert.equal(pendingUser.status, USER_STATUS.PENDING);

  const approval = await app.inject({
    method: "POST",
    path: `/api/community/members/${pendingUser.id}/status`,
    body: { actorUserId: "user_1", status: USER_STATUS.ACTIVE, notes: "Approved by command staff" },
  });

  assert.equal(approval.statusCode, 200);
  assert.equal(approval.body.user.status, USER_STATUS.ACTIVE);

  const login = await app.inject({
    method: "POST",
    path: "/api/auth/discord/login",
    body: { discordId: "discord-approve-user", username: "approveme" },
  });

  assert.equal(login.statusCode, 201);
  assert.equal(login.body.status, USER_STATUS.ACTIVE);
  assert.equal(login.body.user.id, pendingUser.id);
  assert.equal(login.body.session.status, "active");
  await app.close();
});

test("discord login creates a session for a linked active user", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "POST",
    path: "/api/auth/discord/login",
    body: { discordId: "discord-chief", username: "chiefharper" },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.user.id, "user_1");
  assert.equal(response.body.status, USER_STATUS.ACTIVE);
  assert.equal(response.body.session.status, "active");
  assert.ok(response.body.permissions.includes("rbac.manage"));
  await app.close();
});

test("approving an access request assigns the requested membership", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "POST",
    path: "/api/community/access-requests/request_1/decision",
    body: { actorUserId: "user_1", decision: "approve" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.request.status, "approved");

  const snapshot = await app.context.store.snapshot();
  const membership = snapshot.memberships.find(
    (item) =>
      item.userId === "user_2" &&
      item.departmentId === "dept_2" &&
      item.roleId === "role_3" &&
      item.status === MEMBERSHIP_STATUS.ACTIVE,
  );

  assert.ok(membership);
  await app.close();
});

test("discord sync applies inbound role mapping when needed", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "POST",
    path: "/api/integrations/discord/sync",
    body: {
      actorUserId: "user_1",
      discordId: "discord-lane",
      roles: ["guild_member", "leo_member", "leo_command"],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.synced, true);

  const memberships = (await app.context.store.snapshot()).memberships.filter(
    (membership) => membership.userId === "user_2",
  );

  assert.ok(memberships.some((membership) => membership.roleId === "role_1"));
  await app.close();
});

test("whitelist check denies banned players", async () => {
  const app = await createTestApp();
  await app.context.store.replace("playerProfiles", "player_2", (player) => ({
    ...player,
    banStatus: "banned",
  }));

  const response = await app.inject({
    method: "POST",
    path: "/api/integrations/fivem/whitelist-check",
    body: { actorUserId: "user_1", license: "license:lane" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.allowed, false);
  assert.equal(response.body.reason, "player_banned");
  await app.close();
});

test("fivem event ingestion is idempotent by event key", async () => {
  const app = await createTestApp();

  const first = await app.inject({
    method: "POST",
    path: "/api/integrations/fivem/events",
    body: {
      actorUserId: "user_1",
      eventKey: "evt-idempotent",
      kind: EVENT_KIND.ADMIN_ACTION,
      serverId: "server_1",
      playerId: "player_2",
      action: "kicked",
    },
  });

  const second = await app.inject({
    method: "POST",
    path: "/api/integrations/fivem/events",
    body: {
      actorUserId: "user_1",
      eventKey: "evt-idempotent",
      kind: EVENT_KIND.ADMIN_ACTION,
      serverId: "server_1",
      playerId: "player_2",
      action: "kicked",
    },
  });

  assert.equal(first.statusCode, 202);
  assert.equal(second.statusCode, 202);
  assert.equal(second.body.duplicate, true);
  await app.close();
});
