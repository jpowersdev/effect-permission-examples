import { Context, Effect, Layer, Option, Redacted, Schema } from "effect"
import { Principal } from "effect/permission"
import { SqlClient, SqlSchema } from "effect/sql"
import { Unauthorized } from "../api/Middleware.ts"
import { Member } from "../permissions/Principal.ts"
import { Tokens } from "./Tokens.ts"

const Profile = Schema.Struct({
  revision: Schema.String,
  homeHospitalId: Member.fields.homeHospitalId,
  isSuperAdmin: Schema.BooleanFromBit,
  managesUnits: Schema.BooleanFromBit,
  managesSwaps: Schema.BooleanFromBit
})

// Turns a bearer token into a principal, for both the HttpApi and the RPC
// middleware.
export class Authenticator extends Context.Service<
  Authenticator,
  {
    authenticate(token: Redacted.Redacted<string>): Effect.Effect<Principal.Authenticated<Member>, Unauthorized>
  }
>()("examples/Authenticator") {
  static readonly layerNoDeps = Layer.effect(
    Authenticator,
    Effect.gen(function*() {
      const sql = yield* SqlClient.SqlClient
      const tokens = yield* Tokens

      const findProfile = SqlSchema.findOneOption({
        Request: Schema.String,
        Result: Profile,
        execute: (id) => sql`SELECT * FROM profiles WHERE id = ${id}`
      })

      const authenticate = Effect.fn("Authenticator.authenticate")(
        function*(token: Redacted.Redacted<string>) {
          const claims = yield* tokens.verify(token)
          const profile = yield* findProfile(claims.sub).pipe(Effect.flatMap(Option.match({
            onNone: () => Effect.fail(new Unauthorized()),
            onSome: Effect.succeed
          })))
          // Bumping a profile's revision revokes every token issued before it
          if (profile.revision !== claims.rev) return yield* new Unauthorized()
          return Principal.make({
            subject: claims.sub,
            attributes: new Member(profile),
            actor: claims.act?.sub,
            limit: claims.scope?.split(" "),
            revision: claims.rev
          })
        },
        Effect.catchTags({
          JoseError: () => Effect.fail(new Unauthorized()),
          SchemaError: () => Effect.fail(new Unauthorized()),
          SqlError: Effect.die
        })
      )

      return Authenticator.of({ authenticate })
    })
  )
}
