import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { SqlClient } from "effect/sql"
import { SwapRequestId, UnitId, ProfileId } from "../src/domain/Ids.ts"
import { AppLayer, clientFor, clientWith, guestClient, tokenFor } from "./utils.ts"

const s1 = SwapRequestId.make("s-1")

describe("Shift swaps over HttpApi", () => {
  it.effect("lists only the units each profile may read, in one query", () =>
    Effect.gen(function*() {
      const ids = (units: ReadonlyArray<{ readonly id: string }>) => units.map((unit) => unit.id)
      // Ana works at St. Mary's
      assert.deepStrictEqual(ids(yield* (yield* clientFor("ana")).units.list()), ["u-ed", "u-icu"])
      // Ben is from Riverside and also works in St. Mary's ICU
      assert.deepStrictEqual(ids(yield* (yield* clientFor("ben")).units.list()), ["u-cardio", "u-icu"])
      // Dev is a super admin
      assert.deepStrictEqual(ids(yield* (yield* clientFor("dev")).units.list()), ["u-cardio", "u-ed", "u-icu"])
    }).pipe(Effect.provide(AppLayer)))

  it.effect("answers guests with 401 and signed-in callers who aren't allowed with 403", () =>
    Effect.gen(function*() {
      const guest = yield* guestClient
      const unauthenticated = yield* guest.units.list().pipe(Effect.flip)
      assert.strictEqual(unauthenticated._tag, "Unauthenticated")

      const ana = yield* clientFor("ana")
      const denied = yield* ana.units.rename({ params: { id: UnitId.make("u-icu") }, payload: { name: "x" } }).pipe(
        Effect.flip
      )
      assert.strictEqual(denied._tag, "PermissionDenied")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("rejects an action the caller could never perform before the request is decoded", () =>
    Effect.gen(function*() {
      const ana = yield* clientFor("ana")
      const error = yield* ana.units.rename({ params: { id: UnitId.make("u-icu") }, payload: { name: "x" } }).pipe(
        Effect.flip
      )
      assert.strictEqual(error._tag, "PermissionDenied")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("runs a swap from request to approval", () =>
    Effect.gen(function*() {
      const ana = yield* clientFor("ana")
      const cara = yield* clientFor("cara")

      // Ana can't approve: she doesn't manage swaps
      const denied = yield* ana.swaps.approve({ params: { id: s1 } }).pipe(Effect.flip)
      assert.strictEqual(denied._tag, "PermissionDenied")

      // Cara can't approve yet: s-1 hasn't been accepted
      const early = yield* cara.swaps.approve({ params: { id: s1 } }).pipe(Effect.flip)
      assert.strictEqual(early._tag, "PermissionDenied")

      assert.strictEqual((yield* ana.swaps.accept({ params: { id: s1 } })).status, "accepted")
      assert.strictEqual((yield* cara.swaps.approve({ params: { id: s1 } })).status, "approved")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("fills in the requester and checks the unit when creating a swap", () =>
    Effect.gen(function*() {
      const ana = yield* clientFor("ana")
      const created = yield* ana.swaps.create({
        payload: { unitId: UnitId.make("u-icu"), recipientId: ProfileId.make("p-ben") }
      })
      assert.strictEqual(created.requesterId, "p-ana")
      assert.strictEqual(created.status, "pending")

      // Ana doesn't work in Cardiology
      const error = yield* ana.swaps.create({
        payload: { unitId: UnitId.make("u-cardio"), recipientId: ProfileId.make("p-ben") }
      }).pipe(Effect.flip)
      assert.strictEqual(error._tag, "PermissionDenied")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("limits a text-message link to responding to swaps", () =>
    Effect.gen(function*() {
      const link = yield* clientFor("ana", { scope: "swaps:respond" })
      assert.strictEqual((yield* link.swaps.accept({ params: { id: s1 } })).status, "accepted")

      const error = yield* link.units.list().pipe(Effect.flip)
      assert.strictEqual(error._tag, "PermissionDenied")
      if (error._tag === "PermissionDenied") assert.strictEqual(error.reason, "Limit")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("lets support look but not approve while impersonating a manager", () =>
    Effect.gen(function*() {
      const ana = yield* clientFor("ana")
      yield* ana.swaps.accept({ params: { id: s1 } })

      const support = yield* clientFor("cara", { actor: "eve" })
      assert.strictEqual((yield* support.swaps.list()).length, 1)
      const error = yield* support.swaps.approve({ params: { id: s1 } }).pipe(Effect.flip)
      assert.strictEqual(error._tag, "PermissionDenied")
      if (error._tag === "PermissionDenied") assert.strictEqual(error.reason, "Forbidden")
    }).pipe(Effect.provide(AppLayer)))

  it.effect("revokes tokens when a profile's revision changes", () =>
    Effect.gen(function*() {
      const token = yield* tokenFor("cara")
      const before = yield* clientWith(token)
      yield* before.units.list()

      // Removing Cara's manager role bumps her revision in the same write
      const sql = yield* SqlClient.SqlClient
      yield* sql`UPDATE profiles SET manages_units = 0, manages_swaps = 0, revision = 'r2' WHERE id = 'p-cara'`

      const error = yield* (yield* clientWith(token)).units.list().pipe(Effect.flip)
      assert.strictEqual(error._tag, "Unauthorized")
    }).pipe(Effect.provide(AppLayer)))
})
