# renderOnClick — Dynamic overlay contract

Some overlays are heavy or dynamic and should only load when the user requests them. The `renderOnClick` option provides a standard async contract for those overlays. This document describes the contract, available helpers, caching, and error-handling behavior.

## Purpose

- Defer loading of large datasets or expensive deck.gl layer construction until a user actually shows the overlay.
- Provide access to runtime context (map, state, overlay manager) so overlay code can request data based on the current viewport or other overlay states.
- Support both MapLibre layers (source + layers) and deck.gl layers (`deckLayers`) when the project uses deck.gl integration.

## Signature

An overlay `renderOnClick` must be an async function:

```js
async function renderOnClick(context) {
  // return either { deckLayers } or { source, layers }
}
```

## Context object

When invoked, `renderOnClick` receives a `context` object with these properties:

- map — MapLibre map instance
- overlayManager — OverlayManager instance
- stateStore — StateStore instance (read-only access to states)
- overlayId — string id of the overlay being loaded
- overlay — the overlay configuration object from `options.overlays`
- isUserInteraction — boolean (true if user triggered the action)
- deckOverlay — deck.MapboxOverlay instance (if deck is initialized)
- getCurrentViewport() — helper returning { center: [lng, lat], zoom, bearing, pitch }
- getOverlayState(id) — helper returning overlay state from stateStore (or undefined)
- getAllOverlayStates() — helper returning all overlay states object

Use these helpers instead of directly reading map state in order to remain compatible with persistence and ordering strategies.

## Expected return values

1. deck.gl integration:
   - Return an object with `deckLayers` — an array of deck layer definitions matching the shape expected by `deck` (each must include a stable `id`).
   - Example:
     ```js
     return {
       deckLayers: [
         {
           id: 'weather-points',
           type: 'ScatterplotLayer',
           props: {
             data: geojson.features.map(f => ({ position: f.geometry.coordinates, ...f.properties })),
             getPosition: d => d.position,
             getRadius: d => 1000,
             getFillColor: d => [255, 0, 0, 180]
           }
         }
       ]
     };
     ```

2. MapLibre layers:
   - Return `{ source, layers }` where `source` is a MapLibre source definition and `layers` is an array of MapLibre layer definitions:
     ```js
     return {
       source: { id: 'weather-source', type: 'geojson', options: { data: geojson } },
       layers: [
         { id: 'weather-points', type: 'circle', paint: { 'circle-color': '#007cba' } }
       ]
     };
     ```

The OverlayManager enforces that `renderOnClick` returns the expected shape and will throw / emit an error if missing `deckLayers` when deck is expected.

## Caching behavior

- The result of a successful `renderOnClick` call is cached in `OverlayManager.renderOnClickCache` keyed by overlay id.
- While a `renderOnClick` call is in progress, the overlay id is added to `renderOnClickLoading` to prevent duplicate concurrent calls.
- If `renderOnClick` fails, the overlay id is added to `renderOnClickErrors`.
- The control UI surface shows loading and error states via `.overlay-status`. Clicking the error status triggers a retry (emits `retryoverlay` UI event).

## Error handling

- Errors thrown inside `renderOnClick` are caught by the OverlayManager:
  - `renderOnClickLoading` entry is cleared
  - `renderOnClickErrors` gets the overlay id
  - An `error` event is emitted with `{ id, error }`
  - The overlay is not shown (the show() call returns `false`)
- Retry:
  - The UI displays an error icon (⚠) and clicking it will emit a `retryoverlay` event handled by the LayersControl which removes the cached error state and retries showing the overlay.

## Loading indicators and events

- When `renderOnClick` starts, the manager emits `loading` with `{ id }`.
- On success, the manager emits `success` with `{ id }`.
- On failure, the manager emits `error` with `{ id, error }`.

Use `layersControl.on('loading', ...)` / `on('success', ...)` / `on('error', ...)` to show application-level UI or analytics.

## Best practices

- Keep `renderOnClick` idempotent and pure: subsequent calls should yield equivalent `deckLayers` or `source/layers` for the same overlay configuration to make caching meaningful.
- Provide stable `id` values for deck layers; the control uses layer ids to manage cloning, opacity updates and ordering.
- Respect `context.getCurrentViewport()` when fetching viewport-dependent data.
- Throw descriptive errors from `renderOnClick` so consumers can show useful messages.
- Avoid adding DOM nodes or long-lived side effects inside `renderOnClick` — return layer/source objects only.

## Example (fetching GeoJSON then returning deck layers)

```js
const weatherOverlay = {
  id: 'weather-data',
  label: 'Live Weather',
  renderOnClick: async (context) => {
    const { map, overlayId, getCurrentViewport } = context;
    const vp = getCurrentViewport();
    const res = await fetch(`/api/weather?lng=${vp.center[0]}&lat=${vp.center[1]}&zoom=${Math.round(vp.zoom)}`);
    if (!res.ok) throw new Error('Network failure fetching weather data');
    const geojson = await res.json();

    return {
      deckLayers: [
        {
          id: `${overlayId}-points`,
          type: 'ScatterplotLayer',
          props: {
            data: geojson.features,
            getPosition: f => f.geometry.coordinates,
            getRadius: f => (f.properties.intensity || 1000),
            getFillColor: f => [255, 100, 0, 180],
            pickable: true
          }
        }
      ]
    };
  },
  opacityControls: true,
  panOnAdd: true,
  panZoom: 10
};
```

## Notes

- The OverlayManager will merge `deckLayers` returned from `renderOnClick` into the control's deck layer map and respect persisted opacities (StateStore.overlayStates[overlayId].opacity) by applying them when creating deck layers.
- If you need to clear cached results programmatically, call:
  ```js
  layersControl.overlayManager.renderOnClickCache.delete('overlay-id');
  layersControl.overlayManager.renderOnClickErrors.delete('overlay-id');
  ```
  then retry by calling `layersControl.toggleOverlay('overlay-id', true, true)`.
