# Task 2 Implementation Report

## Status
DONE

## Summary
Implemented `lib/supabase/queries.ts` with `fetchDeals`, `fetchDeal`, `subscribeToParticipations`, and the internal `rowToDeal` mapper, wired to the real `group_buys`/`participations` schema from Task 1's types.

## Created Files
- lib/supabase/queries.ts (3 exported functions + 1 internal helper)
  - `fetchDeals(category?)` — lists `group_buys` joined with `participations!inner`, newest first, optional category filter, returns `[]` on error
  - `fetchDeal(dealId)` — single `group_buys` row via `.single()`, returns `null` on error/not found
  - `subscribeToParticipations(dealId, callback)` — loads initial `participations` rows, then subscribes to `postgres_changes` (`event: "*"`, filtered by `group_buy_id`), refetching on any change; returns an unsubscribe function that calls `removeChannel`
  - `rowToDeal(row, participations)` — maps `GroupBuyRow`/`ParticipationRow[]` → `Deal`, converts `deadline` to epoch ms, sets `joined = participations.length`, maps `CAT_EMOJI[row.category]`

## Commits
- 97868cf — feat: add Supabase query utilities for group_buys and Realtime participations (base: 087c158)

## Tests
- `npx tsc --noEmit` — passes with no errors (project has no test runner/lint script configured, so this is the available verification)
- Manual review of query shapes against `supabase/schema.sql`: confirmed the `participations!inner` join is safe because the DB trigger (schema.sql line ~169) auto-inserts a `participations` row for the host on `group_buys` creation, so no group buy is ever silently excluded by the inner join
- Manual trace of `subscribeToParticipations`: initial load fires immediately, `postgres_changes` filter scopes to the single deal, cleanup correctly calls `sb.removeChannel(channel)`
- Confirmed `participations` table has a permissive `select` RLS policy (`participations_read ... using (true)`) so the client-side realtime query won't be blocked by RLS

## Concerns
- **`Deal.host` field**: The task's sample `rowToDeal` never set `host`, but `Deal.host` is a required `string` field (not optional), so the sample as given would fail `tsc --noEmit`. Fixed by setting `host: row.host_id` (the UUID) as a placeholder — same stopgap pattern already used in `app/api/deals/route.ts`'s existing `GET` handler. Resolving this to an actual nickname requires a `profiles` join, which is out of scope for this task (flagged with a code comment); a later task should replace this once profile data is available in the query layer.
- **Category filter type**: The spec's `fetchDeals(category?: Category)` signature can't express the `"전체"` sentinel value used by `components/views/home.tsx`'s existing filter UI (`Category` doesn't include `"전체"`). Widened the parameter to `Category | "전체"` to match the codebase's existing filter convention (`lib/store.ts` `filter: string`) and keep the function usable as a drop-in for the home view's filter state.
- `fetchDeals`/`fetchDeal` use `participations!inner`, meaning a `group_buys` row with zero participations would be excluded entirely rather than surfaced with `joined: 0`. This matches the given spec and is currently safe due to the auto-join trigger, but is worth keeping in mind if that trigger is ever removed.
