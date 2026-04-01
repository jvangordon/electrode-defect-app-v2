# EDRS v3 Change Specification

**Date:** April 1, 2026
**Baseline:** electrode-defect-app-v2 (current state on main branch)
**Scope:** 4 new features using existing data model with minimal schema additions

---

## Prerequisites

Before implementing any feature, verify you have:
- PostgreSQL database `electrode_v2` with all 11 existing tables
- Backend running (FastAPI on port 8000)
- Frontend running (React + TypeScript + Vite, Tailwind CSS v4)
- All existing tests passing (39 backend, 37 frontend)

**IMPORTANT CSS NOTE:** The app uses Tailwind CSS v4 with `@import "tailwindcss"` and `@theme` blocks in `index.css`. Do NOT add a global `* { padding: 0; margin: 0; }` reset — this overrides all Tailwind padding utilities. The only global reset should be `*, *::before, *::after { box-sizing: border-box; }`.

---

## Feature 1: Configurable Thresholds (Settings Panel)

### Purpose
Allow a Quality Lead to adjust SPC flagging thresholds and risk scoring boundaries without code changes. Changes take effect immediately because the backend scoring logic reads from database tables at query time.

### Database Changes

**New table: `app_settings`**

```sql
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Seed with default values:**

```sql
INSERT INTO app_settings (key, value, description) VALUES
('spc_z_threshold', '1.5', 'Z-score threshold for SPC anomaly flagging on bake runs. Parameters exceeding this many standard deviations are flagged.'),
('defect_rate_anomaly_threshold', '0.05', 'Defect rate above which a run is considered anomalous (0.05 = 5%)'),
('car_deck_high_risk_cutoff', '7', 'Car deck number at or above which an electrode is considered high-risk position'),
('lot_high_risk_defect_rate', '0.05', 'Lot defect rate at or above which a lot is classified as high-risk tier (0.05 = 5%)');
```

The `composition_risk` table already stores quintile boundaries (Q1-Q5 with avg_defect_rate and probability_high_defect_event). These are editable directly — no new columns needed.

The `risk_factors` table stores the 6 categorical risk factors with risk_group (low/medium/high). The risk_group assignments are editable directly.

### Backend Changes

**New router: `backend/routers/settings.py`**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/settings` | GET | Return all rows from `app_settings` as a key-value object, plus current `composition_risk` rows and `risk_factors` grouped by factor_name |
| `/api/settings` | PATCH | Accept a JSON body with `{ key: value }` pairs. Update matching rows in `app_settings`. For composition_risk updates, accept `{ composition_risk: [{quintile, avg_defect_rate, probability_high_defect_event}] }`. For risk_factors, accept `{ risk_factors: [{id, risk_group}] }` |
| `/api/settings/reset` | POST | Reset `app_settings` to default values. Reset `composition_risk` to original seed values. Reset `risk_factors` risk_group assignments to original seed values. |

**Modify `backend/routers/anomaly.py`:**

Replace the hardcoded `1.5` z-score threshold (appears 4 times, once per parameter: car_deck, duration_hours, actual_kwh, total_downtime) with a value read from `app_settings` WHERE key = 'spc_z_threshold'. Read once at the start of the request, not per-parameter.

Current code pattern (repeated 4 times):
```python
if abs(z_deck) > 1.5:
```

Change to:
```python
# At top of endpoint function:
cur.execute("SELECT value FROM app_settings WHERE key = 'spc_z_threshold'")
z_threshold = float(cur.fetchone()['value'])

# Then use:
if abs(z_deck) > z_threshold:
```

**Register the new router in `backend/main.py`:**
```python
from backend.routers import settings
app.include_router(settings.router, prefix="/api")
```

### Frontend Changes

**New component: Settings slide-out panel**

- Add a gear icon (⚙️) button in the sidebar, below the nav items but above the footer. Clicking it opens a slide-out panel from the right side (not a new page).
- The panel contains:
  - **SPC Thresholds** section: numeric inputs for z-score threshold (default 1.5), defect rate anomaly threshold (default 5%, display as percentage)
  - **Position Risk** section: car deck high-risk cutoff (default 7), lot high-risk defect rate (default 5%)
  - **Composition Risk Quintiles** section: editable table showing Q1-Q5 with avg_defect_rate and probability_high_defect_event columns
  - **Risk Factor Groups** section: table showing each factor_name + factor_level with a dropdown to change risk_group (low/medium/high)
  - **"Save Changes"** button (primary amber style) and **"Reset to Defaults"** button (secondary/outline style)
- Visual treatment: clearly marked as an admin function with a header like "Quality Configuration" and a subtitle "Changes take effect immediately for all users"
- Use `api.getSettings()` and `api.updateSettings(data)` and `api.resetSettings()`

**Add to `frontend/src/lib/api.ts`:**
```typescript
getSettings: () => request<SettingsResponse>('/settings'),
updateSettings: (data: Partial<SettingsUpdate>) =>
  request<void>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
resetSettings: () =>
  request<void>('/settings/reset', { method: 'POST' }),
```

---

## Feature 2: Multi-Run Trending in Run Comparison

### Purpose
Let engineers see a furnace's run history as a time-series and click into specific runs for comparison. Bridges the gap between Equipment Trending (monthly aggregates) and Run Comparison (individual run details).

### Database Changes
None. Uses existing `runs` table data.

### Backend Changes
None. The existing `GET /api/runs?department=bake&furnace=BF-3&limit=30` endpoint already returns the needed data.

### Frontend Changes

**Modify `frontend/src/pages/RunComparison.tsx`:**

Add a mode toggle at the top of the page, next to the Bake/Graphite tabs:
- **"Compare Two"** (current behavior, default)
- **"Furnace Trend"** (new)

When "Furnace Trend" mode is active:
1. Show a furnace dropdown (populated from the distinct furnaces in the run list)
2. Fetch the last 30 runs for the selected furnace: `api.getRuns({ department, furnace, limit: '30' })`
3. Render a Recharts `LineChart` with:
   - X-axis: run date (formatted as MMM DD)
   - Y-axis: defect rate (as percentage)
   - Each dot is a run. Dots colored by defect rate threshold (green < 3%, amber 3-7%, red > 7%)
   - Dot size: r={6} for easy clicking
4. On dot hover: show a tooltip with run_number, date, pieces, defects, defect_rate, profile, car_deck
5. On dot click: select that run (same as clicking a row in the table). If two dots are clicked, switch to Compare Two mode with those runs pre-selected.
6. Below the chart, show a mini run list table (same columns as current table) sorted by date descending, so the user can also select from the table.

**Implementation notes:**
- The mode toggle should be a segmented control (two buttons side by side), not a tab — visually distinct from the Bake/Graphite department tabs
- Reuse the existing `ComparisonView` component when two runs are selected
- The chart should be inside a card container with the same styling as other charts in the app
- Chart height: 350px to give enough room for dot interaction

---

## Feature 3: Knowledge Search (Global)

### Purpose
Let engineers search across all accumulated investigation knowledge — root cause details, notes, corrective actions — to find what the team learned previously about similar problems.

### Database Changes

**Add GIN indexes for full-text search:**

```sql
-- Create a combined text search column on investigations
ALTER TABLE investigations ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE investigations SET search_vector = 
  to_tsvector('english', 
    coalesce(root_cause_detail, '') || ' ' || 
    coalesce(corrective_action, '') || ' ' || 
    coalesce(effectiveness_notes, '') || ' ' ||
    coalesce(defect_code, '') || ' ' ||
    coalesce(defect_site, '')
  );
CREATE INDEX IF NOT EXISTS idx_investigations_search ON investigations USING GIN(search_vector);

-- Create search index on investigation_notes
ALTER TABLE investigation_notes ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE investigation_notes SET search_vector = to_tsvector('english', coalesce(note_text, ''));
CREATE INDEX IF NOT EXISTS idx_notes_search ON investigation_notes USING GIN(search_vector);

-- Create search index on corrective_actions
ALTER TABLE corrective_actions ADD COLUMN IF NOT EXISTS search_vector tsvector;
UPDATE corrective_actions SET search_vector = 
  to_tsvector('english', 
    coalesce(title, '') || ' ' || 
    coalesce(description, '') || ' ' || 
    coalesce(verification_notes, '')
  );
CREATE INDEX IF NOT EXISTS idx_actions_search ON corrective_actions USING GIN(search_vector);
```

**Add these indexes in `backend/seed.py`** at the end of the seed function, or create a separate migration script.

**Important:** Also add triggers to keep search_vector updated on INSERT/UPDATE, or update the vectors in the application layer when creating/updating records.

### Backend Changes

**New endpoint in `backend/routers/investigation.py`:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/knowledge/search` | GET | Query param: `q` (search string). Returns matching results grouped by investigation. |

**Implementation:**

```python
@router.get("/knowledge/search")
def knowledge_search(q: str, limit: int = 20):
    # Convert user query to tsquery
    # Handle multi-word queries: split on spaces, join with &
    terms = q.strip().split()
    tsquery = " & ".join(terms)
    
    with get_cursor() as cur:
        # Search investigations
        cur.execute("""
            SELECT i.investigation_id, i.gpn, i.defect_code, i.defect_site,
                   i.root_cause_category, i.root_cause_detail, i.status,
                   ts_headline('english', coalesce(i.root_cause_detail,'') || ' ' || coalesce(i.corrective_action,'') || ' ' || coalesce(i.effectiveness_notes,''),
                     to_tsquery('english', %s),
                     'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                   ts_rank(i.search_vector, to_tsquery('english', %s)) as rank,
                   'investigation' as source
            FROM investigations i
            WHERE i.search_vector @@ to_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (tsquery, tsquery, tsquery, limit))
        inv_results = [dict(r) for r in cur.fetchall()]
        
        # Search notes
        cur.execute("""
            SELECT n.note_id, n.investigation_id, n.author, n.note_text,
                   ts_headline('english', n.note_text, to_tsquery('english', %s),
                     'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                   ts_rank(n.search_vector, to_tsquery('english', %s)) as rank,
                   'note' as source
            FROM investigation_notes n
            WHERE n.search_vector @@ to_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (tsquery, tsquery, tsquery, limit))
        note_results = [dict(r) for r in cur.fetchall()]
        
        # Search corrective actions
        cur.execute("""
            SELECT a.action_id, a.investigation_id, a.title, a.description,
                   a.action_type, a.status, a.verified_at,
                   ts_headline('english', coalesce(a.title,'') || ' ' || coalesce(a.description,'') || ' ' || coalesce(a.verification_notes,''),
                     to_tsquery('english', %s),
                     'StartSel=<mark>, StopSel=</mark>, MaxWords=50, MinWords=20') as snippet,
                   ts_rank(a.search_vector, to_tsquery('english', %s)) as rank,
                   'action' as source
            FROM corrective_actions a
            WHERE a.search_vector @@ to_tsquery('english', %s)
            ORDER BY rank DESC
            LIMIT %s
        """, (tsquery, tsquery, tsquery, limit))
        action_results = [dict(r) for r in cur.fetchall()]
    
    # Group all results by investigation_id
    # Merge inv_results, note_results, action_results
    # Return grouped results with source attribution
    
    return {
        "query": q,
        "total_results": len(inv_results) + len(note_results) + len(action_results),
        "investigations": inv_results,
        "notes": note_results,
        "actions": action_results,
    }
```

**Error handling:** If `to_tsquery` fails (bad input), fall back to ILIKE search:
```python
try:
    # tsquery approach
except:
    # fallback: ILIKE '%term%' across columns
```

### Frontend Changes

**Global search (⌘K shortcut):**

Create a new component `frontend/src/components/KnowledgeSearch.tsx`:
- A modal/overlay triggered by clicking a search icon in the sidebar header OR pressing ⌘K (Cmd+K / Ctrl+K)
- Search input at the top of the modal, large and prominent (text-lg, full width)
- Results below, grouped by type (Investigations, Notes, Corrective Actions)
- Each result shows:
  - Source badge (Investigation / Note / Action)
  - Investigation ID and link (clickable, navigates to investigation detail)
  - Highlighted text snippet (render the `<mark>` tags from ts_headline as actual highlights with amber background)
  - Investigation status badge
  - For actions: whether it was verified effective
- Empty state: "Search across all investigation knowledge — root causes, notes, corrective actions"
- Loading state while searching (debounce input by 300ms)

**Add keyboard shortcut handler in `App.tsx`:**
```typescript
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setSearchOpen(true);
    }
  };
  window.addEventListener('keydown', handler);
  return () => window.removeEventListener('keydown', handler);
}, []);
```

**Add to `frontend/src/lib/api.ts`:**
```typescript
searchKnowledge: (q: string) => request<KnowledgeSearchResponse>(`/knowledge/search?q=${encodeURIComponent(q)}`),
```

**Visual treatment:**
- The search modal should overlay the page with a semi-transparent backdrop
- Card-style results with the same bg-[#141824] treatment as other cards
- Highlighted text uses `bg-amber-500/20 text-amber-300 px-0.5 rounded` on `<mark>` elements
- Close on Escape key or clicking backdrop

---

## Feature 4: Prescriptive Corrective Action Recommendations

### Purpose
Upgrade the "Similar Past Investigations" panel to not just show similar cases, but rank which corrective action types actually worked based on historical data.

### Database Changes

**Add columns to `corrective_actions`:**

```sql
ALTER TABLE corrective_actions 
  ADD COLUMN IF NOT EXISTS defect_rate_before REAL,
  ADD COLUMN IF NOT EXISTS defect_rate_after REAL;
```

**Update seed data** to populate these for completed/verified actions. Logic:
- For each verified corrective action, look up its investigation's run
- `defect_rate_before` = the defect rate of the run that triggered the investigation
- `defect_rate_after` = the average defect rate of the next 5 runs on the same furnace after the action was completed
- Only populate for actions with status = 'completed' or verified_at IS NOT NULL

Example seed update:
```python
# For each verified action, compute before/after rates
for action in verified_actions:
    investigation = get_investigation(action.investigation_id)
    run = get_run(investigation.run_number)
    defect_rate_before = run.defect_rate
    
    # Get next 5 runs on same furnace after action completion
    next_runs = get_runs_after(run.furnace, action.completed_at, limit=5)
    defect_rate_after = avg([r.defect_rate for r in next_runs]) if next_runs else None
    
    update_action(action.action_id, defect_rate_before, defect_rate_after)
```

### Backend Changes

**Modify the existing `/api/investigations/{id}/similar` endpoint:**

Add a `recommendations` field to the response. After finding similar cases, aggregate their corrective actions:

```python
# Group actions from similar cases by action_type
action_groups = {}
for case in similar_cases:
    for action in case.actions:
        key = action.action_type  # or use title keyword clustering
        if key not in action_groups:
            action_groups[key] = {
                "action_type": key,
                "total_count": 0,
                "verified_effective": 0,
                "verified_ineffective": 0,
                "avg_rate_before": [],
                "avg_rate_after": [],
                "example_titles": [],
            }
        group = action_groups[key]
        group["total_count"] += 1
        group["example_titles"].append(action.title)
        
        if action.verified_at:
            if action.defect_rate_after and action.defect_rate_before:
                if action.defect_rate_after < action.defect_rate_before:
                    group["verified_effective"] += 1
                else:
                    group["verified_ineffective"] += 1
                group["avg_rate_before"].append(action.defect_rate_before)
                group["avg_rate_after"].append(action.defect_rate_after)

# Compute effectiveness metrics
recommendations = []
for key, group in action_groups.items():
    success_rate = group["verified_effective"] / max(group["total_count"], 1)
    avg_improvement = None
    if group["avg_rate_before"] and group["avg_rate_after"]:
        avg_before = sum(group["avg_rate_before"]) / len(group["avg_rate_before"])
        avg_after = sum(group["avg_rate_after"]) / len(group["avg_rate_after"])
        avg_improvement = round((1 - avg_after / avg_before) * 100, 1) if avg_before > 0 else None
    
    recommendations.append({
        "action_type": key,
        "total_count": group["total_count"],
        "verified_effective": group["verified_effective"],
        "verified_ineffective": group["verified_ineffective"],
        "success_rate": round(success_rate, 2),
        "avg_improvement_pct": avg_improvement,
        "example_titles": list(set(group["example_titles"]))[:3],
        "is_recommended": success_rate >= 0.6 and group["verified_effective"] >= 2,
        "is_ineffective": group["verified_ineffective"] > group["verified_effective"],
    })

# Sort: recommended first, then by success_rate descending
recommendations.sort(key=lambda r: (-r["is_recommended"], -r["success_rate"]))
```

**Updated response shape:**
```json
{
  "similar_cases": [...],  // existing
  "recommendations": [
    {
      "action_type": "containment",
      "total_count": 5,
      "verified_effective": 4,
      "verified_ineffective": 1,
      "success_rate": 0.80,
      "avg_improvement_pct": 35.2,
      "example_titles": ["Review raw material specifications", "Isolate affected lot"],
      "is_recommended": true,
      "is_ineffective": false
    },
    {
      "action_type": "preventive",
      "total_count": 3,
      "verified_effective": 0,
      "verified_ineffective": 2,
      "success_rate": 0.0,
      "avg_improvement_pct": null,
      "example_titles": ["Adjust firing profile"],
      "is_recommended": false,
      "is_ineffective": true
    }
  ]
}
```

### Frontend Changes

**Modify the Similar Cases section in `frontend/src/pages/Investigations.tsx`:**

Above the existing individual case list, add a "Recommended Actions" section:

```
┌─────────────────────────────────────────────────────┐
│ ✨ AI-Suggested  Recommended Actions                │
│                                                     │
│ ┌─ RECOMMENDED ──────────────────────────────────┐ │
│ │ Containment — effective in 4 of 5 cases        │ │
│ │ Avg 35% defect rate reduction                  │ │
│ │ Examples: "Review raw material specs",          │ │
│ │           "Isolate affected lot"                │ │
│ │ ████████████████████░░░░░ 80% success          │ │
│ └────────────────────────────────────────────────┘ │
│                                                     │
│ ┌─ NOT EFFECTIVE ────────────────────────────────┐ │
│ │ Preventive — tried 3 times, no improvement     │ │
│ │ "Adjust firing profile" — 0% success rate      │ │
│ └────────────────────────────────────────────────┘ │
│                                                     │
│ Based on 8 similar past investigations              │
│                                                     │
│ ── Similar Cases ──────────────────────────────── │
│ (existing case list below)                          │
└─────────────────────────────────────────────────────┘
```

**Visual treatment for recommendations:**
- Recommended actions: green left border accent (`border-l-4 border-l-emerald-500`), success rate as a progress bar
- Ineffective actions: red left border accent (`border-l-4 border-l-red-500`), crossed-out or dimmed
- Neutral actions (insufficient data): gray treatment
- Same amber gradient border on the outer container as other AI features
- Disclaimer: "Recommendations based on historical corrective action outcomes. Verify applicability with process engineering."

---

## Implementation Order

1. **Feature 1 (Settings)** — creates the `app_settings` table that Feature 2-4 don't depend on, but establishes the settings pattern
2. **Feature 4 (Prescriptive Actions)** — requires the ALTER TABLE on corrective_actions and seed update; do this before Feature 3 since the knowledge search will benefit from richer corrective action data
3. **Feature 3 (Knowledge Search)** — requires the search_vector columns and GIN indexes; independent of other features
4. **Feature 2 (Multi-Run Trending)** — frontend-only, no backend changes, can be done in parallel with any other feature

## Testing

**Backend tests to add:**
- Settings CRUD (get, update, reset)
- Knowledge search (matching queries, empty results, bad input handling)
- Similar investigations with recommendations (verify aggregation logic)
- Multi-run trend data (verify furnace filtering works with limit)

**Frontend tests to add:**
- Settings panel: renders inputs with default values, save triggers API call
- Knowledge search: renders results, highlights match text, keyboard shortcut opens modal
- Multi-run trend: chart renders with run data, clicking dots selects runs
- Prescriptive actions: recommended actions render above case list, success rate bar displays correctly

## Files Changed Summary

| File | Changes |
|------|---------|
| `backend/seed.py` | Add app_settings table creation + seeding, add search_vector columns + GIN indexes, populate defect_rate_before/after on corrective_actions |
| `backend/routers/settings.py` | New file — GET/PATCH/POST endpoints for settings |
| `backend/routers/anomaly.py` | Replace hardcoded 1.5 z-threshold with DB lookup |
| `backend/routers/investigation.py` | Add `/knowledge/search` endpoint, enhance `/similar` with recommendations |
| `backend/main.py` | Register settings router |
| `frontend/src/lib/api.ts` | Add settings and knowledge search API methods |
| `frontend/src/types.ts` | Add SettingsResponse, KnowledgeSearchResponse, Recommendation interfaces |
| `frontend/src/components/KnowledgeSearch.tsx` | New file — global search modal |
| `frontend/src/components/SettingsPanel.tsx` | New file — slide-out settings panel |
| `frontend/src/pages/RunComparison.tsx` | Add Furnace Trend mode toggle + chart |
| `frontend/src/pages/Investigations.tsx` | Add Recommended Actions section above similar cases |
| `frontend/src/components/Sidebar.tsx` | Add gear icon for settings, search icon for ⌘K |
| `frontend/src/App.tsx` | Add ⌘K keyboard handler, search modal state |
