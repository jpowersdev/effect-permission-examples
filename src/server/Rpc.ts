import { Effect, Layer, Redacted } from "effect"
import { PermissionRpc } from "effect/permission"
import { Unauthorized } from "../api/Middleware.ts"
import { CurrentPrincipal } from "../permissions/Principal.ts"
import { Permissions } from "../permissions/Permissions.ts"
import { RpcAuthentication, RpcAuthorize, SwapRpcs } from "../rpc/SwapRpcs.ts"
import { Authenticator } from "./Authenticator.ts"
import { Swaps } from "./Swaps.ts"

export const RpcAuthenticationLayer = Layer.effect(
  RpcAuthentication,
  Effect.gen(function*() {
    const authenticator = yield* Authenticator
    return RpcAuthentication.of(Effect.fn(function*(effect, { headers }) {
      const authorization = headers["authorization"]
      if (authorization === undefined || !authorization.startsWith("Bearer ")) {
        return yield* new Unauthorized()
      }
      const principal = yield* authenticator.authenticate(Redacted.make(authorization.slice("Bearer ".length)))
      return yield* Effect.provideService(effect, CurrentPrincipal, principal)
    }))
  })
)

export const RpcAuthorizeLayer = PermissionRpc.layer(RpcAuthorize, Permissions, { group: SwapRpcs })

export const SwapRpcHandlers = SwapRpcs.toLayer(Effect.gen(function*() {
  const swaps = yield* Swaps
  return {
    AcceptSwap: Effect.fn(function*({ id }) {
      const swap = yield* swaps.findById(id)
      return yield* swaps.accept(yield* Permissions.require("swaps:accept", swap))
    }),
    ApproveSwap: Effect.fn(function*({ id }) {
      const swap = yield* swaps.findById(id)
      return yield* swaps.approve(yield* Permissions.require("swaps:approve", swap))
    })
  }
}))
