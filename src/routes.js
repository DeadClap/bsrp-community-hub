import {
  clearCookie,
  html,
  json,
  noContent,
  parseJsonBody,
  readCookies,
  redirect,
  setCookie,
  text,
} from "./platform/http.js";
import { forbidden, unauthorized } from "./shared/errors.js";
import {
  appDashboardScript,
  renderAppDashboardHtml,
  renderHomeHtml,
  renderStaffDashboardHtml,
  renderStaffForbiddenHtml,
  renderStaffLoginHtml,
  staffDashboardScript,
  staffDashboardStyles,
  staffLoginScript,
} from "./ui/staff-dashboard.js";

const SESSION_COOKIE_NAME = "hub_session";
const STAFF_DESK_PERMISSIONS = [
  "community.review_access",
  "community.manage_members",
  "audit.view",
  "rbac.manage",
];

function hasStaffDeskAccess(sessionContext) {
  return STAFF_DESK_PERMISSIONS.some((permission) => sessionContext.permissions.includes(permission));
}

async function getSessionContext(request, context) {
  const cookies = readCookies(request);
  const authorization = request.headers?.authorization ?? request.headers?.Authorization ?? "";
  const bearerToken = String(authorization).startsWith("Bearer ")
    ? String(authorization).slice("Bearer ".length)
    : null;
  const sessionId = cookies[SESSION_COOKIE_NAME] ?? bearerToken;
  return context.services.auth.getSessionContext(sessionId);
}

async function requireSessionContext(request, context) {
  const sessionContext = await getSessionContext(request, context);
  if (!sessionContext) {
    unauthorized("Authentication required");
  }
  return sessionContext;
}

async function requireStaffDeskSession(request, context) {
  const sessionContext = await requireSessionContext(request, context);
  if (!hasStaffDeskAccess(sessionContext)) {
    forbidden("Staff desk access is required");
  }
  return sessionContext;
}

function attachSessionCookie(response, sessionId) {
  setCookie(response, SESSION_COOKIE_NAME, encodeURIComponent(sessionId), {
    httpOnly: true,
    path: "/",
    sameSite: "Lax",
  });
}

export function registerRoutes(router, context) {
  router.get("/", async (_request, response) => {
    html(response, renderHomeHtml());
  });

  router.get("/dashboard", async (request, response) => {
    const sessionContext = await getSessionContext(request, context);
    if (!sessionContext) {
      redirect(response, "/login?returnTo=%2Fdashboard");
      return;
    }

    html(
      response,
      renderAppDashboardHtml({
        user: sessionContext.user,
        permissions: sessionContext.permissions,
        hasStaffAccess: hasStaffDeskAccess(sessionContext),
      }),
    );
  });

  router.get("/staff", async (request, response) => {
    const sessionContext = await getSessionContext(request, context);
    if (!sessionContext) {
      redirect(response, "/login?returnTo=%2Fstaff");
      return;
    }

    if (!hasStaffDeskAccess(sessionContext)) {
      html(response, renderStaffForbiddenHtml(sessionContext.user), 403);
      return;
    }

    html(response, renderStaffDashboardHtml());
  });

  router.get("/login", async (request, response) => {
    const sessionContext = await getSessionContext(request, context);
    if (sessionContext) {
      redirect(response, "/dashboard");
      return;
    }

    html(response, renderStaffLoginHtml({ oauthEnabled: context.config.discord.oauthEnabled }));
  });

  router.get("/staff/login", async (_request, response) => {
    redirect(response, "/login", 301);
  });

  router.get("/assets/staff.css", async (_request, response) => {
    text(response, staffDashboardStyles, 200, "text/css; charset=utf-8");
  });

  router.get("/assets/staff.js", async (_request, response) => {
    text(response, staffDashboardScript, 200, "application/javascript; charset=utf-8");
  });

  router.get("/assets/staff-login.js", async (_request, response) => {
    text(response, staffLoginScript, 200, "application/javascript; charset=utf-8");
  });

  router.get("/assets/app-dashboard.js", async (_request, response) => {
    text(response, appDashboardScript, 200, "application/javascript; charset=utf-8");
  });

  router.get("/health", async (_request, response) => {
    json(response, { status: "ok" });
  });

  router.get("/api/auth/session", async (request, response) => {
    const sessionContext = await requireSessionContext(request, context);
    json(response, sessionContext);
  });

  router.get("/api/dashboard", async (request, response) => {
    const sessionContext = await requireSessionContext(request, context);
    json(response, await context.services.dashboard.getUserDashboard(sessionContext.user.id));
  });

  router.delete("/api/auth/session", async (request, response) => {
    const sessionContext = await requireSessionContext(request, context);
    await context.services.auth.revokeSession(sessionContext.session.id);
    clearCookie(response, SESSION_COOKIE_NAME, { path: "/" });
    noContent(response);
  });

  router.get("/api/staff/dashboard", async (request, response) => {
    const sessionContext = await requireStaffDeskSession(request, context);
    json(response, {
      currentUser: sessionContext.user,
      session: sessionContext.session,
      permissions: sessionContext.permissions,
      users: await context.services.community.listUsers(),
      events: await context.services.audit.listEvents(),
    });
  });

  router.post("/api/staff/members/:userId/status", async (request, response, params) => {
    const sessionContext = await requireStaffDeskSession(request, context);
    const body = await parseJsonBody(request);
    const result = await context.services.community.setUserStatus(params.userId, {
      ...body,
      actorUserId: sessionContext.user.id,
    });
    json(response, result);
  });

  router.get("/api/permissions/catalog", async (_request, response) => {
    json(response, {
      permissions: context.services.permissionCatalog.list(),
    });
  });

  router.get("/api/users", async (_request, response) => {
    json(response, { users: await context.services.community.listUsers() });
  });

  router.get("/api/auth/discord/authorize", async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const result = await context.services.auth.startDiscordOAuth({
      returnTo: url.searchParams.get("returnTo"),
    });
    json(response, result);
  });

  router.get("/api/auth/discord/callback", async (request, response) => {
    const url = new URL(request.url, "http://localhost");
    const result = await context.services.auth.completeDiscordOAuth({
      code: url.searchParams.get("code"),
      state: url.searchParams.get("state"),
    });

    if (result.session) {
      attachSessionCookie(response, result.session.id);
    }

    if (result.returnTo) {
      if (result.status === "active") {
        redirect(response, result.returnTo);
        return;
      }

      redirect(response, `/login?status=${encodeURIComponent(result.status)}`);
      return;
    }

    json(response, result, result.status === "pending" ? 202 : 201);
  });

  router.post("/api/auth/discord/login", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.auth.loginWithDiscord(body);
    if (result.session) {
      attachSessionCookie(response, result.session.id);
    }
    json(response, result, result.status === "pending" ? 202 : 201);
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
      ranks: await context.services.rbac.listRoles(),
    });
  });

  router.post("/api/rbac/assignments", async (request, response) => {
    const body = await parseJsonBody(request);
    const result = await context.services.rbac.assignMembership(body);
    json(response, result, 201);
  });

  router.post("/api/community/members/:userId/status", async (request, response, params) => {
    const body = await parseJsonBody(request);
    const sessionContext = await getSessionContext(request, context);
    const result = await context.services.community.setUserStatus(params.userId, {
      ...body,
      actorUserId: sessionContext?.user?.id ?? body.actorUserId,
    });
    json(response, result);
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

  router.get("/api/operations/access/:accessId", async (_request, response, params) => {
    const result = await context.services.operations.getAccessProfile(params.accessId);
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
