import { now } from "../shared/utils.js";

export class AuditService {
  constructor(store) {
    this.store = store;
  }

  async record({ action, actorUserId, targetType, targetId, metadata = {} }) {
    const event = {
      id: `audit_${(await this.store.list("auditEvents")).length + 1}`,
      action,
      actorUserId,
      targetType,
      targetId,
      createdAt: now(),
      metadata,
    };

    await this.store.insert("auditEvents", event);
    return event;
  }

  async listEvents() {
    return (await this.store.list("auditEvents"))
      .slice()
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  }
}
