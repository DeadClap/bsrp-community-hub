import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createApp } from "../src/app.js";
import { loadEnvFile } from "../src/platform/env.js";
import { getConfig, validateConfig } from "../src/platform/config.js";
import { createSeedState } from "../src/seed.js";
import { EVENT_KIND, MEMBERSHIP_STATUS } from "../src/shared/constants.js";

async function createTestApp() {
  return createApp({ initialState: createSeedState(), config: getConfig({ STORAGE_DRIVER: "memory" }) });
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

test("discord login creates a session for a linked active user", async () => {
  const app = await createTestApp();
  const response = await app.inject({
    method: "POST",
    path: "/api/auth/discord/login",
    body: { discordId: "discord-chief", username: "chiefharper" },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.user.id, "user_1");
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
