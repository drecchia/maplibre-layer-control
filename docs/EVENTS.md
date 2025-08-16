# Events — LayersControl

Comprehensive list of events emitted by LayersControl and subcomponents, with payload shapes and usage examples.

## Event list

- `basechange`
  - Emitted when the active base map changes.
  - Payload:
    ```json
    { "baseId": "new-base-id", "previousBaseId": "old-base-id" }
    ```
  - Example:
    ```javascript
    layersControl.on('basechange', (data) => {
      console.log('Base changed', data.baseId, 'from', data.previousBaseId);
    });
    ```

- `overlaychange`
  - Emitted when an overlay's visibility or opacity changes.
  - Payload:
    ```json
    {
      "id": "overlay-id",
      "visible": true,
      "opacity": 0.8,
      "previousVisible": false,
      "previousOpacity": 1.0
    }
    ```
  - Example:
    ```javascript
    layersControl.on('overlaychange', (d) => {
      // update external UI
    });
    ```

- `overlaygroupchange`
  - Emitted when a group's visibility or opacity changes.
  - Payload:
    ```json
    {
      "groupId": "group-id",
      "visible": true,
      "opacity": 0.9,
      "overlays": ["overlay1","overlay2"]
    }
    ```
  - Example:
    ```javascript
    layersControl.on('overlaygroupchange', console.log);
    ```

- `change`
  - Emitted after any state change; contains the full current state.
  - Payload (shape):
    ```json
    {
      "baseId": "current-base",
      "overlays": { "overlay-id": { "visible": true, "opacity": 1.0 } },
      "groups": { "group-id": { "visible": true, "opacity": 1.0 } },
      "layerOrder": ["overlay-a","overlay-b"],
      "viewport": { "center": [lng, lat], "zoom": 5, "bearing": 0, "pitch": 0 }
    }
    ```
  - Example:
    ```javascript
    layersControl.on('change', (state) => {
      // persist to server, analytics, etc.
    });
    ```

- `loading`
  - Emitted when an overlay starts loading (commonly for `renderOnClick`).
  - Payload:
    ```json
    { "id": "overlay-id" }
    ```

- `success`
  - Emitted when an overlay successfully loaded (renderOnClick or deck layers added).
  - Payload:
    ```json
    { "id": "overlay-id" }
    ```

- `error`
  - Emitted when an overlay fails to load or other recoverable errors occur.
  - Payload:
    ```json
    { "id": "overlay-id", "error": "Error message" }
    ```
  - Example: retry logic can call `layersControl.toggleOverlay(id, true, true)`.

- `styleload`
  - Emitted by OverlayManager when the map fires `style.load` (useful to reapply overlays).
  - Payload: `null`

- `sourceloaded`
  - Emitted when a map source finishes loading (from MapLibre `sourcedata` events).
  - Payload: `sourceId` (string)

- `viewportchange`
  - Emitted when viewport persistence is updated.
  - Payload:
    ```json
    {
      "viewport": { "center": [lng, lat], "zoom": 5, "bearing": 0, "pitch": 0 },
      "previousViewport": { /* previous values */ }
    }
    ```

## Subscription patterns

- Subscribe directly on `layersControl` (it extends EventEmitter):
  ```javascript
  layersControl.on('overlaychange', handler);
  layersControl.off('overlaychange', handler);
  ```

- Use `change` for holistic state syncing; use `loading`/`error` for UX feedback.

## Notes

- Events are emitted from different components but are re-emitted by the top-level `LayersControl` facade so listeners can attach to a single object.
- Event payloads are produced from StateStore and OverlayManager; fields are validated by the code (see CONFIGURATION.md and src/js/main.js).
