/**
 * Database structure is provisioned before production traffic reaches the
 * application. Running CREATE/ALTER statements from request handlers causes
 * lock contention and connection spikes on serverless cold starts.
 *
 * Local development keeps the convenient automatic bootstrap. A production
 * migration can be explicitly enabled for a controlled, one-off operation.
 */
export function shouldRunRuntimeSchemaMigrations(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_RUNTIME_SCHEMA_MIGRATIONS === "true";
}
