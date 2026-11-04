import { Context, Schema } from "effect"
import type { Principal } from "effect/permission"
import { HospitalId } from "../domain/Ids.ts"

// What the rules need to know about the caller. The application owns this
// shape; the permission modules only add the subject, actor, and limits.
export class Member extends Schema.Class<Member>("Member")({
  homeHospitalId: HospitalId,
  isSuperAdmin: Schema.Boolean,
  managesUnits: Schema.Boolean,
  managesSwaps: Schema.Boolean
}) {}

// The application's principal service. Handlers that check permissions
// require it, so the compiler makes sure some middleware provides it.
export class CurrentPrincipal extends Context.Service<
  CurrentPrincipal,
  Principal.Principal<Member>
>()("examples/CurrentPrincipal") {}
