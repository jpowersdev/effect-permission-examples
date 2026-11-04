import { Layer } from "effect"
import { Permissions } from "../permissions/Permissions.ts"
import { PermissionsSql } from "./PermissionsSql.ts"
import { Authenticator } from "./Authenticator.ts"
import { DatabaseLayer } from "./Database.ts"
import { AuthenticationLayer, AuthorizeLayer, SwapsHandlers, SystemHandlers, UnitsHandlers } from "./Http.ts"
import { RpcAuthenticationLayer, RpcAuthorizeLayer, SwapRpcHandlers } from "./Rpc.ts"
import { Swaps } from "./Swaps.ts"
import { Tokens } from "./Tokens.ts"
import { Units } from "./Units.ts"

// The in-process authorizer for the rules, looking relation facts up in SQL
// through PermissionsSql
const AuthorizerLayer = Permissions.layer.pipe(Layer.provideMerge(PermissionsSql.layer))

const ServicesLayer = Layer.mergeAll(Units.layerNoDeps, Swaps.layerNoDeps, Authenticator.layerNoDeps).pipe(
  Layer.provideMerge(Tokens.layer),
  Layer.provideMerge(AuthorizerLayer),
  Layer.provideMerge(DatabaseLayer)
)

// Everything the HttpApi groups need: handlers, and both middleware. The
// middleware are merged, because the HTTP pipeline also resolves them when
// the routes are built.
export const HttpLayer = Layer.mergeAll(UnitsHandlers, SwapsHandlers, SystemHandlers).pipe(
  Layer.provideMerge(Layer.mergeAll(AuthenticationLayer, AuthorizeLayer)),
  Layer.provideMerge(ServicesLayer)
)

// Everything the RPC group needs
export const RpcLayer = SwapRpcHandlers.pipe(
  Layer.provideMerge(Layer.mergeAll(RpcAuthenticationLayer, RpcAuthorizeLayer)),
  Layer.provideMerge(ServicesLayer)
)
