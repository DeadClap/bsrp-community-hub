# BSRP Community Hub

Backend foundation for a modular FiveM community management platform. This starter focuses on Phase 1: Discord-backed access control, platform-managed RBAC, staff access workflows, FiveM identity linking, whitelist checks, event ingestion, audit history, and a lightweight staff review dashboard.

## What is included

- Native Node.js HTTP API with clear module seams for `auth`, `rbac`, `community`, `integrations`, `operations`, and `audit`
- Shared policy evaluator for permission checks across modules
- Dual storage boot modes: in-memory seed mode and Postgres-backed persistence
- Real Discord OAuth authorization URL generation and callback exchange flow
- Cookie-backed platform sessions shared across the whole site
- Discord OAuth-ready config surface with startup validation
- Postgres schema bootstrap, seed, reset, and migration scripts for local testing
- SQL-based schema migrations tracked in `schema_migrations`
- Shared login page at `/login`, authenticated landing page at `/dashboard`, and a protected staff dashboard at `/staff`
- Built-in end-to-end test coverage for login, session auth, access approvals, Discord sync, whitelist logic, FiveM event idempotency, and staff dashboard serving

## Install

```bash
pnpm install
```

## Environment file

Copy [`.env.example`](D:/Development/bsrp-community-hub/.env.example) to `.env` and edit the values for your machine. The app automatically loads `.env` for `pnpm start`, `pnpm db:init`, `pnpm db:migrate`, `pnpm db:seed`, and `pnpm db:reset`.

## Run locally

Memory mode with seed data:

```bash
pnpm start
```

Postgres mode:

```bash
# .env
STORAGE_DRIVER=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:5432/bsrp_community_hub
SEED_ON_BOOT=false

pnpm db:migrate
pnpm db:seed
pnpm start
```

Reset Postgres data:

```bash
# reset only
SEED_ON_BOOT=false
pnpm db:reset

# reset and reseed
SEED_ON_BOOT=true
pnpm db:reset
```

Discord OAuth mode:

```bash
# .env
DISCORD_OAUTH_ENABLED=true
DISCORD_CLIENT_ID=your_app_client_id
DISCORD_CLIENT_SECRET=your_app_client_secret
DISCORD_REDIRECT_URI=http://localhost:3000/api/auth/discord/callback
DISCORD_GUILD_ID=your_discord_guild_id
DISCORD_BOT_TOKEN=your_bot_token
DISCORD_OAUTH_SCOPES=identify guilds guilds.members.read
```

Then start the app and visit:

- `GET /`
- `GET /login`
- successful login or OAuth returns to the requested page, usually `GET /dashboard`
- unauthenticated users trying `GET /dashboard` or `GET /staff` are redirected to `GET /login`

Server default:

- `http://localhost:3000`

## Environment variables

- `PORT`: API port, default `3000`
- `STORAGE_DRIVER`: `memory` or `postgres`, default `memory`
- `DATABASE_URL`: required for Postgres mode
- `SEED_ON_BOOT`: `true` or `false`, defaults to `true`
- `DISCORD_OAUTH_ENABLED`: enables the live Discord OAuth flow
- `DISCORD_CLIENT_ID`: Discord application client ID
- `DISCORD_CLIENT_SECRET`: Discord application client secret
- `DISCORD_REDIRECT_URI`: OAuth callback URL registered in Discord
- `DISCORD_GUILD_ID`: guild to authorize against
- `DISCORD_BOT_TOKEN`: bot token for guild/member sync work
- `DISCORD_OAUTH_SCOPES`: space- or comma-separated OAuth scopes

## Useful endpoints

- `GET /`
- `GET /login`
- `GET /dashboard`
- `GET /staff`
- `GET /api/auth/session`
- `DELETE /api/auth/session`
- `GET /api/staff/dashboard`
- `POST /api/staff/members/:userId/status`
- `GET /api/auth/discord/authorize`
- `GET /api/auth/discord/callback`
- `POST /api/auth/discord/login`
- `POST /api/auth/link/fivem`
- `POST /api/community/members/:userId/status`
- `GET /api/rbac/departments`
- `POST /api/rbac/assignments`
- `GET /api/community/access-requests`
- `POST /api/community/access-requests`
- `POST /api/community/access-requests/:requestId/decision`
- `POST /api/integrations/discord/sync`
- `POST /api/integrations/fivem/events`
- `POST /api/integrations/fivem/whitelist-check`
- `GET /api/operations/players/:playerId`
- `GET /api/audit/events`

## Example payloads

Discord login:

```json
{
  "discordId": "discord-chief",
  "username": "chiefharper"
}
```

Pending member approval:

```json
{
  "status": "active",
  "notes": "Approved by command staff"
}
```

FiveM event ingestion:

```json
{
  "actorUserId": 1,
  "eventKey": "evt-001",
  "kind": "admin.action",
  "serverId": "server_1",
  "playerId": "player_2",
  "action": "warned",
  "metadata": {
    "reason": "NVL"
  }
}
```

## Next build targets

- Replace the direct login fallback with a richer shared sign-in handoff
- Add follow-up migrations instead of relying on a small migration set
- Add background jobs and outbound sync for Discord and FiveM operations
- Expand the shared dashboard into fuller member and operator views
- Expand shared entities for CAD, MDT, and dispatch modules
