# ADR 0002: Switch to MapLibre GL JS with OpenStreetMap raster tiles

Date: 2026-08-31

## Status

Accepted. Supersedes [ADR 0001](0001-mapbox-gl-js.md).

## Context

ADR 0001 chose Mapbox GL JS with a domain-restricted public token. During initial setup the token requirement proved to be friction for a personal, low-traffic project: account registration, payment info, and token management add setup steps with no functional benefit here, and the token is by design exposed in the client.

MapLibre GL JS is the open-source fork of Mapbox GL JS v1 with a nearly identical API, so the migration cost is minimal.

Candidates for the basemap:

- **OpenStreetMap raster tiles** — zero config, no key, fine for a handful of markers. Chosen.
- **OpenFreeMap / MapTiler free vector tiles** — nicer labels (including Japanese), still keyless; a drop-in upgrade if raster OSM feels bland later.

## Decision

Use MapLibre GL JS (npm `maplibre-gl`) with OpenStreetMap raster tiles defined as an inline `StyleSpecification`. No access token, no `.env` variable.

## Consequences

- No registration, no token leakage risk, no billing exposure.
- Basemap is raster OSM: Japanese place-name labels render fine, but styling is fixed. If richer labels are wanted later, switch the `style` to OpenFreeMap/MapTiler — a one-line change.
- MapLibre requires no runtime change elsewhere; Marker/Popup/fitBounds APIs are the same by lineage.
- Coordinate lookup was done via Nominatim (OSM) at data-build time, which is consistent with the OSM basemap choice (previously the plan was Mapbox Geocoding API).
- Mapbox-specific ADR 0001's `VITE_MAPBOX_TOKEN` build-time requirement is removed; `.env.example` was deleted.
- Note: the Meituan internal npm mirror lagged behind for `maplibre-gl` 6.x dependencies (`@mapbox/vector-tile@3`); install from the official registry if the mirror errors with `notarget`.
