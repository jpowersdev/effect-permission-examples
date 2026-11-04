import { Effect, Layer, Redacted } from "effect"
import { HttpClientRequest, HttpServer } from "effect/http"
import { HttpApiMiddleware, HttpApiTest } from "effect/http-api"
import { Api } from "../src/api/Api.ts"
import { Authentication } from "../src/api/Middleware.ts"
import { ProfileId } from "../src/domain/Ids.ts"
import { HttpLayer } from "../src/server/App.ts"
import { Tokens } from "../src/server/Tokens.ts"

// A fresh database, services, handlers, and middleware for each test
export const AppLayer = Layer.mergeAll(HttpLayer, HttpServer.layerServices)

// Issues a token for a seeded profile
export const tokenFor = (
  name: string,
  options: { readonly scope?: string | undefined; readonly actor?: string | undefined; readonly revision?: string } = {}
) =>
  Tokens.use((tokens) =>
    tokens.issue({
      subject: ProfileId.make(`p-${name}`),
      revision: options.revision ?? "r1",
      scope: options.scope,
      actor: options.actor === undefined ? undefined : ProfileId.make(`p-${options.actor}`)
    }))

// A typed in-memory client that sends the token as a bearer token
export const clientWith = (token: Redacted.Redacted<string>) =>
  HttpApiTest.groups(Api, ["units", "swaps"]).pipe(
    Effect.provide(HttpApiMiddleware.layerClient(
      Authentication,
      ({ next, request }) => next(HttpClientRequest.bearerToken(request, Redacted.value(token)))
    ))
  )

export const clientFor = (name: string, options?: Parameters<typeof tokenFor>[1]) =>
  Effect.flatMap(tokenFor(name, options), clientWith)
