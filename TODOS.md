# TODOS

Deferred work captured during planning sessions. Items below are explicitly NOT in scope for the current PR but worth doing later. See `~/.gstack/projects/i2xzy-maps/ceo-plans/` for the strategic context behind each item.

## Data model decision (2026-05-11)

Decided AGAINST a schema migration to dedupe media. The `media` table is already at marker/chapter grain (one row per Google My Maps pin, each with its own location, recorded_date, and feature links), which is exactly what the map and feature pages need. The only problem — one video appearing as N rows in the news feed and video page — is handled by `GROUP BY youtube_id` at the query layer. No `media_chapters` table, no destructive dedup. The creator page already does this grouping.

## High priority — natural follow-ups

### Upload remaining Google My Maps layers
**What:** Only the 2018-2023 layer is in Supabase (plus a couple of 2025 videos added directly in the dashboard, no CSV). Upload the 2024, 2025, and 2026 layers.
**Why:** Videos and feature chronology are incomplete until all layers load. Example: the Colne Valley Viaduct montage (x3GN7owJOnQ) has a 2024 chapter still sitting in the un-uploaded layer, so the video page only shows 3 of its chapters. Query-grouping means new pins slot in automatically — no migration, no re-processing.
**How:** Same CSV import path as the 2018-2023 layer. Each pin must keep its `youtube_id` and its `?t=Xs` timestamp in the URL so chapter grouping and deep-linking work. Spot-check grouping after the first new layer upload.
**Depends on:** Nothing — additive data load.

### Photo timeline per structure
**What:** On each structure detail page, show all photos/videos that include this structure in chronological order. Allow scrubbing through construction history.
**Why:** Already in README's "Planned Features." The per-marker `recorded_date` and feature links already exist in `media`; this is the rendering of that data, ordered chronologically.
**Depends on:** Nothing structural — query `media` joined to `media_features` by feature, ordered by `recorded_date`.

### Interactive map with route visualization
**What:** Replace the map placeholder under `(dashboard)/map` with a real interactive map. Render features as markers/lines, render media geometries (point or LINESTRING) as a second layer, deep-link each media marker to the feature page.
**Why:** README "Planned." This is the headline feature the rest of the data model supports.
**Depends on:** `media.location` confirmed flexible (POINT + LINESTRING). Markers come straight from `media` rows — no migration needed.

### Timeline view of construction progress
**What:** UI for scrubbing through time — see structure statuses at any given month from 2017 to projected completion.
**Why:** README "Planned." The status enum + recorded_date columns already exist; this is the rendering layer.
**Depends on:** No hard blocker; can be built alongside.

## Medium priority — feature ideas with real demand

### Media series / playlist concept
**What:** New `media_series` table for recurring drone flyovers from the same creator over the same route. Each `media` row gets an optional `series_id`.
**Why:** Surfaced in office-hours conversation. Real concept — drone creators repeat the same flyover every few months, and grouping them as a series creates a temporal narrative for that route segment.
**Depends on:** News feed / video page grouping by youtube_id in place.
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

### Review mis-linked chapter/marker titles (data quality)
**What:** Some `media` rows have a `title` that names a different place than the feature they link to via `media_features` — e.g. a "Washwood Heath" marker linked to the Bromford Tunnel feature, "Delta Junction" linked to Birmingham Spur Diveunder. Review and re-link, or add the missing features.
**Why:** Map markers and feature-page deep-links should point at the structure they're actually about. Either the true subject isn't a tracked feature yet, or the Google My Maps import linked the pin to a nearby/wrong feature.
**How to find them:** Join `media` to `media_features` to `features` and flag rows where the feature name does not appear in the media title:
```sql
SELECT m.youtube_id, m.title, f.name AS linked_feature
FROM media m
JOIN media_features mf ON mf.media_id = m.id
JOIN features f ON f.id = mf.feature_id
WHERE m.title IS NOT NULL
  AND position(lower(f.name) in lower(m.title)) = 0
ORDER BY m.youtube_id;
```
**Context:** Pure data cleanup, no schema change. Known examples: CBZm7HVngig, mnha774yMU8 (Washwood Heath → Bromford Tunnel); yRzyZNMrmBY (Delta Junction → Birmingham Spur Diveunder).

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
