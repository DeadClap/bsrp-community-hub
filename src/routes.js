import { json, noContent, parseJsonBody } from "./platform/http.js";

export function registerRoutes(router, context) {
  router.get("/health", async (_request, response) => {
    json(response, { status: "ok" });
  });

  router.get("/api/permissions/catalog", async (_request, response) => {
    json(response, {
      permissions: context.services.permissionCatalog.list(),
    });
  });

  router.get("/api/users", async (_request, response) => {
    json(response, { users: await context.services.community.listUsers() });
  });

  router.post("/api/auth/discord/login", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.auth.loginWithDiscord(body);
    json(response, result, 201);
  });

  router.post("/api/auth/link/fivem", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.auth.linkFiveMIdentity(body);
    json(response, result, 201);
  });

  router.get("/api/rbac/departments", async (_request, response) => {
    json(response, {
      departments: await context.services.rbac.listDepartments(),
      roles: await context.services.rbac.listRoles(),
    });
  });

  router.post("/api/rbac/assignments", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.rbac.assignMembership(body);
    json(response, result, 201);
  });

  router.post("/api/community/access-requests", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.community.createAccessRequest(body);
    json(response, result, 201);
  });

  router.post("/api/community/access-requests/:requestId/decision", async (request, response, params) => {
    const body = await parseJsonBody(request);
    const result = await context.services.community.decideAccessRequest(params.requestId, body);
    json(response, result);
  });

  router.get("/api/community/access-requests", async (_request, response) => {
    json(response, {
      requests: await context.services.community.listAccessRequests(),
    });
  });

  router.post("/api/integrations/discord/sync", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.integrations.syncDiscordRoles(body);
    json(response, result);
  });

  router.post("/api/integrations/fivem/events", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.integrations.ingestFiveMEvent(body);
    json(response, result, 202);
  });

  router.post("/api/integrations/fivem/whitelist-check", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.integrations.whitelistCheck(body);
    json(response, result);
  });

  router.get("/api/operations/players/:playerId", async (_request, response, params) => {
    const result = await context.services.operations.getPlayerProfile(params.playerId);
    json(response, result);
  });

  router.get("/api/audit/events", async (_request, response) => {
    json(response, { events: await context.services.audit.listEvents() });
  });

  router.delete("/api/sessions/:sessionId", async (_request, response, params) => {
    await context.services.auth.revokeSession(params.sessionId);
    noContent(response);
  });
}
