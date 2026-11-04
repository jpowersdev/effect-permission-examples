import { Clock, Context, Effect, Layer, Redacted, Schema } from "effect"
import type { Mac } from "effect/crypto"
import { Jwk, Jwt } from "effect/jose"
import * as NodeCrypto from "@effect/platform-node/NodeCrypto"
import { ProfileId } from "../domain/Ids.ts"

// What an access token carries. `rev` is the profile's security revision at
// issue time; `scope` limits what the token may be used for; `act` is set when
// someone acts on the subject's behalf (RFC 8693).
export const AccessClaims = Schema.Struct({
  sub: ProfileId,
  rev: Schema.String,
  exp: Schema.Number,
  scope: Schema.optional(Schema.String),
  act: Schema.optional(Schema.Struct({ sub: ProfileId }))
})
export type AccessClaims = typeof AccessClaims.Type

export class Tokens extends Context.Service<
  Tokens,
  {
    issue(options: {
      readonly subject: ProfileId
      readonly revision: string
      readonly scope?: string | undefined
      readonly actor?: ProfileId | undefined
    }): Effect.Effect<Redacted.Redacted<string>>
    verify(token: Redacted.Redacted<string>): Effect.Effect<AccessClaims, Jwt.JwtError>
  }
>()("examples/Tokens") {
  // Signs HS256 tokens with a key generated at startup. A real deployment
  // would verify tokens from an identity provider with `Jwt.verifyWithKeySet`.
  static readonly layerNoDeps = Layer.effect(
    Tokens,
    Effect.gen(function*() {
      const key = yield* Jwk.importSecret(yield* Jwk.generateSecret("HS256"), "HS256").pipe(Effect.orDie)
      const services = yield* Effect.context<Mac.Mac>()

      const issue = Effect.fn("Tokens.issue")(function*(options: {
        readonly subject: ProfileId
        readonly revision: string
        readonly scope?: string | undefined
        readonly actor?: ProfileId | undefined
      }) {
        const now = yield* Clock.currentTimeMillis
        return yield* Jwt.sign(AccessClaims, {
          sub: options.subject,
          rev: options.revision,
          exp: Math.floor(now / 1000) + 3600,
          ...(options.scope === undefined ? {} : { scope: options.scope }),
          ...(options.actor === undefined ? {} : { act: { sub: options.actor } })
        }, key).pipe(Effect.provideContext(services), Effect.orDie)
      })

      const verify = (token: Redacted.Redacted<string>) =>
        Jwt.verify(AccessClaims, token, key, { requiredClaims: ["sub", "exp"] }).pipe(
          Effect.map(({ claims }) => claims),
          Effect.provideContext(services)
        )

      return Tokens.of({ issue, verify })
    })
  )

  static readonly layer = this.layerNoDeps.pipe(Layer.provide(NodeCrypto.layer))
}
