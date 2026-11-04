import { SqliteClient, SqliteMigrator } from "@effect/sql-sqlite-node"
import { Effect, Layer, String as Str } from "effect"
import { SqlClient } from "effect/sql"

// Columns are snake_case and fields camelCase. The name transforms apply to
// the identifiers in compiled permission filters too, so the table mappings
// in PermissionsSql only need table names.
const SqlLayer = SqliteClient.layer({
  filename: ":memory:",
  transformQueryNames: Str.camelToSnake,
  transformResultNames: Str.snakeToCamel
})

const MigratorLayer = SqliteMigrator.layer({
  loader: SqliteMigrator.fromRecord({
    "0001_schema": Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      yield* sql`CREATE TABLE units (id TEXT PRIMARY KEY, hospital_id TEXT NOT NULL, name TEXT NOT NULL)`
      yield* sql`
        CREATE TABLE profiles (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          home_hospital_id TEXT NOT NULL,
          is_super_admin INTEGER NOT NULL,
          manages_units INTEGER NOT NULL,
          manages_swaps INTEGER NOT NULL,
          revision TEXT NOT NULL
        )
      `
      yield* sql`CREATE TABLE profile_units (profile_id TEXT NOT NULL, unit_id TEXT NOT NULL)`
      yield* sql`
        CREATE TABLE swap_requests (
          id TEXT PRIMARY KEY,
          unit_id TEXT NOT NULL,
          requester_id TEXT NOT NULL,
          recipient_id TEXT NOT NULL,
          status TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `
    }),
    "0002_seed": Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      yield* sql`
        INSERT INTO units (id, hospital_id, name) VALUES
          ('u-icu', 'h-st-marys', 'ICU'),
          ('u-ed', 'h-st-marys', 'Emergency'),
          ('u-cardio', 'h-riverside', 'Cardiology')
      `
      // Ana and Cara work at St. Mary's. Ben is a float nurse from Riverside
      // who also works in St. Mary's ICU. Cara manages the ICU. Dev is a
      // super admin, and Eve is on the support team.
      yield* sql`
        INSERT INTO profiles VALUES
          ('p-ana', 'Ana', 'h-st-marys', 0, 0, 0, 'r1'),
          ('p-ben', 'Ben', 'h-riverside', 0, 0, 0, 'r1'),
          ('p-cara', 'Cara', 'h-st-marys', 0, 1, 1, 'r1'),
          ('p-dev', 'Dev', 'h-hq', 1, 1, 1, 'r1'),
          ('p-eve', 'Eve', 'h-hq', 0, 0, 0, 'r1')
      `
      yield* sql`
        INSERT INTO profile_units VALUES
          ('p-ana', 'u-icu'),
          ('p-ben', 'u-icu'),
          ('p-ben', 'u-cardio'),
          ('p-cara', 'u-icu')
      `
      yield* sql`
        INSERT INTO swap_requests VALUES
          ('s-1', 'u-icu', 'p-ben', 'p-ana', 'pending', '2026-11-01T08:00:00Z'),
          ('s-2', 'u-cardio', 'p-ben', 'p-ana', 'pending', '2026-11-01T09:00:00Z')
      `
    })
  })
})

// A fresh, migrated and seeded database
export const DatabaseLayer = MigratorLayer.pipe(Layer.provideMerge(SqlLayer), Layer.orDie)
