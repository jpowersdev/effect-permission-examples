import { Schema } from "effect"
import { Model } from "effect/schema"
import { ProfileId, SwapRequestId, UnitId } from "./Ids.ts"

export const SwapStatus = Schema.Literals(["pending", "accepted", "approved"])
export type SwapStatus = typeof SwapStatus.Type

// A request from one nurse to swap a shift with another, approved by a
// manager of the unit.
export class SwapRequest extends Model.Class<SwapRequest>("SwapRequest")({
  id: Model.UuidV4Insert(SwapRequestId),
  unitId: UnitId,
  recipientId: ProfileId,
  // `GeneratedByApp` fields are left out of `SwapRequest.jsonCreate`, so
  // clients can't send them. The `swaps:create` permission fills them in with
  // its `set` presets: the requester is always the caller.
  requesterId: Model.GeneratedByApp(ProfileId),
  status: Model.GeneratedByApp(SwapStatus),
  createdAt: Model.DateTimeInsert
}) {}

export class SwapNotFound extends Schema.TaggedError<SwapNotFound>()("SwapNotFound", {}, {
  httpApiStatus: 404
}) {}
