# Architecture — LayersControl

This document describes the internal architecture and lifecycle of LayersControl, strictly based on the implementation in `src/js/main.js`. All information is derived from the actual source code; outdated or speculative features are omitted.

---

## 1. Component Overview

- **EventEmitter**: Lightweight event system. Base for all main classes, enabling event-driven updates and decoupling.
- **StateStore**: Central state manager for base style, overlays, groups, layer order, and viewport. Handles persistence (localStorage), state validation, and emits events on changes.
- **OverlayManager**: Manages all interactions with the MapLibre map and deck.gl overlays. Handles adding/removing overlays, deck.gl layer instances, zoom filtering, forced base/viewport, and emits loading/error/status events.
- **UIBuilder**: Creates and manages the DOM for the control button and panel. Emits UI events (basechange, overlaychange, groupchange, opacitychange, retryoverlay) and updates UI elements in response to state and overlay events.
- **LayersControl (facade)**: Wires all components together. Implements the MapLibre control interface (`onAdd`, `onRemove`). Exposes the public API, manages lifecycle, and coordinates state, overlays, and UI.

---

## 2. Responsibilities and Interactions

- **EventEmitter**: Provides event subscription, emission, and removal for all main classes.
- **StateStore**: Tracks all state, persists/restores from localStorage, validates IDs, and emits events for base, overlay, group, and viewport changes.
- **OverlayManager**: Receives state and options, manages overlays on the map, handles deck.gl integration, zoom filtering, forced base/viewport, and emits events for UI feedback.
- **UIBuilder**: Builds the UI, emits user interaction events, and updates UI elements in response to state and overlay events.
- **LayersControl**: Connects all components, wires events, applies initial state, and exposes the API.

---

## 3. Dataflow and Lifecycle

1. **Construction**: LayersControl creates StateStore, OverlayManager, UIBuilder, and wires events.
2. **Adding to Map**: `addTo(map)` or `onAdd(map)` attaches OverlayManager to the map, initializes deck.gl overlay, builds UI, and applies initial state.
3. **Applying Initial State**: StateStore restores persisted state (base, overlays, groups, layer order, viewport). LayersControl applies viewport, base style, overlays (in order), and updates UI.
4. **Runtime Operations**:
   - UI actions emit events → LayersControl calls OverlayManager/StateStore methods.
   - OverlayManager emits loading/success/error/zoomfilter events → UIBuilder updates status icons.
   - State changes are persisted and broadcast as `change` events.
5. **Teardown**: `onRemove`/`remove` destroys UI, detaches OverlayManager, and removes listeners.

---

## 4. Advanced Features

- **Deck.gl Integration**: OverlayManager creates a single `deck.MapboxOverlay` and manages deck.gl layer instances. Opacity is applied from persisted state when creating deck layers. Opacity updates are performed by cloning deck layer instances with `.clone({ opacity })`.
- **Overlay Ordering and Positioning**: `layerOrder` is maintained in StateStore and used by OverlayManager to determine deck.gl layer order. MapLibre layer insertion uses `layerDef.beforeId`, `overlay.anchor?.beforeId`, or `getOverlayBeforeId()` to position overlays relative to label layers. On style changes, OverlayManager clears caches and reapplies overlays.
- **Dynamic Overlays (renderOnClick)**: Overlays can defer loading until requested by the user. Results are cached, loading/error states are tracked, and UI provides retry/error feedback.
- **Zoom Filtering**: OverlayManager checks overlay `minZoomLevel`/`maxZoomLevel` on show/hide and on zoom events. Overlays outside zoom constraints are hidden and UI shows a zoom-filtered status.
- **State Persistence**: StateStore persists baseId, overlays, groups, layerOrder, and viewport to localStorage. Restoration validates IDs and skips unknown entries.

---

## 5. Testability and Maintenance

- Each class has a single responsibility, making unit testing straightforward:
  - StateStore: persistence, validation, event emission.
  - OverlayManager: deck layer creation, error/loading transitions.
  - UIBuilder: DOM creation, event emission.
- Clear boundaries reduce coupling and side-effects.
- All features and behaviors are directly mapped to the implementation in `src/js/main.js`.
