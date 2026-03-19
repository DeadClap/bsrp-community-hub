function formatTimestamp(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function badge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

function renderCards(target, items, emptyTitle, emptyBody, renderer) {
  if (!items || items.length === 0) {
    target.innerHTML = `<article class="empty-card"><h3>${emptyTitle}</h3><p>${emptyBody}</p></article>`;
    return;
  }

  target.innerHTML = items.map(renderer).join("");
}

function renderHeader(payload) {
  const nav = document.querySelector("#siteNav");
  const profileLink = document.querySelector("#profileLink");
  const links = [
    { href: "/dashboard", label: "Dashboard", active: true },
    { href: "/dashboard#profile", label: "Profile", active: false },
  ];

  if (payload.nextActions.some((action) => action.href === "/staff")) {
    links.push({ href: "/staff", label: "Staff", active: false });
  }

  nav.innerHTML = links
    .map((link) => `<a href="${link.href}" class="${link.active ? "nav-link active" : "nav-link"}">${link.label}</a>`)
    .join("");
  profileLink.textContent = payload.user.displayName;
}

function summarizeProfile(payload) {
  const primaryMembership = payload.memberships[0] ?? null;
  const discordConnected = payload.connectedAccounts.some((account) => account.provider === "discord");
  const fivemLinked = payload.identityLinks.some((identity) => identity.type === "fivem");
  const access = payload.gameAccess[0] ?? null;

  return [
    { label: "Status", value: payload.user.status },
    { label: "Department", value: primaryMembership?.department?.name ?? "Not assigned" },
    { label: "Rank", value: primaryMembership?.rank?.name ?? "No rank" },
    { label: "Discord", value: discordConnected ? "Connected" : "Not linked" },
    { label: "FiveM", value: fivemLinked ? "Linked" : "Not linked" },
    { label: "Whitelist", value: access?.whitelistStatus ?? "Not set" },
  ];
}

async function fetchDashboard() {
  const response = await fetch("/api/dashboard", { credentials: "same-origin" });
  if (response.status === 401) {
    window.location.assign("/login?returnTo=/dashboard");
    return null;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Failed to load dashboard.");
  }

  return payload;
}

function renderDashboard(payload) {
  renderHeader(payload);
  document.querySelector("#dashboardUserName").textContent = `Welcome back, ${payload.user.displayName}.`;
  document.querySelector("#dashboardIntro").textContent =
    payload.nextActions.length > 0
      ? "Your account summary is ready. Review the next steps below to keep moving."
      : "Your account summary is ready. Everything important is linked and up to date.";

  document.querySelector("#dashboardProfileSummary").innerHTML = summarizeProfile(payload)
    .map((item) => `<div class="profile-summary-row"><span>${item.label}</span><strong>${item.value}</strong></div>`)
    .join("");

  const actions = document.querySelector("#dashboardActions");
  const staffLink = actions.querySelector('a[href="/staff"]');
  if (staffLink && !payload.nextActions.some((action) => action.href === "/staff")) {
    staffLink.textContent = "Go to profile";
    staffLink.setAttribute("href", "/dashboard#profile");
  }

  renderCards(
    document.querySelector("#dashboardMemberships"),
    payload.memberships,
    "No departments yet",
    "This account does not have department assignments yet.",
    (membership) => `<article class="member-row compact-row"><div><h3>${membership.department?.name ?? membership.departmentId}</h3><p class="member-meta">Rank: <strong>${membership.rank?.name ?? membership.role?.name ?? membership.roleId}</strong> ${badge(membership.status)}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardAccessRequests"),
    payload.accessRequests,
    "No access requests",
    "Any department access requests you submit will show up here.",
    (request) => `<article class="member-row compact-row"><div><h3>${request.department?.name ?? request.departmentId}</h3><p class="member-meta">Requested rank <strong>${request.requestedRank?.name ?? request.requestedRoleId}</strong> ${badge(request.status)}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardLinkedAccounts"),
    payload.connectedAccounts,
    "No connected accounts",
    "This account has not linked any external providers yet.",
    (account) => `<article class="member-row compact-row"><div><h3>${account.provider}</h3><p class="member-meta"><code>${account.providerAccountId}</code> ${account.username ? `as ${account.username}` : ""}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardGameAccess"),
    [...payload.identityLinks, ...payload.gameAccess],
    "No FiveM access records",
    "Link a FiveM identity to populate account-level access status here.",
    (item) => {
      if (item.primaryLicense) {
        return `<article class="member-row compact-row"><div><h3>FiveM access</h3><p class="member-meta"><code>${item.primaryLicense}</code> Whitelist ${badge(item.whitelistStatus)} Ban ${badge(item.banStatus)}</p></div></article>`;
      }
      return `<article class="member-row compact-row"><div><h3>${item.type.toUpperCase()} identity</h3><p class="member-meta"><code>${item.license}</code></p></div></article>`;
    },
  );

  renderCards(
    document.querySelector("#dashboardNextActions"),
    payload.nextActions,
    "No immediate actions",
    "Your account looks ready for its current rank assignments.",
    (action) => `<article class="pending-card"><h3>${action.label}</h3><p class="pending-meta">Recommended next step for this account.</p><div class="pending-actions"><a class="action-link" href="${action.href}">Open</a></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardAuditFeed"),
    payload.auditEvents,
    "No recent audit events",
    "Once your account actions are recorded, they will show here.",
    (event) => `<article class="audit-item"><div class="row-between"><h3>${event.action}</h3><span class="member-meta">${formatTimestamp(event.createdAt)}</span></div><p class="audit-meta">${event.targetType} <code>${event.targetId}</code></p></article>`,
  );

  renderCards(
    document.querySelector("#dashboardOperationsFeed"),
    payload.operationalEvents,
    "No recent operational events",
    "Once your linked access records produce activity, it will show here.",
    (event) => `<article class="audit-item"><div class="row-between"><h3>${event.action}</h3><span class="member-meta">${formatTimestamp(event.createdAt)}</span></div><p class="audit-meta">${event.kind}${event.accessId ? ` for <code>${event.accessId}</code>` : ""}</p></article>`,
  );
}

async function logout() {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok && response.status !== 204) {
    return;
  }

  window.location.assign("/login?status=signed_out");
}

document.querySelector("#headerLogoutButton")?.addEventListener("click", () => {
  void logout();
});

fetchDashboard()
  .then((payload) => {
    if (payload) {
      renderDashboard(payload);
    }
  })
  .catch((error) => {
    document.querySelector("#dashboardIntro").textContent = error.message;
  });

