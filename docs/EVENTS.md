# Events — LayersControl

This document lists all events emitted by LayersControl and its subcomponents, strictly as implemented in `src/js/main.js`. All event names, triggers, and payloads are verified against the code. Deprecated or speculative features are omitted.

---

## Event Summary

| Event Name         | Emitter(s)         | Trigger / Method                        | Payload Shape / Notes                |
|--------------------|--------------------|-----------------------------------------|--------------------------------------|
| basechange         | StateStore         | setBase()                               | `{ baseId, previousBaseId }`         |
| overlaychange      | StateStore         | setOverlay()                            | `{ id, visible, opacity, previousVisible, previousOpacity }` |
| overlaygroupchange | StateStore         | setGroup()                              | `{ groupId, visible, opacity, overlays }` |
| change             | StateStore         | setBase(), setOverlay(), setGroup(), setViewport(), setState() | Full state object                    |
| loading            | OverlayManager     | show() (renderOnClick overlays)         | `{ id }`                             |
| success            | OverlayManager     | show() (renderOnClick/deckLayers added) | `{ id }`                             |
| error              | OverlayManager     | show(), _onError(), renderOnClick fail  | `{ id, error }`                      |
| styleload          | OverlayManager     | _onStyleLoad() (map style.load)         | `null`                               |
| sourceloaded       | OverlayManager     | _onSourceData() (map sourcedata)        | `sourceId` (string)                  |
| viewportchange     | StateStore         | setViewport()                           | `{ viewport, previousViewport }`     |
| zoomfilter         | OverlayManager     | _updateZoomFiltering(), updateAllZoomFiltering() | `{ id, filtered }`           |
| memorycleared      | StateStore         | clearMemory()                           | `{ localStorageKey }`                |

All events are re-emitted by the top-level `LayersControl` instance for unified subscription.

---

## Event Details

### basechange

- **Emitter:** StateStore
- **Trigger:** `setBase(baseId)`
- **Payload:**
  ```json
  { "baseId": "new-base-id", "previousBaseId": "old-base-id" }
  ```
- **Notes:** Emitted whenever the base map is changed, including programmatic and UI changes.

---

### overlaychange

- **Emitter:** StateStore
- **Trigger:** `setOverlay(overlayId, state)`
- **Payload:**
  ```json
  {
    "id": "overlay-id",
    "visible": true,
    "opacity": 0.8,
    "previousVisible": false,
    "previousOpacity": 1.0
  }
  ```
- **Notes:** Emitted on overlay visibility or opacity change. Layer order is updated if visibility changes.

---

### overlaygroupchange

- **Emitter:** StateStore
- **Trigger:** `setGroup(groupId, state)`
- **Payload:**
  ```json
  {
    "groupId": "group-id",
    "visible": true,
    "opacity": 0.9,
    "overlays": ["overlay1", "overlay2"]
  }
  ```
- **Notes:** Emitted when a group's visibility or opacity changes.

---

### change

- **Emitter:** StateStore
- **Trigger:** Any state change (`setBase`, `setOverlay`, `setGroup`, `setViewport`, `setState`)
- **Payload:** Full state object:
  ```json
  {
    "baseId": "current-base",
    "overlays": { "overlay-id": { "visible": true, "opacity": 1.0 } },
    "groups": { "group-id": { "visible": true, "opacity": 1.0 } },
    "layerOrder": ["overlay-a", "overlay-b"],
    "viewport": { "center": [lng, lat], "zoom": 5, "bearing": 0, "pitch": 0 }
  }
  ```
- **Notes:** Use for holistic state syncing or persistence.

---

### loading

- **Emitter:** OverlayManager
- **Trigger:** `show()` for overlays with `renderOnClick` (when loading starts)
- **Payload:**
  ```json
  { "id": "overlay-id" }
  ```
- **Notes:** Indicates async overlay loading in progress.

---

### success

- **Emitter:** OverlayManager
- **Trigger:** `show()` for overlays with `renderOnClick` (on success), or after deckLayers added
- **Payload:**
  ```json
  { "id": "overlay-id" }
  ```
- **Notes:** Overlay loaded and visible.

---

### error

- **Emitter:** OverlayManager
- **Trigger:** `show()` (renderOnClick fail), `_onError()` (map error event)
- **Payload:**
  ```json
  { "id": "overlay-id", "error": "Error message" }
  ```
- **Notes:** Overlay failed to load or map source error. UI may offer retry.

---

### styleload

- **Emitter:** OverlayManager
- **Trigger:** `_onStyleLoad()` (map fires `style.load`)
- **Payload:** `null`
- **Notes:** Used to reapply overlays after style changes.

---

### sourceloaded

- **Emitter:** OverlayManager
- **Trigger:** `_onSourceData()` (map fires `sourcedata` and isSourceLoaded)
- **Payload:** `sourceId` (string)
- **Notes:** Indicates a map source finished loading.

---

### viewportchange

- **Emitter:** StateStore
- **Trigger:** `setViewport(viewport)`
- **Payload:**
  ```json
  {
    "viewport": { "center": [lng, lat], "zoom": 5, "bearing": 0, "pitch": 0 },
    "previousViewport": { /* previous values */ }
  }
  ```
- **Notes:** Emitted when viewport state is persisted.

---

### zoomfilter

- **Emitter:** OverlayManager
- **Trigger:** `_updateZoomFiltering()`, `updateAllZoomFiltering()`
- **Payload:**
  ```json
  { "id": "overlay-id", "filtered": true }
  ```
- **Notes:** Emitted when an overlay is hidden/shown due to zoom constraints.

---

### memorycleared

- **Emitter:** StateStore
- **Trigger:** `clearMemory()`
- **Payload:**
  ```json
  { "localStorageKey": "ml-layers" }
  ```
- **Notes:** Emitted after clearing all persisted state from localStorage.

---

## Subscription Patterns

Subscribe to events on the `LayersControl` instance (which extends EventEmitter):

```js
layersControl.on('overlaychange', handler);
layersControl.off('overlaychange', handler);
```

- All events are re-emitted by LayersControl for unified listening.
- Use `change` for full state sync; use `loading`, `error`, `zoomfilter` for UI feedback.

---

## Notes

- Only events implemented in `src/js/main.js` are documented.
- Payloads and triggers are strictly code-accurate.
- Deprecated, internal, or speculative features are omitted.
