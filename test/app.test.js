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

test("home page serves a landing screen", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /BSRP Community Hub/);
  assert.match(response.body, /Choose where to go next/);
  await app.close();
});

test("dashboard redirects to login when there is no session", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/dashboard" });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "/login?returnTo=%2Fdashboard");
  await app.close();
});

test("dashboard serves html for an authenticated session", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/dashboard",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /Loading your dashboard/);
  assert.match(response.body, /\/assets\/app-dashboard\.js/);

  await app.close();
});

test("staff route redirects to login when there is no session", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/staff" });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "/login?returnTo=%2Fstaff");
  await app.close();
});

test("staff dashboard serves html for an authenticated staff session", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/staff",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /Staff Operations Desk/);
  assert.match(response.body, /Sign out/);

  await app.close();
});

test("login page serves html", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/login" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "text/html; charset=utf-8");
  assert.match(response.body, /site-wide platform session/);
  assert.match(response.body, /Discord OAuth is disabled in the current environment\./);

  await app.close();
});

test("login redirects active sessions to dashboard", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/login",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 302);
  assert.equal(response.headers.location, "/dashboard");
  await app.close();
});

test("legacy staff login route redirects to login", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/staff/login" });

  assert.equal(response.statusCode, 301);
  assert.equal(response.headers.location, "/login");
  await app.close();
});

test("staff dashboard javascript serves as a static asset", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/assets/staff.js" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/javascript; charset=utf-8");
  assert.match(response.body, /api\/staff\/dashboard/);
  assert.match(response.body, /api\/auth\/session/);

  await app.close();
});

test("app dashboard javascript serves as a static asset", async () => {
  const app = await createTestApp();
  const response = await app.inject({ method: "GET", path: "/assets/app-dashboard.js" });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers["content-type"], "application/javascript; charset=utf-8");
  assert.match(response.body, /api\/auth\/session/);
  await app.close();
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
    path: "/api/auth/discord/authorize?returnTo=/dashboard",
  });

  assert.equal(response.statusCode, 200);
  assert.ok(response.body.state);
  assert.ok(response.body.authorizationUrl.includes("client_id=client-id"));
  assert.equal(response.body.returnTo, "/dashboard");

  const snapshot = await app.context.store.snapshot();
  assert.equal(snapshot.oauthStates.length, 1);
  assert.equal(snapshot.oauthStates[0].returnTo, "/dashboard");
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
  assert.equal(callback.body.user.id, 1);
  assert.equal(callback.body.status, "active");
  assert.equal(callback.body.session.status, "active");
  assert.ok(callback.body.permissions.includes("rbac.manage"));
  assert.match(callback.headers["set-cookie"], /hub_session=session_2/);

  const snapshot = await app.context.store.snapshot();
  const oauthState = snapshot.oauthStates.find((item) => item.id === authorize.body.state);
  assert.equal(oauthState.status, "consumed");
  await app.close();
});

test("discord callback redirects to the dashboard when returnTo is present", async () => {
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

  const authorize = await app.inject({ method: "GET", path: "/api/auth/discord/authorize?returnTo=/dashboard" });
  const callback = await app.inject({
    method: "GET",
    path: `/api/auth/discord/callback?code=oauth-code&state=${authorize.body.state}`,
  });

  assert.equal(callback.statusCode, 302);
  assert.equal(callback.headers.location, "/dashboard");
  assert.match(callback.headers["set-cookie"], /hub_session=session_2/);

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
  assert.equal(typeof provisionedUser.id, "number");
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
    path: `/api/staff/members/${pendingUser.id}/status`,
    headers: { cookie: "hub_session=session_1" },
    body: { status: USER_STATUS.ACTIVE, notes: "Approved by command staff" },
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

test("session endpoint returns the active user from a session cookie", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/api/auth/session",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.id, 1);
  assert.ok(response.body.permissions.includes("rbac.manage"));
  await app.close();
});
test("dashboard api returns signed-in user account data", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/api/dashboard",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.id, 1);
  assert.ok(Array.isArray(response.body.memberships));
  assert.ok(Array.isArray(response.body.connectedAccounts));
  assert.ok(Array.isArray(response.body.identityLinks));
  assert.ok(Array.isArray(response.body.auditEvents));
  assert.ok(Array.isArray(response.body.operationalEvents));
  assert.ok(Array.isArray(response.body.nextActions));
  assert.equal(response.body.summary.membershipCount, 1);
  await app.close();
});

test("staff dashboard endpoint requires a valid session", async () => {
  const app = await createTestApp();

  await assert.rejects(
    () => app.inject({ method: "GET", path: "/api/staff/dashboard" }),
    /Authentication required/,
  );

  await app.close();
});

test("staff dashboard endpoint returns users and audit events for staff sessions", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "GET",
    path: "/api/staff/dashboard",
    headers: { cookie: "hub_session=session_1" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.currentUser.id, 1);
  assert.ok(Array.isArray(response.body.users));
  assert.ok(Array.isArray(response.body.events));
  assert.ok(response.body.users.length >= 2);
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
  assert.equal(response.body.user.id, 1);
  assert.equal(response.body.status, USER_STATUS.ACTIVE);
  assert.equal(response.body.session.status, "active");
  assert.ok(response.body.permissions.includes("rbac.manage"));
  assert.match(response.headers["set-cookie"], /hub_session=session_2/);
  await app.close();
});

test("approving an access request assigns the requested membership", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "POST",
    path: "/api/community/access-requests/request_1/decision",
    body: { actorUserId: 1, decision: "approve" },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.request.status, "approved");

  const snapshot = await app.context.store.snapshot();
  const membership = snapshot.memberships.find(
    (item) =>
      item.userId === 2 &&
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
      actorUserId: 1,
      discordId: "discord-lane",
      roles: ["guild_member", "leo_member", "leo_command"],
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.synced, true);

  const memberships = (await app.context.store.snapshot()).memberships.filter(
    (membership) => membership.userId === 2,
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
    body: { actorUserId: 1, license: "license:lane" },
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
      actorUserId: 1,
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
      actorUserId: 1,
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



