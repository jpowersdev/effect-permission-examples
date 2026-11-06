import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted } from "effect"
import { Headers } from "effect/http"
import { RpcClient, RpcTest } from "effect/rpc"
import { SwapRequestId } from "../src/domain/Ids.ts"
import { SwapRpcs } from "../src/rpc/SwapRpcs.ts"
import { RpcLayer } from "../src/server/App.ts"
import { tokenFor } from "./utils.ts"

const s1 = SwapRequestId.make("s-1")

const as = (token: Redacted.Redacted<string>) =>
  Effect.provideService(RpcClient.CurrentHeaders, Headers.fromInput({ authorization: `Bearer ${Redacted.value(token)}` }))

describe("Shift swaps over RPC", () => {
  it.effect("enforces the same rules as the HttpApi", () =>
    Effect.gen(function*() {
      const client = yield* RpcTest.makeClient(SwapRpcs)
      const ana = yield* tokenFor("ana")
      const cara = yield* tokenFor("cara")

      const denied = yield* client.ApproveSwap({ id: s1 }).pipe(as(ana), Effect.flip)
      assert.strictEqual(denied._tag, "PermissionDenied")

      // Cara gets past the middleware, and the handler denies a swap that
      // isn't accepted yet
      const early = yield* client.ApproveSwap({ id: s1 }).pipe(as(cara), Effect.flip)
      assert.strictEqual(early._tag, "PermissionDenied")

      assert.strictEqual((yield* client.AcceptSwap({ id: s1 }).pipe(as(ana))).status, "accepted")
      assert.strictEqual((yield* client.ApproveSwap({ id: s1 }).pipe(as(cara))).status, "approved")
    }).pipe(Effect.provide(Layer.fresh(RpcLayer))))
})
