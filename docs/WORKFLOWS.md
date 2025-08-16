# Workflows — LayersControl

This document contains mermaid diagrams that describe key workflows and runtime flows used by the refactored LayersControl component.

## 1) Component lifecycle (construction → teardown)

```mermaid
flowchart TD
  A[Construct LayersControl(options)] --> B[Create StateStore, OverlayManager, UIBuilder]
  B --> C[_wireEvents() between components]
  C --> D[addTo(map) / onAdd(map)]
  D --> E[OverlayManager.setMap(map)]
  E --> F[_initializeDeckGL() → create deck.MapboxOverlay (if deck available)]
  F --> G[UIBuilder.build() → create control button + panel]
  G --> H[_applyInitialState() → restore base, overlays, viewport]
  H --> I[_setupViewportPersistence() → listen to move/zoom/rotate events]
  I --> J[Runtime: user interactions & programmatic calls]
  J --> K[Teardown: onRemove/remove() → ui.destroy(), overlayManager.removeMap(), remove listeners]
```

## 2) renderOnClick (dynamic overlay loading) — success & failure paths

```mermaid
flowchart TD
  U[User toggles overlay (UI)] --> V[UIBuilder emits 'overlaychange']
  V --> W[LayersControl.toggleOverlay(overlayId, ...)]
  W --> X{Overlay.renderOnClick?}
  X -- No --> Y[OverlayManager.show uses overlay.deckLayers or map layers] --> Z[Add layers / update deck layers] --> DONE1[Emit success & state changes]
  X -- Yes --> A1{renderOnClickCache.has(overlayId)?}
  A1 -- yes --> B1[Use cached deckLayers] --> Z
  A1 -- no --> C1[OverlayManager.emit('loading') & mark loading] --> D1[Call overlay.renderOnClick(context) async]
  D1 --> E1{renderOnClick resolves?}
  E1 -- success --> F1[Validate result (deckLayers or source/layers)] --> G1[Cache result & add layers to deckOverlay/map] --> H1[OverlayManager.emit('success')] --> I1[StateStore.setOverlay(visible,true) & persist] --> DONE1
  E1 -- failure --> J1[OverlayManager.emit('error') & mark error] --> K1[UI shows error icon with retry] --> DONE2[show() returns false]
```

## 3) State persistence & initial restore

```mermaid
flowchart TD
  S1[App start / LayersControl constructed] --> S2[StateStore._loadPersistedState()]
  S2 --> S3{localStorage present?}
  S3 -- no --> S4[Use defaultBaseId or first baseStyle]
  S3 -- yes --> S5[Parse persisted JSON]
  S5 --> S6[Validate baseId, overlay IDs, group IDs]
  S6 --> S7[Filter invalid overlay IDs from layerOrder]
  S7 --> S8[Restore viewport (center/zoom/bearing/pitch) if present]
  S8 --> S9[LayersControl._applyInitialState()]
  S9 --> S10[Set base via OverlayManager.setBase()]
  S9 --> S11[Apply overlays in persisted layerOrder then remaining overlays]
  S11 --> S12[UIBuilder.updateOverlayCheckbox/slider & OverlayManager.show() calls]
```

## 4) Dynamic add/remove overlay (runtime update)

```mermaid
flowchart TD
  M1[Call layersControl.addOverlay(overlay)] --> M2{overlay.id exists?}
  M2 -- yes --> M3[Warn & noop]
  M2 -- no --> M4[Push overlay into options.overlays]
  M4 --> M5[StateStore.init overlay state (visible/defaultOpacity)]
  M5 --> M6[If group -> init group state if needed]
  M6 --> M7[ui.destroy(); ui.build() (rebuild DOM)]
  M7 --> M8{overlay.defaultVisible?}
  M8 -- yes --> M9[overlayManager.show(overlay.id) && stateStore.setOverlay(visible:true)]
  M8 -- no --> M10[Done]
  M9 --> M10[Persist state]
```

## 5) Viewport persistence debounce behavior

```mermaid
flowchart TD
  V0[Map movement events: moveend/zoomend/rotateend/pitchend] --> V1[debouncedSave() called]
  V1 --> V2[clearTimeout -> setTimeout 500ms]
  V2 --> V3[After 500ms of no movement -> stateStore.setViewport({center,zoom,bearing,pitch})]
  V3 --> V4[stateStore._persistState() -> localStorage.setItem(key, JSON.stringify(state))]
```

---

Notes
- Diagrams use the same terminology and components exposed in the code: LayersControl (facade), StateStore, OverlayManager, UIBuilder.
- The renderOnClick flow emphasizes caching, concurrent call prevention, success/failure event emission and retry affordance via the UI.
- The persistence flow highlights validation steps that avoid restoring stale/unknown overlay or group IDs.

You can preview these diagrams in VS Code with Mermaid preview extensions or on platforms that render mermaid blocks.
