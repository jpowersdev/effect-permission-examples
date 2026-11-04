import { assert, describe, it } from "@effect/vitest"
import { Effect } from "effect"
import { Authorizer } from "effect/permission"
import { Permissions } from "../src/permissions/Permissions.ts"
import { CurrentPrincipal } from "../src/permissions/Principal.ts"
import { Authenticator } from "../src/server/Authenticator.ts"
import { Swaps } from "../src/server/Swaps.ts"
import { AppLayer, tokenFor } from "./utils.ts"

describe("Compiled filters", () => {
  it.effect("return exactly the swaps the single-record check allows", () =>
    Effect.gen(function*() {
      const swaps = yield* Swaps
      const authenticator = yield* Authenticator
      const everything = yield* swaps.list().pipe(
        Effect.provideService(CurrentPrincipal, (yield* authenticator.authenticate(yield* tokenFor("dev"))))
      )
      for (const name of ["ana", "ben", "cara", "dev", "eve"]) {
        const principal = yield* authenticator.authenticate(yield* tokenFor(name))
        const visible = (yield* swaps.list().pipe(Effect.provideService(CurrentPrincipal, principal))).map((swap) => swap.id)
        for (const swap of everything) {
          const decision = yield* Permissions.can("swaps:read", swap).pipe(Effect.provideService(CurrentPrincipal, principal))
          assert.strictEqual(Authorizer.isAllow(decision), visible.includes(swap.id), `${name} on ${swap.id}`)
        }
      }
    }).pipe(Effect.provide(AppLayer)))
})
