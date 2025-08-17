# Workflows — LayersControl

This document describes the main runtime workflows of LayersControl, based strictly on the real implementation. All diagrams and explanations are verified against the code in `src/js/main.js`.

---

## 1. Component Lifecycle

**Construction → Teardown**

- `new LayersControl(options)` creates StateStore, OverlayManager, UIBuilder.
- `_wireEvents()` connects all components.
- `addTo(map)` or `onAdd(map)` attaches OverlayManager to the map, initializes deck.gl overlay, builds UI, and applies initial state.
- `_applyInitialState()` restores persisted base, overlays, and viewport.
- `_setupViewportPersistence()` listens to map move/zoom/rotate events and persists viewport.
- Runtime: user interactions and programmatic API calls update state and UI.
- Teardown: `onRemove()`/`remove()` destroys UI, detaches OverlayManager, and removes listeners.

---

## 2. Overlay Activation: deckLayers and renderOnClick

- Overlays must use `deckLayers` or `renderOnClick`. MapLibre `source`/`layers` are not supported.
- When toggling an overlay:
  - If `renderOnClick` is present and not cached, OverlayManager calls it, caches the result, and emits loading/success/error events.
  - If cached, uses cached deckLayers.
  - If no `renderOnClick`, uses static `deckLayers`.
  - OverlayManager adds/removes deck.gl layers as needed, respecting persisted opacity and layer order.
  - UI updates status indicators for loading, error, zoom filtering, etc.

---

## 3. State Persistence & Restore

- StateStore persists:
  - `baseId`
  - overlays (visibility, opacity)
  - groups (visibility, opacity)
  - `layerOrder`
  - `viewport`
- On startup, StateStore restores persisted state, validates IDs, and skips unknown overlays/groups.
- `_applyInitialState()` applies base, overlays (in order), group states, and viewport.
- Viewport is restored if present.

---

## 4. Dynamic Add/Remove Overlay

- `addOverlay(overlay)`:
  - Adds overlay to options and initializes state.
  - If grouped, initializes group state if needed.
  - Rebuilds UI.
  - If `defaultVisible`, shows overlay and persists state.
- `removeOverlay(overlayId)`:
  - Hides overlay if visible, removes from options/state/UI, and persists state.
- `removeAllOverlays()`:
  - Hides and removes all overlays, clears UI and state, and persists.

---

## 5. Viewport Persistence (Debounce)

- On map movement events (`moveend`, `zoomend`, `rotateend`, `pitchend`), debounced save triggers after 500ms of inactivity.
- StateStore updates and persists viewport (`center`, `zoom`, `bearing`, `pitch`).

---

## 6. Zoom Filtering

- OverlayManager checks overlay `minZoomLevel`/`maxZoomLevel` on show/hide and on zoom events.
- Overlays outside zoom constraints are hidden and UI shows a zoom-filtered status.

---

## 7. Event Flow

- All state changes emit events (`basechange`, `overlaychange`, `overlaygroupchange`, `change`, `loading`, `success`, `error`, `viewportchange`, `zoomfilter`, `memorycleared`).
- UIBuilder listens for events to update UI.
- Consumers can subscribe to events on the LayersControl instance.

---

## Notes

- All workflows are based on the actual code in `src/js/main.js`.
- Only supported overlay types (`deckLayers`, `renderOnClick`) are documented.
- For API and configuration, see [API_REFERENCE.md](./API_REFERENCE.md) and [CONFIGURATION.md](./CONFIGURATION.md).
- For dynamic overlays, see [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md).
- For CSS/UI, see [CSS.md](./CSS.md).
