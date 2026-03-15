import { MEMBERSHIP_STATUS } from "../shared/constants.js";

export class PolicyService {
  constructor(store) {
    this.store = store;
  }

  async permissionsForUser(userId) {
    const memberships = await this.store.filter(
      "memberships",
      (membership) => membership.userId === userId && membership.status === MEMBERSHIP_STATUS.ACTIVE,
    );

    const rolePermissions = [];
    for (const membership of memberships) {
      const role = await this.store.get("roles", membership.roleId);
      rolePermissions.push(...(role?.permissions ?? []));
    }

    const explicitPermissions = (await this.store.filter(
      "permissionGrants",
      (grant) => grant.userId === userId && grant.effect === "allow",
    )).map((grant) => grant.permission);

    return [...new Set([...rolePermissions, ...explicitPermissions])];
  }

  async hasPermission(userId, permission) {
    return (await this.permissionsForUser(userId)).includes(permission);
  }
}
