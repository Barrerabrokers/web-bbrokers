const fs = require("node:fs");
const postgres = require("postgres");
require("@next/env").loadEnvConfig(process.cwd());
const url = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
if (!url) throw new Error("Falta la conexión PostgreSQL");
const sql = postgres(url, { ssl: "require", max: 1, prepare: false, connect_timeout: 10 });
(async () => {
  try {
    await sql.begin(async tx => {
      await tx`SET LOCAL lock_timeout='5s'`;
      await tx.unsafe(fs.readFileSync("migrations/20261014_catalog_order.sql", "utf8"));
      if (process.argv.includes("--check")) throw new Error("CHECK_ROLLBACK");
    });
    console.log("Migración de orden del catálogo aplicada.");
  } catch (error) {
    if (error.message === "CHECK_ROLLBACK") console.log("Migración de catálogo validada y revertida.");
    else { console.error("No se pudo aplicar la migración del catálogo:", error.code || "error"); process.exitCode = 1; }
  } finally { await sql.end(); }
})();
