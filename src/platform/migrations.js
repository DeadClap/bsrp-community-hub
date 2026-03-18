import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = dirname(currentFile);
const MIGRATIONS_DIR = join(currentDir, "..", "db", "migrations");

function getMigrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export async function ensureMigrationTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function migrateDatabase(pool) {
  await ensureMigrationTable(pool);

  const applied = await pool.query("SELECT version FROM schema_migrations ORDER BY version");
  const appliedVersions = new Set(applied.rows.map((row) => row.version));

  for (const file of getMigrationFiles()) {
    if (appliedVersions.has(file)) {
      continue;
    }

    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query(
        "INSERT INTO schema_migrations (version, applied_at) VALUES ($1, NOW())",
        [file],
      );
      await pool.query("COMMIT");
    } catch (error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
}
