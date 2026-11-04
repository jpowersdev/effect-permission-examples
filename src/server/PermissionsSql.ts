import { PermissionSql } from "effect/permission"
import { SwapRequest } from "../domain/SwapRequest.ts"
import { Unit } from "../domain/Unit.ts"
import { Permissions, UnitMembership } from "../permissions/Permissions.ts"

// Where each resource and relation lives. The layer closes over the SQL
// client and these mappings, so `filter` only needs the principal and the
// authorizer, which the authorization middleware provides. It also answers
// the authorizer's `UnitMembership` lookups.
export class PermissionsSql extends PermissionSql.Service<PermissionsSql>()("examples/PermissionsSql", {
  permissions: Permissions,
  tables: [PermissionSql.table(Unit, "units"), PermissionSql.table(SwapRequest, "swap_requests")],
  relations: [
    PermissionSql.relation(UnitMembership, { table: "profile_units", subject: "profile_id", object: "unit_id" })
  ]
}) {}
