import { now } from "../shared/utils.js";

function toComparableTimestamp(value) {
  if (!value) {
    return 0;
  }

  if (value instanceof Date) {
    return value.getTime();
  }

  const timestamp = Date.parse(String(value));
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

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
      .sort((left, right) => toComparableTimestamp(right.createdAt) - toComparableTimestamp(left.createdAt));
  }
}
