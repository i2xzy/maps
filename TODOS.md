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

### Interactive map with route visualization — IN PROGRESS (branch: feature/interactive-map)
**What:** Replace the map placeholder under `(dashboard)/map` with a real interactive map. Render features as markers/lines, render media geometries (point or LINESTRING) as a second layer, deep-link each media marker to the feature page.
**Why:** README "Planned." This is the headline feature the rest of the data model supports.
**Status (2026-06-08):** Being built per `/plan-eng-review` plan (`~/.gstack/projects/i2xzy-maps/isaacraskin-HEAD-map-plan-20260608-222444.md`). Stack: MapLibre via react-map-gl, OpenFreeMap basemap, GeoJSON from `features_geo`/`media_geo` SQL views (`.context/map-views.sql`). Helper + Vitest + MapView + page done and building green. Remaining: run the SQL views in the Supabase dashboard, regen `database.ts`, then visual QA.
**Open caveat:** the map page reads via the cookie-based server client, which forces dynamic rendering and makes `revalidate` (daily caching, decision D9) a no-op. To make caching real, read the two public views via a cookieless anon client.
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

### Custom feature-type marker icons on the map (GL sprites)
**What:** Replace the map's status-colored circle markers with the real `FeatureIcon` set (tunnel, viaduct, station, etc.) by registering each as a MapLibre GL sprite image (`map.addImage`) and using a `symbol` layer with `icon-image` keyed off the feature `type`.
**Why:** Visual parity with the rest of the site (every other page shows type icons) and faster at-a-glance reading of the map.
**Cons / why deferred (decision D4):** GL sprites need raster/SDF images, but `FeatureIcon` is React/react-icons (SVG components). Converting each to a PNG/SDF, building a sprite sheet, and wiring `addImage` is disproportionate effort for v1, which ships colored clustered circles instead.
**How to start:** Reuse the `featureTypes` config; render each icon to PNG (or generate an SDF sprite sheet) at build time; `map.addImage(type, img)`; swap the `feature-points-unclustered` circle layer for a symbol layer with `icon-image: ['get','type']`. Keep circles as the cluster representation.
**Depends on:** The interactive map (feature/interactive-map) shipping first.

### Upgrade Chakra UI for React 19 / Next 16 (durable fix for Children.only crashes)
**What:** We're on `@chakra-ui/react` 3.19.1; latest is 3.35.0. Chakra's `Children.only`-based components (`AspectRatio`, the `asChild` Slot, `LinkOverlay asChild`) throw `React.Children.only expected to receive a single React element child` during SSR when a **server component** passes a **client-component child** (Chakra `Image`, `next/link`) across the RSC boundary under React 19.
**Why:** This 500'd `/media`, `/creators`, and feature/creator detail pages after the Next 16 upgrade. Already patched at the call sites (MediaGallery uses a `Box` + CSS `aspectRatio`; creators list uses `LinkOverlay href` instead of `asChild`+`next/link`), but the underlying fragility remains — any new `asChild`/`AspectRatio` in a server component can reintroduce it. A Chakra upgrade with React 19 support is the durable fix.
**How:** Bump Chakra, run the full app through QA (it's 16 minor versions — watch for component API/visual breaks). If the upgrade resolves the RSC `Children.only` issue, the call-site workarounds can optionally be reverted.
**Context:** Not urgent now that call sites are patched, but it's the root cause. Do it in its own focused pass with QA, not bundled with feature work.

### Drop the next-themes no-flash script workaround when a React 19 fix lands
**What:** `next-themes` 0.4.6 triggers a React 19 dev warning ("Encountered a script tag while rendering React component") from its theme-init `<script>` in `ColorModeProvider`.
**Why:** Benign — dev-console only, theme works, no flash, no production impact. You're already on the latest next-themes, so there's nothing to bump yet.
**Context:** Revisit when next-themes ships a React 19-compatible release that stops rendering the raw script on the client.

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
