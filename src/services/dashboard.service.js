function sortByNewest(items, getTimestamp) {
  return items
    .slice()
    .sort((left, right) => Date.parse(getTimestamp(right) ?? 0) - Date.parse(getTimestamp(left) ?? 0));
}

export class DashboardService {
  constructor(store, audit, policy) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
  }

  async getUserDashboard(userId) {
    const user = await this.store.get("users", userId);
    const memberships = await this.store.filter("memberships", (membership) => membership.userId === userId);
    const connectedAccounts = await this.store.filter(
      "connectedAccounts",
      (account) => account.userId === userId,
    );
    const identityLinks = await this.store.filter("identityLinks", (identity) => identity.userId === userId);
    const licenses = new Set(identityLinks.map((identity) => identity.license));
    const playerProfiles = await this.store.filter(
      "playerProfiles",
      (player) => player.userId === userId || licenses.has(player.license),
    );
    const playerIds = new Set(playerProfiles.map((player) => player.id));
    const accessRequests = await this.store.filter(
      "accessRequests",
      (request) => request.userId === userId,
    );
    const permissions = await this.policy.permissionsForUser(userId);
    const auditEvents = sortByNewest(
      (await this.audit.listEvents()).filter(
        (event) =>
          Number(event.actorUserId) === userId ||
          (event.targetType === "user" && String(event.targetId) === String(userId)),
      ),
      (event) => event.createdAt,
    ).slice(0, 8);
    const operationalEvents = sortByNewest(
      await this.store.filter(
        "operationalEvents",
        (event) => Number(event.actorUserId) === userId || playerIds.has(event.playerId),
      ),
      (event) => event.createdAt,
    ).slice(0, 8);

    const departments = await this.store.list("departments");
    const roles = await this.store.list("roles");
    const membershipsDetailed = memberships.map((membership) => ({
      ...membership,
      department: departments.find((department) => department.id === membership.departmentId) ?? null,
      role: roles.find((role) => role.id === membership.roleId) ?? null,
    }));

    const nextActions = [
      {
        id: "view-profile",
        label: "Review your linked accounts",
        href: "#account",
      },
      permissions.some((permission) => permission.startsWith("community.") || permission === "rbac.manage")
        ? {
            id: "open-staff",
            label: "Open staff desk",
            href: "/staff",
          }
        : null,
      identityLinks.length === 0
        ? {
            id: "link-fivem",
            label: "Link your FiveM identity",
            href: "#identity",
          }
        : null,
    ].filter(Boolean);

    return {
      user,
      permissions,
      memberships: membershipsDetailed,
      connectedAccounts,
      identityLinks,
      playerProfiles,
      accessRequests: sortByNewest(accessRequests, (request) => request.submittedAt),
      auditEvents,
      operationalEvents,
      nextActions,
      summary: {
        membershipCount: memberships.length,
        linkedAccountCount: connectedAccounts.length,
        linkedIdentityCount: identityLinks.length,
        pendingAccessRequests: accessRequests.filter((request) => request.status === "pending").length,
      },
    };
  }
}
