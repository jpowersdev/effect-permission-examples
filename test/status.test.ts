import { assert, describe, it } from "@effect/vitest"
import { Effect, Layer, Redacted } from "effect"
import { HttpRouter, HttpServer } from "effect/http"
import { HttpApiBuilder } from "effect/http-api"
import { Api } from "../src/api/Api.ts"
import { HttpLayer } from "../src/server/App.ts"
import { tokenFor } from "./utils.ts"

// The typed client decodes errors by their body, so check the real status
// codes over a web handler too
describe("HTTP status codes", () => {
  it.effect("are 401 for guests and bad tokens, and 403 for callers who aren't allowed", () =>
    Effect.gen(function*() {
      // Build the app once, so the token is signed with the key the handler
      // verifies with
      const context = yield* Layer.build(HttpLayer)
      const app = HttpApiBuilder.layer(Api).pipe(
        Layer.provide(Layer.succeedContext(context)),
        Layer.provide(HttpServer.layerServices)
      )
      const { dispose, handler } = HttpRouter.toWebHandler(app, { disableLogger: true })
      yield* Effect.addFinalizer(() => Effect.promise(() => dispose()))
      const ana = Redacted.value(yield* tokenFor("ana").pipe(Effect.provideContext(context)))
      const status = (path: string, init?: RequestInit) =>
        Effect.promise(() => handler(new Request(`http://localhost${path}`, init)).then((response) => response.status))

      assert.strictEqual(yield* status("/health"), 200)
      assert.strictEqual(yield* status("/units"), 401)
      assert.strictEqual(yield* status("/units", { headers: { authorization: "Bearer nope" } }), 401)
      assert.strictEqual(yield* status("/units", { headers: { authorization: `Bearer ${ana}` } }), 200)
      assert.strictEqual(
        yield* status("/units/u-icu", {
          method: "PATCH",
          headers: { authorization: `Bearer ${ana}`, "content-type": "application/json" },
          body: JSON.stringify({ name: "x" })
        }),
        403
      )
    }).pipe(Effect.scoped))
})
