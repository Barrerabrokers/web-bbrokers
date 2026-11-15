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
      await tx.unsafe(fs.readFileSync("migrations/20261014_owner_history.sql", "utf8"));
      const [table] = await tx`SELECT relrowsecurity FROM pg_class WHERE oid='public.crm_owner_history'::regclass`;
      if (!table?.relrowsecurity) throw new Error("RLS_NOT_ENABLED");
      if (process.argv.includes("--check")) throw new Error("CHECK_ROLLBACK");
    });
    console.log("Migración de historial de propietarios aplicada; RLS verificado.");
  } catch (error) {
    if (error.message === "CHECK_ROLLBACK") console.log("Migración de propietarios validada y revertida.");
    else { console.error("No se pudo aplicar la migración de propietarios:", error.code || "error"); process.exitCode = 1; }
  } finally { await sql.end(); }
})();
