import { MEMBERSHIP_STATUS } from "../shared/constants.js";
import { badRequest, forbidden, notFound } from "../shared/errors.js";
import { now, requireFields } from "../shared/utils.js";

export class RbacService {
  constructor(store, audit, policy) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
  }

  async listDepartments() {
    return this.store.list("departments");
  }

  async listRoles() {
    return this.store.list("roles");
  }

  async assignMembership(payload) {
    const missingField = requireFields(payload, [
      "actorUserId",
      "userId",
      "departmentId",
      "roleId",
    ]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "rbac.manage"))) {
      forbidden("Actor lacks rbac.manage");
    }

    const role = await this.store.get("roles", payload.roleId);
    const department = await this.store.get("departments", payload.departmentId);
    const user = await this.store.get("users", payload.userId);

    if (!role || !department || !user) {
      notFound("User, role, or department not found");
    }

    const membership = {
      id: `membership_${(await this.store.list("memberships")).length + 1}`,
      userId: payload.userId,
      departmentId: payload.departmentId,
      roleId: payload.roleId,
      status: payload.status ?? MEMBERSHIP_STATUS.ACTIVE,
      assignedBy: payload.actorUserId,
      assignedAt: now(),
    };

    await this.store.insert("memberships", membership);

    await this.audit.record({
      action: "rbac.membership_assigned",
      actorUserId: payload.actorUserId,
      targetType: "membership",
      targetId: membership.id,
      metadata: {
        userId: payload.userId,
        departmentId: payload.departmentId,
        roleId: payload.roleId,
      },
    });

    return { membership };
  }
}
