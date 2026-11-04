# effect-permission-examples

An example app for the experimental `effect/permission` modules, developed on
the [`permission` branch](https://github.com/jpowersdev/effect/tree/permission)
of a fork of [Effect](https://github.com/Effect-TS/effect).

The fork is pinned as a git submodule at `vendor/effect`, and its packages are
linked from source, so there is no build step. The layout follows Effect's own
HttpApi example in `ai-docs/src/51_http-server`.

## The app

Nurses swap shifts on hospital units, and a unit's manager approves the swap.
The seed data has two hospitals, three units and five profiles:

- Ana, a nurse at St. Mary's, who works in the ICU
- Ben, a float nurse from Riverside, who also works in St. Mary's ICU
- Cara, who manages the ICU
- Dev, a super admin
- Eve, on the support team

The rules in [`src/permissions/Permissions.ts`](src/permissions/Permissions.ts)
are the whole authorization story. They are written once, as conditions over
the principal and the resource, and enforced in four places:

- **At the endpoint.** Each endpoint names the action it requires
  ([`src/api/Api.ts`](src/api/Api.ts)), and one middleware rejects callers who
  could never perform it before the request is decoded. An endpoint without an
  annotation fails at startup.
- **On a loaded record.** Handlers call `Permissions.require("swaps:approve",
  swap)` ([`src/server/Http.ts`](src/server/Http.ts)), which returns the swap
  branded as checked. `Swaps.approve` only accepts a checked swap.
- **In list queries.** `permissionsSql.filter("units:read")` compiles the
  rule, with the caller's values filled in, into the `WHERE` clause
  ([`src/server/Units.ts`](src/server/Units.ts)). One query, and pages stay
  full. The `PermissionsSql` service
  ([`src/server/PermissionsSql.ts`](src/server/PermissionsSql.ts)) closes over
  the SQL client and the table mappings, and also answers the authorizer's
  relation lookups.
- **On writes.** `Permissions.create` fills in the requester and status the
  client can't send, then checks the result. `Permissions.update` checks the
  unit before and after the change, so a manager can't move a unit out of
  their own reach.

Authentication ([`src/server/Authenticator.ts`](src/server/Authenticator.ts))
verifies a JWT with `effect/jose` and builds the principal: the profile's
attributes from the database, the token's `scope` as a limit (a text-message
link can only respond to swaps), its `act` claim as the actor (support can
look while impersonating, but a `forbid` rule stops them approving), and its
`rev` claim, so bumping a profile's revision revokes its tokens.

Requests without a token run as a guest: public endpoints work, and protected
ones answer 401. A signed-in caller who isn't allowed gets a 403.

The same rules guard RPCs ([`src/rpc/SwapRpcs.ts`](src/rpc/SwapRpcs.ts),
[`src/server/Rpc.ts`](src/server/Rpc.ts)).

## Running it

```sh
git clone --recurse-submodules https://github.com/jpowersdev/effect-permission-examples
cd effect-permission-examples
pnpm install
pnpm test        # the scenarios below, against an in-memory SQLite database
pnpm check       # tsc
pnpm start       # serves on http://localhost:3000 (docs at /docs) and logs a token per profile
```

```sh
curl -H "Authorization: Bearer <ana's token>" http://localhost:3000/units
```

| Test | What it shows |
| --- | --- |
| `test/http.test.ts` | Filtered lists per profile, 401 for guests and 403 for callers who aren't allowed, the accept and approve flow, presets on create, a text-message link's limit, impersonation, and revocation by revision |
| `test/rpc.test.ts` | The same rules over RPC |
| `test/status.test.ts` | The real HTTP status codes: 401 for guests and bad tokens, 403 for callers who aren't allowed |
| `test/filter.test.ts` | Compiled SQL filters return exactly the swaps the single-record check allows |

## Rough edges found so far

- RPC handlers can only fail with errors their RPC declares, so each RPC that
  checks a record lists the permission errors.
- Principal attributes are loaded when the token is verified, on every
  request. Lazy, cached loading isn't built yet.
- Relation lookups for single-record checks are one query each; they aren't
  batched yet.
- The type of `Permissions.create`'s result is written out by hand in
  `src/server/Swaps.ts` rather than derived from the model's variants.

## Updating the fork

```sh
pnpm fork:update   # move the pin to the latest commit on the fork's permission branch
```
