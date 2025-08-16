# LayersControl — MapLibre Layer Manager

Compact, modern, and extensible layer control for MapLibre GL JS. Designed for production apps that need:
- fast, testable code (single-responsibility internals),
- flexible UX (grouping, opacity, pan-on-add),
- dynamic data loading (remote layer loader via renderOnClick),
- optional deck.gl integration for high-performance rendering.

[![npm version](https://img.shields.io/badge/npm-v1.0.0-blue)](#) [![license](https://img.shields.io/badge/license-MIT-lightgrey)](#)

Why this control?
- Drop-in replacement for older monolithic layer controls with the same public API and far better maintainability.
- Keeps map logic and UI separate — safer to extend and test.
- Built-in persistence so users return to the map exactly as they left it.

Hero GIFs
- UI interaction (toggle layers, change opacity)
  ![demo-ui](docs/gif-ui-placeholder.gif)

- Dynamic remote loader (renderOnClick): loading → success → cached
  ![demo-dynamic](docs/gif-dynamic-placeholder.gif)

Top features (short)
- Base map switching (setStyle or toggle background strategy)
- Overlay grouping and group-level opacity
- Per-overlay opacity sliders and status indicators (loading / error / retry)
- panOnAdd: optionally fly to a relevant location when a user enables a layer
- renderOnClick: async remote layer loader for deferred datasets (cached + retry)
- State persistence: base, overlays, opacity, layer order, viewport
- Events and hooks for analytics, telemetry, or custom UI integrations
- Works with MapLibre; optionally integrates with deck.gl (deck.MapboxOverlay)

Quickstart (minimal)
```javascript
// javascript
const baseStyles = [
  { id: 'osm', label: 'OpenStreetMap', style: 'https://demotiles.maplibre.org/style.json', strategy: 'setStyle' }
];

const overlays = [
  {
    id: 'poi-restaurants',
    label: 'Restaurants',
    group: 'POI',
    source: { id: 'poi-src', type: 'geojson', options: { data: restaurantsGeojson } },
    layers: [{ id: 'poi-restaurants-circles', type: 'circle', paint: { 'circle-color': '#ff6600', 'circle-radius': 6 } }],
    opacityControls: true,
    defaultVisible: false,
    panOnAdd: true,
    panZoom: 14
  }
];

const layersControl = new LayersControl({
  baseStyles,
  overlays,
  persist: { localStorageKey: 'my-app-layers' },
  position: 'top-right'
});

const map = new maplibregl.Map({
  container: 'map',
  style: LayersControl.getInitialStyle({ baseStyles, persist: { localStorageKey: 'my-app-layers' } }) || baseStyles[0].style,
  center: [-0.1276, 51.5074],
  zoom: 10
});

map.on('load', () => layersControl.addTo(map));
```

RenderOnClick — remote layer loader
- Use `renderOnClick(context)` to lazily fetch data or construct deck.gl layers only when the user requests the overlay.
- The control provides a useful context object (map, overlayManager, stateStore, helpers like getCurrentViewport()).
- Successful results are cached, concurrent calls are prevented, and failures emit `error` with UI retry affordance.

Example (renderOnClick snippet)
```javascript
// javascript
const weatherOverlay = {
  id: 'live-weather',
  label: 'Live Weather',
  renderOnClick: async (ctx) => {
    const vp = ctx.getCurrentViewport();
    const res = await fetch(`/api/weather?lng=${vp.center[0]}&lat=${vp.center[1]}&z=${Math.round(vp.zoom)}`);
    if (!res.ok) throw new Error('Failed to fetch weather');
    const geojson = await res.json();
    return {
      source: { id: 'weather-src', type: 'geojson', options: { data: geojson } },
      layers: [{ id: 'weather-points', type: 'circle', paint: { 'circle-color': '#007cba' } }]
    };
  },
  opacityControls: true,
  panOnAdd: true
};
```

panOnAdd (UX)
- When `panOnAdd: true` is set on an overlay, user-initiated toggles optionally fly the map to a representative location (overlay.panZoom can tune zoom).
- Useful for datasets that are local to a city or require focus after enabling.

Grouping & group opacity
- Assign overlays to groups via `overlay.group`.
- Groups render as a group header in the UI. Toggling a group toggles each member overlay and, if enabled, applies a single opacity slider for the whole group.

Persistence & layer order
- State persisted to `persist.localStorageKey` contains:
  { baseId, overlays, groups, layerOrder, viewport }
- `layerOrder` is respected on restore so overlays (especially deck layers) retain intended z-order.

Docs & reference
- docs/QUICKSTART.md — quick examples
- docs/API_REFERENCE.md — detailed public API & method signatures
- docs/CONFIGURATION.md — complete options schema and persisted state shape
- docs/RENDER_ON_CLICK.md — remote loader contract, caching, error handling
- docs/EVENTS.md — emitted events and payloads
- docs/CSS.md — class names and styling hooks
- docs/WORKFLOWS.md — mermaid workflow diagrams
- docs/MIGRATION.md — migration guidance from older implementations
- docs/ARCHITECTURE.md — design and component responsibilities

Get started
- Try the Quickstart and plug LayersControl into your MapLibre app.
- Replace older controls with the same public methods — modernized internals make future changes safe.

Contribute
- PRs and issues welcome. Prefer small, focused changes and keep single-responsibility boundaries intact.

License
- MIT (or see repository LICENSE)
