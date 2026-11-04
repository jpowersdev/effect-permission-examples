import { Schema } from "effect"
import { HttpApiMiddleware, HttpApiSecurity } from "effect/http-api"
import { type Authorizer, PermissionError } from "effect/permission"
import { CurrentPrincipal } from "../permissions/Principal.ts"

export class Unauthorized extends Schema.TaggedError<Unauthorized>()("Unauthorized", {}, {
  httpApiStatus: 401
}) {}

// Authentication turns a bearer token into the current principal. Requests
// without one get the guest principal, and a bad token is a 401.
export class Authentication extends HttpApiMiddleware.Service<
  Authentication,
  {
    provides: CurrentPrincipal
  }
>()("examples/Authentication", {
  requiredForClient: true,
  security: { bearer: HttpApiSecurity.bearer },
  error: Unauthorized
}) {}

// Authorize reads the action each endpoint requires and rejects callers who
// could never perform it, before the request is decoded: guests with a 401,
// signed-in callers with a 403. It provides the Authorizer, so handlers can
// check specific resources with `Permissions.require`, and because it declares
// the permission errors, handlers may fail with them too.
export class Authorize extends HttpApiMiddleware.Service<
  Authorize,
  {
    requires: CurrentPrincipal
    provides: Authorizer.Authorizer
  }
>()("examples/Authorize", {
  error: PermissionError.errors
}) {}
