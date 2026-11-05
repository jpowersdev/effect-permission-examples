import { Condition, Permission } from "effect/permission"
import type { ProfileId, UnitId } from "../domain/Ids.ts"
import { SwapRequest } from "../domain/SwapRequest.ts"
import { Unit } from "../domain/Unit.ts"
import { CurrentPrincipal } from "./Principal.ts"

// "This profile works on this unit". Where the facts live is decided later:
// `PermissionSql.relation` maps it to the `profile_units` table.
export const UnitMembership = Condition.relation<ProfileId, UnitId>("unit:member")

// Rule functions receive references, not values. They run once, here, and
// record conditions that can be checked against one unit in memory or
// compiled into a SQL `WHERE` clause for a list.
export const UnitRules = Permission.rules(CurrentPrincipal, Unit)
  .action("units:read", {
    filter: ({ principal, resource: unit }) =>
      Condition.or(
        principal.attributes.isSuperAdmin,
        Condition.eq(unit.hospitalId, principal.attributes.homeHospitalId),
        Condition.related(UnitMembership, principal.subject.id, unit.id)
      )
  })
  .action("units:update", {
    // Which existing units you may change. `allowed` reuses the filter of an
    // action declared above.
    filter: ({ principal, allowed }) => Condition.and(allowed("units:read"), principal.attributes.managesUnits),
    // What the unit must still satisfy afterwards: you can't move a unit out
    // of your own reach
    check: ({ allowed }) => allowed("units:read")
  })

export const SwapRules = Permission.rules(CurrentPrincipal, SwapRequest)
  .action("swaps:read", {
    filter: ({ principal, resource: swap }) =>
      Condition.or(
        Condition.eq(swap.requesterId, principal.subject.id),
        Condition.eq(swap.recipientId, principal.subject.id),
        Condition.and(
          principal.attributes.managesSwaps,
          Condition.related(UnitMembership, principal.subject.id, swap.unitId)
        )
      )
  })
  .create("swaps:create", {
    // The client sends `SwapRequest.jsonCreate`, which has no requesterId or
    // status. `set` must fill both, or this doesn't compile.
    set: ({ principal }) => ({ requesterId: principal.subject.id, status: "pending" }),
    // Checked on `SwapRequest.insert`, the value that will be written
    check: ({ principal, resource: swap }) => Condition.related(UnitMembership, principal.subject.id, swap.unitId)
  })
  .action("swaps:accept", {
    filter: ({ principal, resource: swap }) =>
      Condition.and(Condition.eq(swap.recipientId, principal.subject.id), Condition.eq(swap.status, "pending"))
  })
  .action("swaps:approve", {
    filter: ({ principal, resource: swap }) =>
      Condition.and(
        Condition.eq(swap.status, "accepted"),
        Condition.notEq(swap.requesterId, principal.subject.id),
        principal.attributes.managesSwaps,
        Condition.related(UnitMembership, principal.subject.id, swap.unitId)
      ),
    // Forbid overrides every filter: support staff can look at a swap while
    // impersonating a manager, but can't approve it
    forbid: ({ principal }) => Condition.isNotNull(principal.actor)
  })

export const Permissions = Permission.make(CurrentPrincipal, {
  rules: [UnitRules, SwapRules],
  // If a principal's limit includes an alias, it includes every action the
  // alias stands for. Links sent by text message carry `swaps:respond`.
  aliases: {
    "swaps:respond": ["swaps:read", "swaps:accept"]
  }
})
