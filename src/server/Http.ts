import { Effect, Layer, Redacted } from "effect"
import { HttpApiBuilder } from "effect/http-api"
import { PermissionHttpApi, Principal } from "effect/permission"
import { Api } from "../api/Api.ts"
import { Authentication, Authorize } from "../api/Middleware.ts"
import { CurrentPrincipal } from "../permissions/Principal.ts"
import { Permissions } from "../permissions/Permissions.ts"
import { Authenticator } from "./Authenticator.ts"
import { Swaps } from "./Swaps.ts"
import { Units } from "./Units.ts"

export const AuthenticationLayer = Layer.effect(
  Authentication,
  Effect.gen(function*() {
    const authenticator = yield* Authenticator
    return Authentication.of({
      bearer: Effect.fn(function*(httpEffect, { credential }) {
        // No token is a guest: public endpoints work, protected ones answer 401
        const principal = Redacted.value(credential) === ""
          ? Principal.guest
          : yield* authenticator.authenticate(credential)
        return yield* Effect.provideService(httpEffect, CurrentPrincipal, principal)
      })
    })
  })
)

// The authorization middleware comes from the permission modules. With `api`,
// the layer fails to build if any endpoint has no required action, or
// requires one without being guarded by Authorize.
export const AuthorizeLayer = PermissionHttpApi.layer(Authorize, Permissions, { api: Api })

export const UnitsHandlers = HttpApiBuilder.group(
  Api,
  "units",
  Effect.fn(function*(handlers) {
    const units = yield* Units
    return handlers.handleAll({
      list: () => units.list(),
      rename: Effect.fn(function*({ params, payload }) {
        const unit = yield* units.findById(params.id)
        // Checks the unit as it is, builds Unit.update with the new name,
        // then checks the unit as it would be
        const renamed = yield* Permissions.update("units:update", unit, { name: payload.name })
        return yield* units.save(renamed)
      })
    })
  })
)

export const SwapsHandlers = HttpApiBuilder.group(
  Api,
  "swaps",
  Effect.fn(function*(handlers) {
    const swaps = yield* Swaps
    return handlers.handleAll({
      list: () => swaps.list(),
      create: Effect.fn(function*({ payload }) {
        // Builds SwapRequest.insert from the payload, with requesterId and
        // status filled in, then checks the caller works on the swap's unit
        const draft = yield* Permissions.create("swaps:create", payload)
        return yield* swaps.insert(draft)
      }),
      accept: Effect.fn(function*({ params }) {
        const swap = yield* swaps.findById(params.id)
        return yield* swaps.accept(yield* Permissions.require("swaps:accept", swap))
      }),
      approve: Effect.fn(function*({ params }) {
        const swap = yield* swaps.findById(params.id)
        return yield* swaps.approve(yield* Permissions.require("swaps:approve", swap))
      })
    })
  })
)

export const SystemHandlers = HttpApiBuilder.group(
  Api,
  "system",
  (handlers) => handlers.handle("health", () => Effect.succeed("ok"))
)
