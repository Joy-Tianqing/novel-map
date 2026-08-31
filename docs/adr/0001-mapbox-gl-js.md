# ADR 0001: Use Mapbox GL JS as the map engine

Date: 2026-08-19

## Status

Superseded by [ADR 0002](0002-maplibre-osm.md).

## Context

The project renders a personal literary map of Japan for *The Sound of the Mountain* (山の音). Requirements: smooth zoom/pan, click-to-flyTo interaction, custom markers, Japanese place-name labels, free-tier friendly.

Candidates considered:

- **MapLibre GL JS + free vector tiles (OpenFreeMap / MapTiler free tier)** — open source, no API key needed for OpenFreeMap, no vendor lock-in. Recommended default.
- **Mapbox GL JS** — best-in-class basemap quality and Japanese label rendering, but proprietary since v2, requires an access token and account.
- **Leaflet + OSM raster** — simplest, but raster zoom experience is weaker.
- **Google Maps JS API** — best Japanese data, but requires a credit card and usage-based billing.

The project is personal-use, low traffic (well under 50k map loads/month free tier), hosted as a static site on GitHub Pages from a private repo.

## Decision

Use Mapbox GL JS with a public access token (restricted by domain), on the free tier.

## Consequences

- Map interaction code binds to the Mapbox GL JS API; migrating to MapLibre later is possible (APIs are similar by lineage) but not free — map setup, style URLs, and any Mapbox-specific features need touching.
- Mapbox token must be present as `VITE_MAPBOX_TOKEN` at build time; the public token is exposed in the client by design (mitigated by URL restrictions in the Mapbox console).
- Mapbox Geocoding API is used for one-time batch coordinate lookup (consistent with the map vendor choice), executed locally by `scripts/` at data-build time, not at runtime.
- Under sustained free-tier pressure this choice would need revisiting; acceptable risk for a personal project.
