# renderOnClick — Dynamic Overlay Contract

This document describes the real contract for dynamic overlays using `renderOnClick`, strictly as implemented in `src/js/main.js`.

---

## Purpose

- Defer loading of heavy or dynamic overlays until requested by the user.
- Provide runtime context (map, state, overlay manager) for overlays to fetch data or build deck.gl layers on demand.
- Only deck.gl overlays (`deckLayers`) are supported. MapLibre `source`/`layers` are NOT supported.

---

## Signature

`renderOnClick` must be an async function:

```js
async function renderOnClick(context) {
  // Must return: { deckLayers }
}
```

---

## Context Object

The context passed to `renderOnClick` includes:

- `map`: MapLibre map instance
- `overlayManager`: OverlayManager instance
- `stateStore`: StateStore instance (read-only)
- `overlayId`: string id of the overlay
- `overlay`: overlay config object
- `isUserInteraction`: boolean (true if user triggered)
- `deckOverlay`: deck.MapboxOverlay instance (if available)
- `getCurrentViewport()`: returns `{ center, zoom, bearing, pitch }`
- `getOverlayState(id)`: returns overlay state
- `getAllOverlayStates()`: returns all overlay states

---

## Expected Return Value

- Must return an object: `{ deckLayers }`
  - `deckLayers`: array of deck.gl layer definitions (each must have a stable `id`)
- MapLibre `source`/`layers` return is NOT supported.

**Example:**
```js
return {
  deckLayers: [
    {
      id: 'weather-points',
      type: 'ScatterplotLayer',
      props: {
        data: geojson.features,
        getPosition: f => f.geometry.coordinates,
        getRadius: f => 1000,
        getFillColor: f => [255, 0, 0, 180]
      }
    }
  ]
};
```

---

## Caching & Loading

- Results are cached in `OverlayManager.renderOnClickCache` by overlay id.
- While loading, overlay id is in `renderOnClickLoading` to prevent duplicates.
- On error, overlay id is added to `renderOnClickErrors`.
- UI shows loading/error status via `.overlay-status`. Clicking error triggers a retry (`retryoverlay` event).

---

## Error Handling

- Errors thrown in `renderOnClick` are caught:
  - Loading state is cleared.
  - Error state is set.
  - `error` event is emitted.
  - Overlay is not shown.
- Retry: UI error icon triggers a retry, clearing error state and calling `renderOnClick` again.

---

## Events

- `loading`: emitted when `renderOnClick` starts.
- `success`: emitted on success.
- `error`: emitted on failure.
- Listen via `layersControl.on('loading', ...)`, etc.

---

## Best Practices

- Keep `renderOnClick` idempotent and pure.
- Use stable `id` for deck layers.
- Use `getCurrentViewport()` for viewport-dependent data.
- Throw descriptive errors for UI feedback.
- Do not add DOM nodes or side effects; only return layer objects.

---

## Example

```js
const weatherOverlay = {
  id: 'weather-data',
  label: 'Live Weather',
  renderOnClick: async (context) => {
    const { getCurrentViewport } = context;
    const vp = getCurrentViewport();
    const res = await fetch(`/api/weather?lng=${vp.center[0]}&lat=${vp.center[1]}&zoom=${Math.round(vp.zoom)}`);
    if (!res.ok) throw new Error('Network failure fetching weather data');
    const geojson = await res.json();

    return {
      deckLayers: [
        {
          id: 'weather-points',
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

---

## Notes

- Opacity is applied from persisted state when creating deck layers.
- To clear cache programmatically:
  ```js
  layersControl.overlayManager.renderOnClickCache.delete('overlay-id');
  layersControl.overlayManager.renderOnClickErrors.delete('overlay-id');
  layersControl.toggleOverlay('overlay-id', true, true);
  ```
- Only `{ deckLayers }` return is supported.
