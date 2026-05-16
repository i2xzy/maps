# TODOS

Deferred work captured during planning sessions. Items below are explicitly NOT in scope for the current PR but worth doing later. See `~/.gstack/projects/i2xzy-maps/ceo-plans/` for the strategic context behind each item.

## High priority — natural follow-ups to the chapter migration

### Photo timeline per structure
**What:** On each structure detail page, show all photos/videos that include this structure in chronological order. Allow scrubbing through construction history.
**Why:** Already in README's "Planned Features." The chapter timestamp migration unlocks per-feature media chronology; this is the rendering of that unlocked data.
**Depends on:** Chapter migration complete.

### Interactive map with route visualization
**What:** Replace the map placeholder under `(dashboard)/map` with a real interactive map. Render features as markers/lines, render media geometries (point or LINESTRING) as a second layer, deep-link each media marker to the feature page.
**Why:** README "Planned." This is the headline feature the rest of the data model supports.
**Depends on:** Chapter migration complete; `media.location` confirmed flexible (POINT + LINESTRING).

### Timeline view of construction progress
**What:** UI for scrubbing through time — see structure statuses at any given month from 2017 to projected completion.
**Why:** README "Planned." The status enum + recorded_date columns already exist; this is the rendering layer.
**Depends on:** No hard blocker; can be built alongside.

## Medium priority — feature ideas with real demand

### Media series / playlist concept
**What:** New `media_series` table for recurring drone flyovers from the same creator over the same route. Each `media` row gets an optional `series_id`.
**Why:** Surfaced in office-hours conversation. Real concept — drone creators repeat the same flyover every few months, and grouping them as a series creates a temporal narrative for that route segment.
**Depends on:** Chapter migration complete.
**Context:** Park until current scope ships; revisit when adding 5+ recurring series.

### Planned vs actual comparison
**What:** Overlay HS2 Ltd's official plan timing/locations against actual construction progress.
**Why:** README "Planned." The differentiating feature for "reference of record" framing.
**Depends on:** Data source for HS2 Ltd plan dates — may require manual data entry.

### Admin dashboard for content management
**What:** Internal-only UI for adding new media, drawing LINESTRING geometries, linking media to features, setting chapter timestamps.
**Why:** README "Planned." Replaces the current Supabase Studio + manual SQL workflow.
**Depends on:** Auth setup (Supabase auth already exists via middleware/proxy).

## Low priority — defensive / quality

### `media_chapters` separate table
**What:** Move chapter timestamps from `media_features` into a dedicated `media_chapters` table with synthetic PK.
**Why:** The current first-write-wins approach in `media_features` loses data if a video chapters into the same feature at multiple distinct timestamps (camera circles back). If post-migration audit shows ≥3 cases, escalate.
**Depends on:** Pre-migration audit query D from the test plan.
**Context:** Conditional. Do not build unless data justifies it.

### Audit logging for content edits
**What:** Track who changed what when. Especially relevant once an admin dashboard exists.
**Why:** Defensive. Side project today, but if the site becomes a citation source for journalists, history matters.
**Depends on:** Admin dashboard.

## Strategic — deferred from CEO plan, not blocking

### Reframe toward "HS2 Time Machine"
**What:** Lean into the temporal + spatial scrubber as the headline product, not the wiki.
**Why:** Eureka from CEO review: every megaproject tracker is a wiki or news feed; nobody builds the temporal-spatial scrubber. HS2 has the data assembled, which is the hard part.
**Depends on:** Current scope (HS2 Wikipedia framing) shipped first. Revisit after photo timeline + interactive map + timeline view are live.

### Generalize to other megaprojects
**What:** Apply the same pattern to Crossrail-2, Lower Thames Crossing, Sizewell C, Stonehenge tunnel, etc. The monorepo already hints at this with `apps/london-cycle-routes`.
**Why:** Surfaced in CEO review as Framing C ("Megaproject Engine").
**Depends on:** HS2 being undeniable in its own right first. Premature platform trap if started too early.
