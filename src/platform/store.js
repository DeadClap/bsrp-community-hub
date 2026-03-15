import { clone } from "../shared/utils.js";

export class MemoryStore {
  constructor(initialState = {}) {
    this.state = clone(initialState);
  }

  async list(collection) {
    return this.state[collection] ?? [];
  }

  async get(collection, id) {
    return (await this.list(collection)).find((item) => item.id === id) ?? null;
  }

  async insert(collection, value) {
    const items = await this.list(collection);
    items.push(value);
    this.state[collection] = items;
    return value;
  }

  async replace(collection, id, updater) {
    const items = await this.list(collection);
    const index = items.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }
    const updated = await updater(items[index]);
    items[index] = updated;
    this.state[collection] = items;
    return updated;
  }

  async find(collection, predicate) {
    return (await this.list(collection)).find(predicate) ?? null;
  }

  async filter(collection, predicate) {
    return (await this.list(collection)).filter(predicate);
  }

  async snapshot() {
    return clone(this.state);
  }

  async close() {}
}
