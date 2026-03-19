function formatTimestamp(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function metricCard(label, value, detail) {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><span>${detail}</span></article>`;
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
  document.querySelector("#dashboardUserMeta").innerHTML = `Signed in as user <code>${payload.user.id}</code> with status ${badge(payload.user.status)}.`;

  const actions = document.querySelector("#dashboardActions");
  const staffLink = actions.querySelector('a[href="/staff"]');
  if (staffLink && !payload.nextActions.some((action) => action.href === "/staff")) {
    staffLink.textContent = "Staff desk unavailable";
  }

  document.querySelector("#dashboardSummary").innerHTML = [
    metricCard("Departments", payload.summary.membershipCount, "Roles currently assigned to this account"),
    metricCard("Connected accounts", payload.summary.linkedAccountCount, "Discord and future platform links"),
    metricCard("Identity links", payload.summary.linkedIdentityCount, "Linked FiveM or other platform identities"),
    metricCard("Pending requests", payload.summary.pendingAccessRequests, "Access requests still awaiting review"),
  ].join("");

  renderCards(
    document.querySelector("#dashboardMemberships"),
    payload.memberships,
    "No departments yet",
    "This account does not have department assignments yet.",
    (membership) => `<article class="member-row compact-row"><div><h3>${membership.department?.name ?? membership.departmentId}</h3><p class="member-meta">Rank: <strong>${membership.role?.name ?? membership.roleId}</strong> ${badge(membership.status)}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardAccessRequests"),
    payload.accessRequests,
    "No access requests",
    "Any department access requests you submit will show up here.",
    (request) => `<article class="member-row compact-row"><div><h3>${request.departmentId}</h3><p class="member-meta">Requested role <strong>${request.requestedRoleId}</strong> ${badge(request.status)}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardLinkedAccounts"),
    payload.connectedAccounts,
    "No connected accounts",
    "This account has not linked any external providers yet.",
    (account) => `<article class="member-row compact-row"><div><h3>${account.provider}</h3><p class="member-meta"><code>${account.providerAccountId}</code> ${account.username ? `as ${account.username}` : ""}</p></div></article>`,
  );

  renderCards(
    document.querySelector("#dashboardPlayerProfiles"),
    [...payload.identityLinks, ...payload.playerProfiles],
    "No identities or profiles",
    "Link a FiveM identity to populate operational profile data here.",
    (item) => {
      if (item.characterName) {
        return `<article class="member-row compact-row"><div><h3>${item.characterName}</h3><p class="member-meta">Whitelist ${badge(item.whitelistStatus)} Ban ${badge(item.banStatus)}</p></div></article>`;
      }
      return `<article class="member-row compact-row"><div><h3>${item.type.toUpperCase()} identity</h3><p class="member-meta"><code>${item.license}</code></p></div></article>`;
    },
  );

  renderCards(
    document.querySelector("#dashboardNextActions"),
    payload.nextActions,
    "No immediate actions",
    "Your account looks ready for its current role.",
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
    "Once your linked player profiles produce activity, it will show here.",
    (event) => `<article class="audit-item"><div class="row-between"><h3>${event.action}</h3><span class="member-meta">${formatTimestamp(event.createdAt)}</span></div><p class="audit-meta">${event.kind}${event.playerId ? ` for <code>${event.playerId}</code>` : ""}</p></article>`,
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
