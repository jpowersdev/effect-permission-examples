import { Context, Effect, Layer, Schema } from "effect"
import { type Authorizer, type Permission, type PermissionError, PermissionSql } from "effect/permission"
import { SqlClient, SqlModel, SqlSchema } from "effect/sql"
import type { SwapRequestId } from "../domain/Ids.ts"
import { SwapNotFound, SwapRequest, type SwapStatus } from "../domain/SwapRequest.ts"
import { Permissions } from "../permissions/Permissions.ts"
import type { CurrentPrincipal } from "../permissions/Principal.ts"

// The draft `Permissions.create` returns for swaps:create: the client's
// payload plus the `set` presets.
type Draft = Permission.Authorized<
  "swaps:create",
  typeof SwapRequest.jsonCreate.Type & Pick<SwapRequest, "requesterId" | "status">
>

export class Swaps extends Context.Service<
  Swaps,
  {
    list(): Effect.Effect<
      ReadonlyArray<SwapRequest>,
      PermissionError.PermissionUnavailable,
      CurrentPrincipal | Authorizer.Authorizer
    >
    findById(id: SwapRequestId): Effect.Effect<SwapRequest, SwapNotFound>
    insert(draft: Draft): Effect.Effect<SwapRequest>
    accept(swap: Permission.Authorized<"swaps:accept", SwapRequest>): Effect.Effect<SwapRequest>
    approve(swap: Permission.Authorized<"swaps:approve", SwapRequest>): Effect.Effect<SwapRequest>
  }
>()("examples/Swaps") {
  static readonly layerNoDeps = Layer.effect(
    Swaps,
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      const mappings = yield* PermissionSql.Mappings
      const repo = yield* SqlModel.makeRepository(SwapRequest, {
        tableName: "swap_requests",
        spanPrefix: "Swaps",
        idColumn: "id"
      })

      const list = Effect.fn("Swaps.list")(function*() {
        const visible = yield* PermissionSql.filter(Permissions, "swaps:read").pipe(
          Effect.provideService(PermissionSql.Mappings, mappings)
        )
        return yield* SqlSchema.findAll({
          Request: Schema.Void,
          Result: SwapRequest,
          execute: () => sql`SELECT * FROM swap_requests WHERE ${visible} ORDER BY created_at`
        })().pipe(Effect.orDie)
      })

      const findById = Effect.fn("Swaps.findById")((id: SwapRequestId) =>
        repo.findById(id).pipe(
          Effect.catchTags({
            NoSuchElementError: () => Effect.fail(new SwapNotFound()),
            SchemaError: Effect.die,
            SqlError: Effect.die
          })
        )
      )

      // `SwapRequest.insert.makeEffect` fills in the generated id and timestamp
      const insert = Effect.fn("Swaps.insert")((draft: Draft) =>
        SwapRequest.insert.makeEffect(draft).pipe(Effect.flatMap(repo.insert), Effect.orDie)
      )

      const setStatus = Effect.fnUntraced(function*(swap: SwapRequest, status: SwapStatus) {
        yield* sql`UPDATE swap_requests SET status = ${status} WHERE id = ${swap.id}`.pipe(Effect.orDie)
        return new SwapRequest({ ...swap, status })
      })

      return Swaps.of({
        list,
        findById,
        insert,
        accept: Effect.fn("Swaps.accept")((swap) => setStatus(swap, "accepted")),
        approve: Effect.fn("Swaps.approve")((swap) => setStatus(swap, "approved"))
      })
    })
  )
}
