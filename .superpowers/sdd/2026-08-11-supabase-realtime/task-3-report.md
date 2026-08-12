# Task 3 Implementation Report

## Status
DONE

## Summary
Successfully migrated Home View from mock API (`/api/deals`) to Supabase real data via `fetchDeals()`. Implemented server-side category filtering with Zustand store integration.

## Modified Files
- `components/views/home.tsx`
  - Added imports: `fetchDeals` from `@/lib/supabase/queries` and `Category` type from `@/lib/types`
  - Replaced fetch("/api/deals") with async fetchDeals() call in initial load useEffect
  - Added category filter dependency useEffect that calls fetchDeals with selected category
  - Removed client-side filter logic (filter condition `d.cat === filter`)
  - Server now returns pre-filtered deals, so UI uses `const cards = deals` directly

## Implementation Details

### Step 1: Imports
```typescript
import { fetchDeals } from "@/lib/supabase/queries";
import type { Category } from "@/lib/types";
```

### Step 2: Initial Load useEffect (filters disabled)
```typescript
useEffect(() => {
  (async () => {
    const deals = await fetchDeals();
    useStore.setState({ deals });
  })();
}, []);
```

### Step 3: Filter Change useEffect
```typescript
useEffect(() => {
  (async () => {
    const cat = filter === "전체" ? undefined : (filter as Category);
    const deals = await fetchDeals(cat);
    useStore.setState({ deals });
  })();
}, [filter]);
```

### Step 4: UI Rendering
- Removed: `const cards = deals.filter((d) => filter === "전체" || d.cat === filter);`
- Changed to: `const cards = deals;`
- Filtering is now handled server-side by fetchDeals()

## Commits
- `b30cf84` - feat: home view - fetch deals from Supabase with category filter

## Testing
- Initial page load: Returns all deals from Supabase (전체 filter)
- Category filter clicks: Dynamically fetch filtered deals based on selected category
  - "식료품": Returns only grocery deals
  - "배달음식": Returns only food delivery deals
  - "생활용품": Returns only household items deals
  - "전체": Returns all deals again (when filter changes)
- No console errors observed
- Deal cards render correctly with Supabase data

## Technical Notes

1. **Type Safety:** `filter as Category` is safe because filter is validated against "전체" first
2. **Async Flow:** Each filter change triggers a new async fetch, no loading skeleton added (consistent with initial implementation)
3. **Error Handling:** fetchDeals() already logs errors and returns empty array on failure
4. **Dependency Array:** `[filter]` ensures re-fetch whenever filter store value changes
5. **Mock Data Elimination:** No more /api/deals endpoint needed for home page

## Dependencies Met
- ✓ Uses `fetchDeals(category?: Category)` from lib/supabase/queries.ts
- ✓ Integrates with existing Zustand store (deals, filter, setFilter)
- ✓ Maintains existing DealCard component usage
- ✓ Preserves filter UI styling and behavior
