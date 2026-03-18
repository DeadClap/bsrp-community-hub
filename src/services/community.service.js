import { ACCESS_REQUEST_STATUS, MEMBERSHIP_STATUS, USER_STATUS } from "../shared/constants.js";
import { badRequest, forbidden, notFound } from "../shared/errors.js";
import { now, requireFields } from "../shared/utils.js";

const APPROVAL_STATUSES = new Set([USER_STATUS.ACTIVE, USER_STATUS.REJECTED]);
const MANAGEMENT_STATUSES = new Set([USER_STATUS.SUSPENDED, USER_STATUS.ACTIVE]);

export class CommunityService {
  constructor(store, audit, policy, rbac) {
    this.store = store;
    this.audit = audit;
    this.policy = policy;
    this.rbac = rbac;
  }

  async listUsers() {
    const users = await this.store.list("users");
    const memberships = await this.store.list("memberships");
    const accounts = await this.store.list("connectedAccounts");

    return users.map((user) => ({
      ...user,
      memberships: memberships.filter((membership) => membership.userId === user.id),
      connectedAccounts: accounts.filter((account) => account.userId === user.id),
    }));
  }

  async setUserStatus(userId, payload) {
    const missingField = requireFields(payload, ["actorUserId", "status"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    const user = await this.store.get("users", userId);
    if (!user) {
      notFound("User not found");
    }

    const targetStatus = payload.status;
    const canReview = await this.policy.hasPermission(payload.actorUserId, "community.review_access");
    const canManage = await this.policy.hasPermission(payload.actorUserId, "community.manage_members");

    if (user.status === USER_STATUS.PENDING && APPROVAL_STATUSES.has(targetStatus)) {
      if (!canReview) {
        forbidden("Actor lacks community.review_access");
      }
    } else if (MANAGEMENT_STATUSES.has(targetStatus)) {
      if (!canManage && !canReview) {
        forbidden("Actor lacks member management permission");
      }
    } else {
      badRequest(`Unsupported status transition to: ${targetStatus}`);
    }

    const updatedUser = await this.store.replace("users", userId, (existing) => ({
      ...existing,
      status: targetStatus,
      reviewedAt: now(),
      reviewedBy: payload.actorUserId,
      reviewNotes: payload.notes ?? "",
    }));

    await this.audit.record({
      action: "community.user_status_updated",
      actorUserId: payload.actorUserId,
      targetType: "user",
      targetId: userId,
      metadata: {
        previousStatus: user.status,
        status: targetStatus,
      },
    });

    return { user: updatedUser };
  }

  async createAccessRequest(payload) {
    const missingField = requireFields(payload, ["userId", "departmentId", "requestedRoleId"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    const request = {
      id: `request_${(await this.store.list("accessRequests")).length + 1}`,
      userId: payload.userId,
      departmentId: payload.departmentId,
      requestedRoleId: payload.requestedRoleId,
      status: ACCESS_REQUEST_STATUS.PENDING,
      submittedAt: now(),
      notes: payload.notes ?? "",
    };

    await this.store.insert("accessRequests", request);
    await this.audit.record({
      action: "community.access_requested",
      actorUserId: payload.userId,
      targetType: "access_request",
      targetId: request.id,
      metadata: {
        departmentId: payload.departmentId,
        requestedRoleId: payload.requestedRoleId,
      },
    });

    return { request };
  }

  async decideAccessRequest(requestId, payload) {
    const missingField = requireFields(payload, ["actorUserId", "decision"]);
    if (missingField) {
      badRequest(`Missing required field: ${missingField}`);
    }

    if (!(await this.policy.hasPermission(payload.actorUserId, "community.review_access"))) {
      forbidden("Actor lacks community.review_access");
    }

    const existing = await this.store.get("accessRequests", requestId);
    if (!existing) {
      notFound("Access request not found");
    }

    if (existing.status !== ACCESS_REQUEST_STATUS.PENDING) {
      badRequest("Access request has already been decided");
    }

    const approved = payload.decision === "approve";
    const updated = await this.store.replace("accessRequests", requestId, (request) => ({
      ...request,
      status: approved ? ACCESS_REQUEST_STATUS.APPROVED : ACCESS_REQUEST_STATUS.DENIED,
      decidedAt: now(),
      decidedBy: payload.actorUserId,
      decisionNotes: payload.notes ?? "",
    }));

    if (approved) {
      await this.rbac.assignMembership({
        actorUserId: payload.actorUserId,
        userId: existing.userId,
        departmentId: existing.departmentId,
        roleId: existing.requestedRoleId,
        status: MEMBERSHIP_STATUS.ACTIVE,
      });
    }

    await this.audit.record({
      action: approved ? "community.access_approved" : "community.access_denied",
      actorUserId: payload.actorUserId,
      targetType: "access_request",
      targetId: requestId,
      metadata: { decision: payload.decision },
    });

    return { request: updated };
  }

  async listAccessRequests() {
    return this.store.list("accessRequests");
  }
}
