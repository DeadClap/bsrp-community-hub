import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function parseEnvValue(rawValue) {
  const trimmed = rawValue.trim();

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
}

export function loadEnvFile(filePath = ".env", env = process.env) {
  const resolvedPath = resolve(filePath);

  if (!existsSync(resolvedPath)) {
    return { loaded: false, path: resolvedPath };
  }

  const contents = readFileSync(resolvedPath, "utf8");
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = parseEnvValue(trimmed.slice(separatorIndex + 1));

    if (!(key in env)) {
      env[key] = value;
    }
  }

  return { loaded: true, path: resolvedPath };
}
