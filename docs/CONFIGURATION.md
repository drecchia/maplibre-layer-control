# Configuration — LayersControl

This document describes the complete options schema accepted by `new LayersControl(options)` and the persisted state format.

## Top-level options (defaults shown)

```js
{
  baseStyles: [],           // Array<BaseStyle>
  overlays: [],             // Array<Overlay>
  groups: [],               // Array<Group> (optional)
  defaultBaseId: null,      // string | null
  persist: {
    localStorageKey: 'ml-layers' // string | null
  },
  i18n: (key) => key,       // function for label translation
  onChange: null,           // callback(state) optional
  autoClose: true,          // boolean - close panel after selection
  showOpacity: true,        // boolean - show per-overlay/group opacity controls
  showLegends: true,        // boolean - reserved (future)
  position: 'top-right',    // MapLibre control position
  icon: '⚏'                // string | HTMLElement
}
```

## BaseStyle (baseStyles array)

Fields:
- id (string) — unique identifier
- label (string) — human-readable name
- style (string|object) — MapLibre style (URL or object)
- strategy (string) — `'setStyle'` or `'toggleBackground'`

Example:
```js
{
  id: 'osm',
  label: 'OpenStreetMap',
  style: 'https://demotiles.maplibre.org/style.json',
  strategy: 'setStyle'
}
```

Behavior:
- `getInitialStyle(options)` will consult `localStorage` (if enabled) and `defaultBaseId` to determine which base style to return.
- `setBase(baseId)` applies the chosen style using `map.setStyle()` when `strategy === 'setStyle'`, or toggles background layers when `strategy === 'toggleBackground'`.

## Overlay (overlays array)

Overlays are deck.gl-first in this version. Provide overlays as `deckLayers` (deck.gl layer definitions) or via `renderOnClick` that returns `deckLayers`. MapLibre-style `source`/`layers` and `layerIds` are deprecated and not supported by this implementation.

Supported fields:
- id (string) — required, unique
- label (string) — required
- source (object) — optional source definition:
  - id (string) — source id
  - type (string) — `'geojson' | 'vector' | 'raster' | 'image'`
  - options (object) — provider-specific options (e.g., { data } for geojson or { url } for vector)
- layers (Array<LayerDef>) — optional MapLibre layer definitions to add next to the source
- layerIds (string[]) — optional, list of existing layer IDs on the map (do not add/remove sources)
- renderOnClick (async function) — optional dynamic loader (see RENDER_ON_CLICK.md)
- deckLayers (Array<Object>) — optional deck.gl layer definitions when using deck integration
- group (string) — optional group id
- defaultVisible (boolean) — optional, default false
- defaultOpacity (number) — optional, default 1.0
- opacityControls (boolean) — show slider control in UI
- panOnAdd (boolean) — pan/fly to overlay when added (only used when isUserInteraction=true)
- panZoom (number) — zoom level to use when panning
- anchor: { beforeId?: string } — optional positioning hint for map.moveLayer

LayerDef (subset):
- id (string)
- type (string) — MapLibre layer type like `'line'|'circle'|'symbol'|'fill'`
- source (string) — source id or fallback to overlay.source.id
- 'source-layer' (string) — vector source layer name (optional)
- layout / paint / filter — MapLibre layer properties

Validation:
- Overlay must provide `deckLayers` or a `renderOnClick` implementation that returns `{ deckLayers }`. MapLibre `source`/`layers` and `layerIds` are deprecated and will not be accepted as overlay payloads by the current OverlayManager. The code performs runtime validation during state restore and when adding overlays; invalid shapes will be rejected or ignored.

## renderOnClick contract

- Signature: `async function(context) => { deckLayers }` OR `{ source, layers }`
- `context` object includes:
  - map: MapLibre map reference
  - overlayManager, stateStore, overlayId, overlay, isUserInteraction, deckOverlay
  - helper: `getCurrentViewport()` and `getOverlayState(id)` / `getAllOverlayStates()`
- Must return an object with `deckLayers` (array) when using deck integration, or `{ source, layers }` for MapLibre layers.
- Errors thrown from `renderOnClick` will be caught, emit an `error` event for the overlay, and prevent the overlay from being shown.

See RENDER_ON_CLICK.md for examples and caching behavior.

## Group (groups array)

Optional group definitions to render a group header in the UI.

Fields:
- id (string) — required
- label (string) — required
- type (string) — optional, e.g. `'checkbox'` (UI hint)

Group semantics:
- Group visibility toggles all overlays that have `overlay.group === group.id`
- Group opacity applies to all overlays in that group

## Persistence (persist.localStorageKey)

When `persist.localStorageKey` is set (string), state is saved to `localStorage` under that key.

Persisted state shape:
```json
{
  "baseId": "osm",
  "overlays": {
    "overlay-id": { "visible": true, "opacity": 0.8 }
  },
  "groups": {
    "group-id": { "visible": true, "opacity": 1.0 }
  },
  "layerOrder": ["overlay-a","overlay-b"],
  "viewport": {
    "center": [lng, lat],
    "zoom": 5,
    "bearing": 0,
    "pitch": 0
  }
}
```

Notes on restoration:
- The code validates persisted `baseId`, overlays and groups. If persisted entries no longer exist in the current config, they are skipped with a console.warn.
- `layerOrder` is filtered to remove unknown overlay IDs.
- `viewport` is restored only if persisted values exist; `LayersControl._applyInitialState` will `map.jumpTo()` with available viewport properties.
- State is persisted whenever `StateStore` mutates state (`_persistState()` called from setters).

## i18n

- `i18n` is a function that accepts a string key and returns a translated string. Default is identity `(k) => k`.
- Used primarily for UI section titles such as `'Base Maps'` and `'Overlays'`.

## Positioning & CSS hooks

- Control position uses MapLibre container classes, e.g. `.maplibregl-ctrl-top-right`.
- The control panel element uses class `.layers-control-panel`.
- See CSS.md for class list and examples of overriding styles.

## Examples

See `docs/QUICKSTART.md` for basic usage and `docs/API_REFERENCE.md` for method-level examples.

### Example overlay definition (GeoJSON source + layers)
```js
{
  id: 'poi-restaurants',
  label: 'Restaurants',
  group: 'Points of Interest',
  source: {
    id: 'poi-restaurants-src',
    type: 'geojson',
    options: { data: restaurantsGeojson }
  },
  layers: [
    {
      id: 'poi-restaurants-circles',
      type: 'circle',
      paint: { 'circle-color': '#ff6600', 'circle-radius': 6 }
    }
  ],
  opacityControls: true,
  defaultVisible: true,
  defaultOpacity: 0.9,
  panOnAdd: true,
  panZoom: 14
}
```

## Tips & gotchas

- If you use `deck.gl` layers (via `deck.MapboxOverlay`), overlays that provide `deckLayers` should include stable `id` values for each deck layer — the control uses these ids to manage opacity and ordering.
- The UI rebuild (in `addOverlay`/`removeOverlay`) calls `ui.destroy()` then `ui.build()`; any external references to DOM nodes created by the control will be invalidated after a dynamic change.
- When switching styles (`setStyle`), MapLibre removes custom layers/sources — the `OverlayManager` listens for `style.load` and clears internal caches, reapplying overlays via `_applyInitialState`.
