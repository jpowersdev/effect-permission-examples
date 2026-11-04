import { Schema } from "effect"
import { Model } from "effect/schema"
import { HospitalId, UnitId } from "./Ids.ts"

// A hospital unit, such as an ICU. Units are seeded, so every field is a plain
// column present in every variant.
export class Unit extends Model.Class<Unit>("Unit")({
  id: UnitId,
  hospitalId: HospitalId,
  name: Schema.String
}) {}

export class UnitNotFound extends Schema.TaggedError<UnitNotFound>()("UnitNotFound", {}, {
  httpApiStatus: 404
}) {}
