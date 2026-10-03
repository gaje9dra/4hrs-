import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = join(process.cwd(), "prisma", "migrations");
const migrationNamePattern = /^(\\d{14})_[a-z0-9][a-z0-9_-]*$/;
const riskyPatterns = [
  /\\bDROP\\s+TABLE\\b/i,
  /\bDROP\s+COLUMN\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\s+TYPE\b.*\bRENAME\b/i,
  /\bALTER\s+TABLE\b.*\bRENAME\s+COLUMN\b/i,
];

async function main() {
  const entries = (await readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => name !== "_prisma_migrations")
    .sort();

  const timestamps = new Set<string>();
  const invalidNames: string[] = [];
  const risky: Array<{ migration: string; lines: string[] }> = [];

  for (const name of entries) {
    const match = name.match(migrationNamePattern);
    if (!match || timestamps.has(match[1])) invalidNames.push(name);
    else timestamps.add(match[1]);

    const sqlPath = join(root, name, "migration.sql");
    let sql: string;
    try { sql = await readFile(sqlPath, "utf8"); } catch { invalidNames.push(`${name}: missing migration.sql`); continue; }
    const lines = sql.split(/\r?\n/);
    const hits = lines.filter((line) => riskyPatterns.some((pattern) => pattern.test(line)));
    if (hits.length) risky.push({ migration: name, lines: hits });
  }

  if (invalidNames.length) throw new Error(`Migration naming/structure failures: ${invalidNames.join(", ")}`);

  console.log(JSON.stringify({
    status: "ok",
    migrations: entries.length,
    first: entries[0] ?? null,
    latest: entries.at(-1) ?? null,
    destructiveOperations: risky,
  }, null, 2));

  if (risky.length) {
    throw new Error(`Migration safety audit found ${risky.length} migration(s) requiring explicit expand/contract review.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Migration safety audit failed.");
  process.exit(1);
});
