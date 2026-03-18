const state = {
  users: [],
  events: [],
  selectedUserId: null,
};

const elements = {
  metrics: document.querySelector("#metrics"),
  pendingCount: document.querySelector("#pendingCount"),
  pendingList: document.querySelector("#pendingList"),
  memberTable: document.querySelector("#memberTable"),
  memberDetail: document.querySelector("#memberDetail"),
  auditFeed: document.querySelector("#auditFeed"),
  memberSearch: document.querySelector("#memberSearch"),
  actorUserId: document.querySelector("#actorUserId"),
  reviewNotes: document.querySelector("#reviewNotes"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  emptyCardTemplate: document.querySelector("#emptyCardTemplate"),
};

function getActorUserId() {
  const value = Number(elements.actorUserId.value);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getReviewNotes() {
  return elements.reviewNotes.value.trim() || "Updated from the staff desk";
}

function formatTimestamp(value) {
  if (!value) {
    return "Not recorded";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function normalizeSearch(user) {
  const accounts = (user.connectedAccounts ?? [])
    .map((account) => [account.providerAccountId, account.username, ...(account.roles ?? [])])
    .flat();

  return [user.displayName, user.email, user.status, ...accounts].filter(Boolean).join(" ").toLowerCase();
}

function summarizeUsers() {
  const pending = state.users.filter((user) => user.status === "pending");
  const active = state.users.filter((user) => user.status === "active");
  const suspended = state.users.filter((user) => user.status === "suspended");
  const rejected = state.users.filter((user) => user.status === "rejected");
  const connectedAccounts = state.users.reduce(
    (total, user) => total + (user.connectedAccounts?.length ?? 0),
    0,
  );

  return { pending, active, suspended, rejected, connectedAccounts };
}

function makeMetric(label, value, detail) {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong><span>${detail}</span></article>`;
}

function renderMetrics() {
  const summary = summarizeUsers();
  elements.metrics.innerHTML = [
    makeMetric("Pending reviews", summary.pending.length, "Discord sign-ins waiting on staff action"),
    makeMetric("Active members", summary.active.length, "Members currently able to log in"),
    makeMetric(
      "Suspended or rejected",
      summary.suspended.length + summary.rejected.length,
      "Members blocked from operational access",
    ),
    makeMetric("Linked accounts", summary.connectedAccounts, "External identities synced into the hub"),
  ].join("");

  elements.pendingCount.textContent = `${summary.pending.length} pending`;
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

function renderPendingList() {
  const pending = state.users.filter((user) => user.status === "pending");

  if (pending.length === 0) {
    elements.pendingList.innerHTML = elements.emptyCardTemplate.innerHTML;
    return;
  }

  elements.pendingList.innerHTML = pending
    .map((user) => {
      const account = user.connectedAccounts?.find((item) => item.provider === "discord");
      const roleList = (account?.roles ?? []).join(", ") || "No synced roles";

      return `<article class="pending-card">
        <div class="row-between">
          <div>
            <h3>${user.displayName}</h3>
            <p class="pending-meta">${statusBadge(user.status)} Joined ${formatTimestamp(user.createdAt)}</p>
          </div>
          <div class="pending-meta"><code>${account?.providerAccountId ?? "unlinked"}</code></div>
        </div>
        <p>${user.email ?? "No email shared by Discord"}</p>
        <p class="pending-meta">Discord roles: ${roleList}</p>
        <div class="pending-actions">
          <button class="action-button" data-user-id="${user.id}" data-status="active">Approve</button>
          <button class="action-button secondary" data-user-id="${user.id}" data-status="rejected">Reject</button>
          <button class="action-button secondary member-focus" data-user-id="${user.id}">Inspect</button>
        </div>
      </article>`;
    })
    .join("");
}

function renderMemberTable() {
  const term = elements.memberSearch.value.trim().toLowerCase();
  const filtered = state.users.filter((user) => normalizeSearch(user).includes(term));

  if (filtered.length === 0) {
    elements.memberTable.innerHTML =
      '<article class="empty-card"><h3>No matches</h3><p>Try a different name, status, or Discord identifier.</p></article>';
    return;
  }

  elements.memberTable.innerHTML = filtered
    .map((user) => {
      const account = user.connectedAccounts?.find((item) => item.provider === "discord");
      const actions = [];

      if (user.status === "pending") {
        actions.push(
          `<button class="action-button" data-user-id="${user.id}" data-status="active">Approve</button>`,
          `<button class="action-button secondary" data-user-id="${user.id}" data-status="rejected">Reject</button>`,
        );
      }

      if (user.status === "active") {
        actions.push(
          `<button class="action-button warn" data-user-id="${user.id}" data-status="suspended">Suspend</button>`,
        );
      }

      if (user.status === "suspended" || user.status === "rejected") {
        actions.push(
          `<button class="action-button secondary" data-user-id="${user.id}" data-status="active">Reactivate</button>`,
        );
      }

      return `<article class="member-row">
        <button class="member-select" type="button" data-user-id="${user.id}">
          <h3>${user.displayName}</h3>
          <p class="member-meta">${statusBadge(user.status)} ${
            account?.username ? `Discord: <code>${account.username}</code>` : "No Discord username"
          }</p>
          <p class="member-meta">User ID <code>${user.id}</code></p>
        </button>
        <div class="member-actions">${actions.join("")}</div>
      </article>`;
    })
    .join("");
}

function renderMemberDetail() {
  const selected = state.users.find((user) => user.id === state.selectedUserId) ?? state.users[0];

  if (!selected) {
    elements.memberDetail.innerHTML = "No member data loaded yet.";
    return;
  }

  state.selectedUserId = selected.id;

  const account = selected.connectedAccounts?.find((item) => item.provider === "discord");
  const memberships =
    (selected.memberships ?? [])
      .map(
        (membership) =>
          `${membership.departmentId} / ${membership.roleId} (${membership.status})`,
      )
      .join("<br />") || "No memberships";
  const relatedEvents = state.events
    .filter(
      (event) => Number(event.actorUserId) === selected.id || String(event.targetId) === String(selected.id),
    )
    .slice(0, 4);
  const actions = [];

  if (selected.status !== "active") {
    actions.push(
      `<button class="action-button" data-user-id="${selected.id}" data-status="active">Set active</button>`,
    );
  }

  if (selected.status !== "rejected") {
    actions.push(
      `<button class="action-button secondary" data-user-id="${selected.id}" data-status="rejected">Reject</button>`,
    );
  }

  if (selected.status === "active") {
    actions.push(
      `<button class="action-button warn" data-user-id="${selected.id}" data-status="suspended">Suspend</button>`,
    );
  }

  elements.memberDetail.innerHTML = `<article class="detail-card">
    <div class="row-between">
      <div>
        <h3>${selected.displayName}</h3>
        <p>${statusBadge(selected.status)}</p>
      </div>
      <div class="member-meta"><code>${account?.providerAccountId ?? "no-discord-id"}</code></div>
    </div>
    <dl class="detail-grid">
      <dt>Email</dt>
      <dd>${selected.email ?? "No email stored"}</dd>
      <dt>Created</dt>
      <dd>${formatTimestamp(selected.createdAt)}</dd>
      <dt>Reviewed</dt>
      <dd>${selected.reviewedAt ? `${formatTimestamp(selected.reviewedAt)} by ${selected.reviewedBy}` : "Not reviewed yet"}</dd>
      <dt>Memberships</dt>
      <dd>${memberships}</dd>
      <dt>Roles</dt>
      <dd>${(account?.roles ?? []).join(", ") || "No synced Discord roles"}</dd>
      <dt>Review notes</dt>
      <dd>${selected.reviewNotes || "No notes"}</dd>
    </dl>
    <div class="member-actions">${actions.join("")}</div>
    <div>
      <p class="eyebrow" style="margin-top: 18px;">Recent member trace</p>
      ${
        relatedEvents.length > 0
          ? relatedEvents
              .map(
                (event) => `<p class="member-meta"><code>${event.action}</code> ${formatTimestamp(event.createdAt)}</p>`,
              )
              .join("")
          : '<p class="member-meta">No audit entries tied to this member yet.</p>'
      }
    </div>
  </article>`;
}

function renderAuditFeed() {
  const events = state.events.slice(0, 12);

  if (events.length === 0) {
    elements.auditFeed.innerHTML =
      '<article class="empty-card"><h3>No audit events</h3><p>Once actions are recorded, they will show up here.</p></article>';
    return;
  }

  elements.auditFeed.innerHTML = events
    .map(
      (event) => `<article class="audit-item">
        <div class="row-between">
          <h3>${event.action}</h3>
          <span class="member-meta">${formatTimestamp(event.createdAt)}</span>
        </div>
        <p class="audit-meta">Actor <code>${event.actorUserId}</code> -> ${event.targetType} <code>${event.targetId}</code></p>
        <p class="audit-meta">${JSON.stringify(event.metadata ?? {})}</p>
      </article>`,
    )
    .join("");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

async function loadDashboard() {
  const [usersResponse, auditResponse] = await Promise.all([fetch("/api/users"), fetch("/api/audit/events")]);

  if (!usersResponse.ok || !auditResponse.ok) {
    throw new Error("Failed to load dashboard data");
  }

  const usersPayload = await usersResponse.json();
  const auditPayload = await auditResponse.json();

  state.users = usersPayload.users ?? [];
  state.events = auditPayload.events ?? [];

  if (!state.users.some((user) => user.id === state.selectedUserId)) {
    state.selectedUserId = state.users[0]?.id ?? null;
  }

  renderMetrics();
  renderPendingList();
  renderMemberTable();
  renderMemberDetail();
  renderAuditFeed();
}

async function updateUserStatus(userId, status) {
  const response = await fetch(`/api/community/members/${userId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      actorUserId: getActorUserId(),
      status,
      notes: getReviewNotes(),
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Failed to update member status");
  }

  showToast(`Member ${userId} moved to ${status}.`);
  state.selectedUserId = Number(userId);
  await loadDashboard();
}

elements.refreshDashboard.addEventListener("click", async () => {
  try {
    await loadDashboard();
    showToast("Dashboard refreshed.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.memberSearch.addEventListener("input", () => {
  renderMemberTable();
});

document.body.addEventListener("click", async (event) => {
  const actionButton = event.target.closest("button[data-user-id][data-status]");
  if (actionButton) {
    try {
      actionButton.disabled = true;
      await updateUserStatus(actionButton.dataset.userId, actionButton.dataset.status);
    } catch (error) {
      showToast(error.message);
    } finally {
      actionButton.disabled = false;
    }
    return;
  }

  const focusButton = event.target.closest(".member-focus, .member-select");
  if (focusButton) {
    state.selectedUserId = Number(focusButton.dataset.userId);
    renderMemberDetail();
  }
});

loadDashboard().catch((error) => {
  const message = error.message;
  elements.pendingList.innerHTML = `<article class="empty-card"><h3>Dashboard unavailable</h3><p>${message}</p></article>`;
  elements.memberTable.innerHTML = `<article class="empty-card"><h3>Dashboard unavailable</h3><p>${message}</p></article>`;
  elements.memberDetail.textContent = message;
  elements.auditFeed.innerHTML = `<article class="empty-card"><h3>Dashboard unavailable</h3><p>${message}</p></article>`;
});
