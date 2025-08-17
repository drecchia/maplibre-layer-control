# API Reference — LayersControl

This document describes the public API, configuration options, and events for LayersControl. All information is based on the actual implementation in `src/js/main.js`. Deprecated, internal, or unsupported features are omitted.

---

## Classes

### EventEmitter (public)
- `on(event, handler): this`  
  Subscribe to an event.
- `off(event, handler): this`  
  Unsubscribe from an event.
- `emit(event, data): void`  
  Emit an event with optional data.

---

### StateStore (internal, relevant for persistence/events)
- `constructor(options)`
- `getState(): Object`
- `setState(newState: Object): void`
- `setBase(baseId: string): void`
- `setOverlay(overlayId: string, state: { visible?: boolean, opacity?: number }): void`
- `setGroup(groupId: string, state: { visible?: boolean, opacity?: number }): void`
- `setViewport(viewport: { center?: [number,number], zoom?: number, bearing?: number, pitch?: number }): void`
- `getLayerOrder(): string[]`
- `clearMemory(): boolean`

---

### OverlayManager (internal, manages overlays and events)
- `constructor(options, stateStore)`
- `setMap(map: maplibregl.Map): void`
- `removeMap(): void`
- `show(overlayId: string, isUserInteraction?: boolean): Promise<boolean>`
- `hide(overlayId: string): void`
- `applyOpacity(overlayId: string, opacity: number): void`
- `setBase(baseId: string): void`
- `reposition(): void`
- `getOverlayBeforeId(): string | undefined`
- `updateAllZoomFiltering(): void`
- `removeAllOverlays(): void`

---

### LayersControl (public facade)
- `constructor(options?: Object)`
- `addTo(map: maplibregl.Map): this`
- `onAdd(map: maplibregl.Map): HTMLElement`
- `onRemove(): void`
- `remove(): void`
- `destroy(): void`
- `setBase(baseId: string): void`
- `toggleOverlay(overlayId: string, visible: boolean|null = null, isUserInteraction: boolean = false): Promise<void>`
- `hideOverlay(overlayId: string): Promise<void>`
- `showOverlay(overlayId: string, isUserInteraction: boolean = false): Promise<void>`
- `setOverlayOpacity(overlayId: string, opacity: number): void`
- `repositionOverlays(): void`
- `getOverlayBeforeId(): string | undefined`
- `toggleOverlayGroup(groupId: string, visible: boolean|null = null, isUserInteraction: boolean = false): Promise<void>`
- `setGroupOpacity(groupId: string, opacity: number): void`
- `addOverlay(overlay: Object): void`
- `removeOverlay(overlayId: string): void`
- `removeAllOverlays(): void`
- `getState(): Object`
- `setState(newState: Object): void`
- **Static methods:**
  - `getInitialStyle(options?: Object): String|Object|null`
  - `getInitialViewport(options?: Object): { center, zoom, bearing, pitch } | null`

---

## LayersControl Options

See [CONFIGURATION.md](./CONFIGURATION.md) for a full schema and examples.

---

## Overlay Configuration Attributes

Documented attributes are supported in code:

- **id**: string (required) — Unique overlay identifier
- **label**: string (required) — Display name in UI
- **group**: string (optional) — Overlay group
- **defaultVisible**: boolean (optional)
- **defaultOpacity**: number (optional, default 1.0)
- **opacityControls**: boolean (optional)
- **renderOnClick**: async function (optional) — See [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md)
- **deckLayers**: array (optional) — deck.gl layer definitions
- **panOnAdd**: boolean (optional)
- **panZoom**: number (optional)
- **anchor**: { beforeId?: string } (optional)
- **minZoomLevel**: number (optional)
- **maxZoomLevel**: number (optional)
- **forcedBaseLayerId**: string (optional)
- **forcedBearing**: number (optional)
- **forcedPitch**: number (optional)
- **tooltip**: string | object (optional)
- **getTooltip**: function (optional)

Deprecated MapLibre `source`/`layers`/`layerIds` are not supported.

---

## Events

Events are emitted by LayersControl and subcomponents. Payloads match the implementation in `src/js/main.js`.

- **basechange**: `{ baseId, previousBaseId }`
- **overlaychange**: `{ id, visible, opacity, previousVisible, previousOpacity }`
- **overlaygroupchange**: `{ groupId, visible, opacity, overlays }`
- **change**: Full state object
- **loading**: `{ id }`
- **success**: `{ id }`
- **error**: `{ id, error }`
- **styleload**: `null`
- **sourceloaded**: `sourceId`
- **viewportchange**: `{ viewport, previousViewport }`
- **zoomfilter**: `{ id, filtered }`
- **memorycleared**: `{ localStorageKey }`

---

## Examples

See [QUICKSTART.md](./QUICKSTART.md) and [CONFIGURATION.md](./CONFIGURATION.md) for usage and configuration examples.

---

## Notes

- Only public APIs and supported options are documented.
- Deprecated or internal features are omitted.
- OverlayManager and StateStore are internal but relevant for advanced usage and event handling.
- For dynamic overlays, see [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md).
