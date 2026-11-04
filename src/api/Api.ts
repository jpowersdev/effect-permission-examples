import { Schema } from "effect"
import { HttpApi, HttpApiEndpoint, HttpApiGroup } from "effect/http-api"
import { Permission } from "effect/permission"
import { SwapRequestId, UnitId } from "../domain/Ids.ts"
import { SwapNotFound, SwapRequest } from "../domain/SwapRequest.ts"
import { Unit, UnitNotFound } from "../domain/Unit.ts"
import { Permissions } from "../permissions/Permissions.ts"
import { Authentication, Authorize } from "./Middleware.ts"

// Every endpoint says which action it requires. A typo in the action name is
// a compile error, and an endpoint without an annotation fails at startup.
export class UnitsGroup extends HttpApiGroup.make("units")
  .add(
    HttpApiEndpoint.get("list", "/units", {
      success: Schema.Array(Unit.json)
    }).annotate(Permissions.Required, "units:read"),
    HttpApiEndpoint.patch("rename", "/units/:id", {
      params: { id: UnitId },
      payload: Schema.Struct({ name: Schema.String }),
      success: Unit.json,
      error: UnitNotFound
    }).annotate(Permissions.Required, "units:update")
  )
  // Authorize needs the principal, so it is added first, and Authentication,
  // which provides it, is added last and wraps it.
  .middleware(Authorize)
  .middleware(Authentication)
{}

export class SwapsGroup extends HttpApiGroup.make("swaps")
  .add(
    HttpApiEndpoint.get("list", "/swaps", {
      success: Schema.Array(SwapRequest.json)
    }).annotate(Permissions.Required, "swaps:read"),
    HttpApiEndpoint.post("create", "/swaps", {
      payload: SwapRequest.jsonCreate,
      success: SwapRequest.json
    }).annotate(Permissions.Required, "swaps:create"),
    HttpApiEndpoint.post("accept", "/swaps/:id/accept", {
      params: { id: SwapRequestId },
      success: SwapRequest.json,
      error: SwapNotFound
    }).annotate(Permissions.Required, "swaps:accept"),
    HttpApiEndpoint.post("approve", "/swaps/:id/approve", {
      params: { id: SwapRequestId },
      success: SwapRequest.json,
      error: SwapNotFound
    }).annotate(Permissions.Required, "swaps:approve")
  )
  .middleware(Authorize)
  .middleware(Authentication)
{}

export class SystemGroup extends HttpApiGroup.make("system")
  .add(
    HttpApiEndpoint.get("health", "/health", {
      success: Schema.String
    }).annotate(Permissions.Required, Permission.Public)
  )
{}

export class Api extends HttpApi.make("shift-swaps")
  .add(UnitsGroup)
  .add(SwapsGroup)
  .add(SystemGroup)
{}
