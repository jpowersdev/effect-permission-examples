import { Schema } from "effect"
import { type Authorizer, PermissionError } from "effect/permission"
import { Rpc, RpcGroup, RpcMiddleware } from "effect/rpc"
import { SwapRequestId } from "../domain/Ids.ts"
import { SwapNotFound, SwapRequest } from "../domain/SwapRequest.ts"
import { Permissions } from "../permissions/Permissions.ts"
import { CurrentPrincipal } from "../permissions/Principal.ts"
import { Unauthorized } from "../api/Middleware.ts"

export class RpcAuthentication extends RpcMiddleware.Service<
  RpcAuthentication,
  {
    provides: CurrentPrincipal
  }
>()("examples/RpcAuthentication", {
  error: Unauthorized
}) {}

// The same authorization middleware as the HttpApi one, for RPC. RPC
// middleware takes a single error schema, hence the union.
export class RpcAuthorize extends RpcMiddleware.Service<
  RpcAuthorize,
  {
    requires: CurrentPrincipal
    provides: Authorizer.Authorizer
  }
>()("examples/RpcAuthorize", {
  error: PermissionError.PermissionError
}) {}

// An RPC handler can only fail with errors its RPC declares, so RPCs that
// check a resource in the handler include the permission errors.
const SwapError = Schema.Union([SwapNotFound, PermissionError.PermissionDenied, PermissionError.PermissionUnavailable])

export const AcceptSwap = Rpc.make("AcceptSwap", {
  payload: { id: SwapRequestId },
  success: SwapRequest.json,
  error: SwapError
}).annotate(Permissions.Required, "swaps:accept")

export const ApproveSwap = Rpc.make("ApproveSwap", {
  payload: { id: SwapRequestId },
  success: SwapRequest.json,
  error: SwapError
}).annotate(Permissions.Required, "swaps:approve")

export class SwapRpcs extends RpcGroup.make(AcceptSwap, ApproveSwap)
  .middleware(RpcAuthorize)
  .middleware(RpcAuthentication)
{}
