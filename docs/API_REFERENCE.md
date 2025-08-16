# API Reference — LayersControl

This document is a precise reference for the public API, static helpers and emitted events.

## Classes

- EventEmitter
  - on(event: string, handler: Function): this
  - off(event: string, handler: Function): this
  - emit(event: string, data?: any): void

- StateStore
  - constructor(options: Object)
  - getState(): Object
  - setState(newState: Object): void
  - setBase(baseId: string): void
  - setOverlay(overlayId: string, state: { visible?: boolean, opacity?: number }): void
  - setGroup(groupId: string, state: { visible?: boolean, opacity?: number }): void
  - setViewport(viewport: { center?: [number,number], zoom?: number, bearing?: number, pitch?: number }): void
  - getLayerOrder(): string[]

- OverlayManager
  - constructor(options: Object, stateStore?: StateStore)
  - setMap(map: maplibregl.Map): void
  - removeMap(): void
  - show(overlayId: string, isUserInteraction?: boolean): Promise<boolean>
  - hide(overlayId: string): void
  - applyOpacity(overlayId: string, opacity: number): void
  - applyDeckOpacity(overlayId: string, opacity: number): void
  - setBase(baseId: string): void
  - reposition(): void
  - getOverlayBeforeId(): string | undefined

- UIBuilder
  - constructor(options: Object, stateStore?: StateStore)
  - build(): HTMLElement
  - destroy(): void
  - updateBaseRadios(currentId: string): void
  - updateOverlayCheckbox(id: string, visible: boolean): void
  - updateOverlayStatus(id: string, status: 'loading'|'error'|'success'): void
  - updateGroupCheckbox(groupId: string, visible: boolean): void
  - createOpacitySlider(id: string, initialValue: number): HTMLElement
  - updateOpacitySlider(id: string, opacity: number): void

- LayersControl (public facade)
  - constructor(options?: Object)
    - Options are documented in CONFIGURATION.md
  - Static helpers:
    - getInitialStyle(options?: Object): String|Object|null
    - getInitialViewport(options?: Object): { center, zoom, bearing, pitch } | null
  - MapLibre integration:
    - addTo(map: maplibregl.Map): this
    - onAdd(map: maplibregl.Map): HTMLElement
    - onRemove(): void
    - remove(): void
    - getDefaultPosition(): string
  - Layer management:
    - setBase(baseId: string): void
    - toggleOverlay(overlayId: string, visible: boolean|null = null, isUserInteraction: boolean = false): Promise<void>
    - setOverlayOpacity(overlayId: string, opacity: number): void
    - toggleOverlayGroup(groupId: string, visible: boolean|null = null, isUserInteraction: boolean = false): Promise<void>
    - setGroupOpacity(groupId: string, opacity: number): void
    - addOverlay(overlay: Object): void
    - removeOverlay(overlayId: string): void
    - repositionOverlays(): void
    - getOverlayBeforeId(): string | undefined
    - getState(): Object
    - setState(newState: Object): void

## Event list (emitted by LayersControl / components)

- 'basechange'
  - payload: { baseId: string, previousBaseId: string }
- 'overlaychange'
  - payload: { id: string, visible: boolean, opacity: number, previousVisible?: boolean, previousOpacity?: number }
- 'overlaygroupchange'
  - payload: { groupId: string, visible: boolean, opacity: number, overlays: string[] }
- 'change'
  - payload: Full state object:
    {
      baseId: string,
      overlays: { [overlayId]: { visible: boolean, opacity: number } },
      groups: { [groupId]: { visible: boolean, opacity: number } },
      layerOrder?: string[],
      viewport?: { center?: [number,number], zoom?: number, bearing?: number, pitch?: number }
    }
- 'loading'
  - payload: { id: string }
- 'success'
  - payload: { id: string }
- 'error'
  - payload: { id: string, error?: string }
- 'styleload'
  - payload: none
- 'sourceloaded'
  - payload: sourceId (string)
- 'viewportchange'
  - payload: { viewport: { center, zoom, bearing, pitch }, previousViewport: { … } }

## Notes & behavior details

- toggleOverlay returns a Promise and will abort visibility toggling when a renderOnClick overlay fails to load.
- Overlay opacity changes are persisted via StateStore (see persistence).
- addOverlay will initialize UI and show overlay if overlay.defaultVisible is true.
- getInitialStyle/getInitialViewport read localStorage at the configured persist.localStorageKey and return restored values when present and valid.

## Examples

- See docs/QUICKSTART.md and docs/CONFIGURATION.md for sample configuration objects and usage snippets.
