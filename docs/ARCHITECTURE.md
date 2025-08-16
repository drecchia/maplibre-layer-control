# Architecture — LayersControl (refactor)

Concise description of the internal architecture, responsibilities and lifecycle for the refactored LayersControl.

## High-level components

- EventEmitter
  - Lightweight pub/sub used across components for decoupling.

- StateStore
  - Source of truth for UI and overlay states.
  - Tracks: currentBaseId, overlayStates, groupStates, layerOrder, viewport.
  - Persists state to localStorage when configured; validates restored entries and skips missing items.

- OverlayManager
  - Sole component that interacts with the MapLibre map object.
  - Responsibilities:
    - Add/remove sources and MapLibre layers or deck.gl layers.
    - Manage deck.MapboxOverlay lifecycle and deck layer instances.
    - Track loading/error states for renderOnClick overlays.
    - Apply opacity (via cloning deck layers or updating MapLibre paint props).
    - Reposition layers to respect label layers (getOverlayBeforeId).
    - Emit events: loading, success, error, styleload, sourceloaded.

- UIBuilder
  - Creates and maintains DOM for the control button and panel.
  - Emits UI events (basechange, overlaychange, groupchange, opacitychange, retryoverlay).
  - Updates element state (checkboxes, radios, sliders, status icons) when StateStore or OverlayManager emits changes.

- LayersControl (facade)
  - Wires components together.
  - Exposes public API used by consumers.
  - Implements MapLibre control interface (onAdd / onRemove).
  - Applies persisted initial state and sets up viewport persistence listeners.

## Dataflow / lifecycle

1. Construction
   - LayersControl creates StateStore, OverlayManager, UIBuilder and calls _wireEvents().

2. Adding to map
   - addTo(map) / onAdd(map) attaches OverlayManager.map, initializes deck overlay (if deck available), builds UI (`ui.build()`), and calls _applyInitialState().

3. Applying initial state
   - StateStore restores persisted state (baseId, overlays, groups, layerOrder, viewport).
   - LayersControl applies viewport (jumpTo), base style, and overlays according to persisted `layerOrder` then remaining overlays.
   - UIBuilder elements updated to reflect restored states.

4. Runtime operations
   - UI actions → UIBuilder emits events → LayersControl calls OverlayManager / StateStore methods.
   - OverlayManager emits loading/success/error → UIBuilder updates status icons and LayersControl forwards events.
   - State changes are persisted by StateStore and broadcast as `change` events.

5. Teardown
   - onRemove/remove calls UIBuilder.destroy(), OverlayManager.removeMap(), and removes map listeners to avoid leaks.

## Ordering & positioning

- `layerOrder` is maintained in StateStore and used by OverlayManager._updateDeckLayers() to determine deck layer order.
- MapLibre layer insertion uses:
  - layerDef.beforeId || overlay.anchor?.beforeId || getOverlayBeforeId() — the latter tries to find a suitable label layer to insert before.
- When styles change, MapLibre removes layers/sources — OverlayManager handles `style.load` to clear caches and reapply overlays.

## Deck.gl integration notes

- OverlayManager creates a single `deck.MapboxOverlay` and manages a Map of deck layer instances keyed by deck layer id.
- When creating deck layer instances, persisted opacity (StateStore.overlayStates[overlayId].opacity) is applied.
- Opacity updates are performed by cloning deck layer instances with `.clone({ opacity })`.

## Error handling & resilience

- StateStore validates persisted state and logs warnings for removed IDs instead of failing.
- renderOnClick results are cached; concurrent requests are prevented; errors are surfaced via `error` events and UI retry affordance.
- UI rebuild on add/remove invalidates DOM references — external code should not depend on internal DOM nodes.

## Testability & maintenance benefits

- Single-responsibility classes make unit testing straightforward:
  - StateStore tests: persistence, validation, event emission.
  - OverlayManager tests: deck layer creation (mock deck), error/loading state transitions.
  - UIBuilder tests: DOM creation, event emission (can be run in DOM-like environment).
- Clear boundaries reduce coupling and minimize accidental side-effects during changes.
