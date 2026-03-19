const state = {
  currentUser: null,
  permissions: [],
  users: [],
  events: [],
  selectedUserId: null,
  pendingReview: null,
};

const elements = {
  siteNav: document.querySelector("#siteNav"),
  profileLink: document.querySelector("#profileLink"),
  headerLogoutButton: document.querySelector("#headerLogoutButton"),
  currentUserName: document.querySelector("#currentUserName"),
  currentUserMeta: document.querySelector("#currentUserMeta"),
  reviewNotes: document.querySelector("#reviewNotes"),
  refreshDashboard: document.querySelector("#refreshDashboard"),
  metrics: document.querySelector("#metrics"),
  pendingCount: document.querySelector("#pendingCount"),
  pendingList: document.querySelector("#pendingList"),
  memberTable: document.querySelector("#memberTable"),
  memberDetail: document.querySelector("#memberDetail"),
  auditFeed: document.querySelector("#auditFeed"),
  memberSearch: document.querySelector("#memberSearch"),
  emptyCardTemplate: document.querySelector("#emptyCardTemplate"),
  reviewModal: document.querySelector("#reviewModal"),
  reviewModalTitle: document.querySelector("#reviewModalTitle"),
  reviewModalBody: document.querySelector("#reviewModalBody"),
  modalReviewNotes: document.querySelector("#modalReviewNotes"),
  confirmReviewAction: document.querySelector("#confirmReviewAction"),
  cancelReviewAction: document.querySelector("#cancelReviewAction"),
};

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

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${status}</span>`;
}

function renderHeader() {
  const links = [
    { href: "/dashboard", label: "Dashboard", active: false },
    { href: "/dashboard#profile", label: "Profile", active: false },
  ];

  if (state.permissions.some((permission) => ["community.review_access", "community.manage_members", "audit.view", "rbac.manage"].includes(permission))) {
    links.push({ href: "/staff", label: "Staff", active: true });
  }

  elements.siteNav.innerHTML = links
    .map((link) => `<a href="${link.href}" class="${link.active ? "nav-link active" : "nav-link"}">${link.label}</a>`)
    .join("");

  if (state.currentUser) {
    elements.profileLink.textContent = `${state.currentUser.displayName}`;
  }
}

function renderCurrentUser() {
  if (!state.currentUser) {
    elements.currentUserName.textContent = "Unknown operator";
    elements.currentUserMeta.textContent = "No active staff session found.";
    return;
  }

  const currentUserRecord = state.users.find((user) => user.id === state.currentUser.id) ?? state.currentUser;
  const rankSummary = (currentUserRecord.memberships ?? [])
    .map((membership) => `${membership.departmentId} / ${membership.roleId}`)
    .join(" | ");

  elements.currentUserName.textContent = state.currentUser.displayName;
  elements.currentUserMeta.textContent = rankSummary || `Signed in as user ${state.currentUser.id}.`;
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
          <button class="action-button open-review-modal" data-user-id="${user.id}" data-status="active">Approve</button>
          <button class="action-button secondary open-review-modal" data-user-id="${user.id}" data-status="rejected">Reject</button>
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
          `<button class="action-button open-review-modal" data-user-id="${user.id}" data-status="active">Approve</button>`,
          `<button class="action-button secondary open-review-modal" data-user-id="${user.id}" data-status="rejected">Reject</button>`,
        );
      }

      if (user.status === "active") {
        actions.push(
          `<button class="action-button warn open-review-modal" data-user-id="${user.id}" data-status="suspended">Suspend</button>`,
        );
      }

      if (user.status === "suspended" || user.status === "rejected") {
        actions.push(
          `<button class="action-button secondary open-review-modal" data-user-id="${user.id}" data-status="active">Reactivate</button>`,
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
      .map((membership) => `${membership.departmentId} / ${membership.roleId} (${membership.status})`)
      .join("<br />") || "No memberships";
  const relatedEvents = state.events
    .filter(
      (event) => Number(event.actorUserId) === selected.id || String(event.targetId) === String(selected.id),
    )
    .slice(0, 4);
  const actions = [];

  if (selected.status !== "active") {
    actions.push(`<button class="action-button open-review-modal" data-user-id="${selected.id}" data-status="active">Set active</button>`);
  }

  if (selected.status !== "rejected") {
    actions.push(`<button class="action-button secondary open-review-modal" data-user-id="${selected.id}" data-status="rejected">Reject</button>`);
  }

  if (selected.status === "active") {
    actions.push(`<button class="action-button warn open-review-modal" data-user-id="${selected.id}" data-status="suspended">Suspend</button>`);
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
      ${relatedEvents.length > 0
        ? relatedEvents.map((event) => `<p class="member-meta"><code>${event.action}</code> ${formatTimestamp(event.createdAt)}</p>`).join("")
        : '<p class="member-meta">No audit entries tied to this member yet.</p>'}
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
    .map((event) => `<article class="audit-item">
      <div class="row-between">
        <h3>${event.action}</h3>
        <span class="member-meta">${formatTimestamp(event.createdAt)}</span>
      </div>
      <p class="audit-meta">Actor <code>${event.actorUserId}</code> -> ${event.targetType} <code>${event.targetId}</code></p>
      <p class="audit-meta">${JSON.stringify(event.metadata ?? {})}</p>
    </article>`)
    .join("");
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 2200);
}

function closeReviewModal() {
  state.pendingReview = null;
  elements.reviewModal.classList.add("hidden");
  elements.reviewModal.setAttribute("aria-hidden", "true");
}

function openReviewModal(userId, status) {
  const user = state.users.find((item) => item.id === Number(userId));
  if (!user) {
    return;
  }

  state.pendingReview = { userId: Number(userId), status };
  elements.reviewModalTitle.textContent = `${status === "active" ? "Approve or reactivate" : status === "rejected" ? "Reject member" : "Suspend member"}`;
  elements.reviewModalBody.textContent = `You are about to move ${user.displayName} to ${status}. Confirm the action and save the review note below.`;
  elements.modalReviewNotes.value = getReviewNotes();
  elements.reviewModal.classList.remove("hidden");
  elements.reviewModal.setAttribute("aria-hidden", "false");
}

async function loadDashboard() {
  const response = await fetch("/api/staff/dashboard", { credentials: "same-origin" });

  if (response.status === 401) {
    window.location.assign("/login?returnTo=/staff");
    return;
  }

  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Failed to load dashboard data");
  }

  state.currentUser = payload.currentUser ?? null;
  state.permissions = payload.permissions ?? [];
  state.users = payload.users ?? [];
  state.events = payload.events ?? [];

  if (!state.users.some((user) => user.id === state.selectedUserId)) {
    state.selectedUserId = state.users[0]?.id ?? null;
  }

  renderHeader();
  renderCurrentUser();
  renderMetrics();
  renderPendingList();
  renderMemberTable();
  renderMemberDetail();
  renderAuditFeed();
}

async function updateUserStatus(userId, status, notes) {
  const response = await fetch(`/api/staff/members/${userId}/status`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      status,
      notes,
    }),
  });

  const payload = await response.json();

  if (response.status === 401) {
    window.location.assign("/login?returnTo=/staff");
    return;
  }

  if (!response.ok) {
    throw new Error(payload.error || payload.message || "Failed to update member status");
  }

  showToast(`Member ${userId} moved to ${status}.`);
  state.selectedUserId = Number(userId);
  await loadDashboard();
}

async function logout() {
  const response = await fetch("/api/auth/session", {
    method: "DELETE",
    credentials: "same-origin",
  });

  if (!response.ok && response.status !== 204) {
    showToast("Unable to end session.");
    return;
  }

  window.location.assign("/login?status=signed_out");
}

elements.refreshDashboard.addEventListener("click", async () => {
  try {
    await loadDashboard();
    showToast("Dashboard refreshed.");
  } catch (error) {
    showToast(error.message);
  }
});

elements.headerLogoutButton.addEventListener("click", () => {
  void logout();
});

elements.memberSearch.addEventListener("input", () => {
  renderMemberTable();
});

elements.cancelReviewAction.addEventListener("click", () => {
  closeReviewModal();
});

elements.confirmReviewAction.addEventListener("click", async () => {
  if (!state.pendingReview) {
    return;
  }

  try {
    await updateUserStatus(
      state.pendingReview.userId,
      state.pendingReview.status,
      elements.modalReviewNotes.value.trim() || getReviewNotes(),
    );
    closeReviewModal();
  } catch (error) {
    showToast(error.message);
  }
});

document.body.addEventListener("click", async (event) => {
  const modalBackdrop = event.target.closest("[data-close-modal='true']");
  if (modalBackdrop) {
    closeReviewModal();
    return;
  }

  const actionButton = event.target.closest(".open-review-modal[data-user-id][data-status]");
  if (actionButton) {
    openReviewModal(actionButton.dataset.userId, actionButton.dataset.status);
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
