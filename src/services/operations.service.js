import { forbidden, notFound } from "../shared/errors.js";

export class OperationsService {
  constructor(store, policy) {
    this.store = store;
    this.policy = policy;
  }

  async getPlayerProfile(playerId, actorUserId = 1) {
    if (!(await this.policy.hasPermission(actorUserId, "operations.view_player"))) {
      forbidden("Actor lacks operations.view_player");
    }

    const profile = await this.store.get("playerProfiles", playerId);
    if (!profile) {
      notFound("Player profile not found");
    }

    const events = await this.store.filter("operationalEvents", (event) => event.playerId === playerId);
    return { player: profile, events };
  }
}
