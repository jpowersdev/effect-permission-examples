/**
 * Serves the shift-swap API on http://localhost:3000, with docs at /docs, and
 * logs an access token for each seeded profile so you can try it:
 *
 *   curl -H "Authorization: Bearer <token>" http://localhost:3000/units
 */
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer"
import * as NodeRuntime from "@effect/platform-node/NodeRuntime"
import { Effect, Layer, Redacted } from "effect"
import { HttpRouter } from "effect/http"
import { HttpApiBuilder, HttpApiScalar } from "effect/http-api"
import { createServer } from "node:http"
import { Api } from "./api/Api.ts"
import { ProfileId } from "./domain/Ids.ts"
import { HttpLayer } from "./server/App.ts"
import { Tokens } from "./server/Tokens.ts"

const Routes = Layer.mergeAll(
  HttpApiBuilder.layer(Api, { openapiPath: "/openapi.json" }),
  HttpApiScalar.layer(Api, { path: "/docs" })
)

const LogTokens = Layer.effectDiscard(Effect.gen(function*() {
  const tokens = yield* Tokens
  for (const name of ["ana", "ben", "cara", "dev"]) {
    const token = yield* tokens.issue({ subject: ProfileId.make(`p-${name}`), revision: "r1" })
    yield* Effect.log(`Token for ${name}: ${Redacted.value(token)}`)
  }
}))

// The server and the token logger share one HttpLayer, so tokens are signed
// with the same key the server verifies them with.
const Main = Layer.mergeAll(HttpRouter.serve(Routes), LogTokens).pipe(
  Layer.provide(HttpLayer),
  Layer.provide(NodeHttpServer.layer(createServer, { port: 3000 }))
)

Layer.launch(Main).pipe(NodeRuntime.runMain)
