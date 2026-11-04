import { Schema } from "effect"

export const HospitalId = Schema.String.pipe(Schema.brand("HospitalId"))
export type HospitalId = typeof HospitalId.Type

export const UnitId = Schema.String.pipe(Schema.brand("UnitId"))
export type UnitId = typeof UnitId.Type

export const ProfileId = Schema.String.pipe(Schema.brand("ProfileId"))
export type ProfileId = typeof ProfileId.Type

export const SwapRequestId = Schema.String.pipe(Schema.brand("SwapRequestId"))
export type SwapRequestId = typeof SwapRequestId.Type
