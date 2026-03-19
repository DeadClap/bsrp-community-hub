import { forbidden, notFound } from "../shared/errors.js";

export class OperationsService {
  constructor(store, policy) {
    this.store = store;
    this.policy = policy;
  }

  async getAccessProfile(accessId, actorUserId = 1) {
    if (!(await this.policy.hasPermission(actorUserId, "operations.view_player"))) {
      forbidden("Actor lacks operations.view_player");
    }

    const access = await this.store.get("userGameAccess", accessId);
    if (!access) {
      notFound("User game access not found");
    }

    const events = await this.store.filter("operationalEvents", (event) => event.accessId === accessId);
    return { access, events };
  }
}
