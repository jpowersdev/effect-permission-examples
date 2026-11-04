import { Context, Effect, Layer, Schema } from "effect"
import { type Authorizer, type Permission, type PermissionError, PermissionSql } from "effect/permission"
import { SqlClient, SqlModel, SqlSchema } from "effect/sql"
import type { UnitId } from "../domain/Ids.ts"
import { Unit, UnitNotFound } from "../domain/Unit.ts"
import { Permissions } from "../permissions/Permissions.ts"
import type { CurrentPrincipal } from "../permissions/Principal.ts"

export class Units extends Context.Service<
  Units,
  {
    // Lists the units the current principal may read
    list(): Effect.Effect<
      ReadonlyArray<Unit>,
      PermissionError.PermissionUnavailable,
      CurrentPrincipal | Authorizer.Authorizer
    >
    findById(id: UnitId): Effect.Effect<Unit, UnitNotFound>
    // Only accepts a unit that passed the units:update check
    save(unit: Permission.Authorized<"units:update", Unit>): Effect.Effect<Unit>
  }
>()("examples/Units") {
  static readonly layerNoDeps = Layer.effect(
    Units,
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      const mappings = yield* PermissionSql.Mappings
      const repo = yield* SqlModel.makeRepository(Unit, {
        tableName: "units",
        spanPrefix: "Units",
        idColumn: "id"
      })

      const list = Effect.fn("Units.list")(function*() {
        // The units:read rule, with the principal's values filled in, becomes
        // the WHERE clause: one query, and pages stay full.
        const visible = yield* PermissionSql.filter(Permissions, "units:read").pipe(
          Effect.provideService(PermissionSql.Mappings, mappings)
        )
        return yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: Unit,
          execute: () => sql`SELECT * FROM units WHERE ${visible} ORDER BY name`
        })().pipe(Effect.orDie)
      })

      const findById = Effect.fn("Units.findById")((id: UnitId) =>
        repo.findById(id).pipe(
          Effect.catchTags({
            NoSuchElementError: () => Effect.fail(new UnitNotFound()),
            SchemaError: Effect.die,
            SqlError: Effect.die
          })
        )
      )

      const save = Effect.fn("Units.save")((unit: Permission.Authorized<"units:update", Unit>) =>
        repo.update(unit).pipe(Effect.orDie)
      )

      return Units.of({ list, findById, save })
    })
  )
}
