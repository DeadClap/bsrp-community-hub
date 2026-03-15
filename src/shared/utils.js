export function now() {
  return new Date().toISOString();
}

export function clone(value) {
  return structuredClone(value);
}

export function requireFields(payload, fields) {
  for (const field of fields) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === "") {
      return field;
    }
  }
  return null;
}
