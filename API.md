# LayersControl API Documentation

## Table of Contents
- [Overview](#overview)
- [Installation & Setup](#installation--setup)
- [Constructor](#constructor)
- [Static Methods](#static-methods)
- [Instance Methods](#instance-methods)
  - [Map Integration](#map-integration)
  - [Base Map Management](#base-map-management)
  - [Overlay Management](#overlay-management)
  - [Group Management](#group-management)
  - [Dynamic Management](#dynamic-management)
  - [State Management](#state-management)
  - [Utility Methods](#utility-methods)
- [Events](#events)
- [Configuration Options](#configuration-options)
- [Data Structures](#data-structures)
  - [Base Style Definition](#base-style-definition)
  - [Overlay Definition](#overlay-definition)
  - [Group Definition](#group-definition)
- [Examples](#examples)
  - [Basic Setup](#basic-setup)
  - [Advanced Configuration](#advanced-configuration)
  - [Dynamic Overlay with Error Handling](#dynamic-overlay-with-error-handling)
- [Error Handling](#error-handling)
- [Validation](#validation)
- [Best Practices](#best-practices)

---

## Overview

The LayersControl is a layer management system for MapLibre GL JS that provides an interface to manage base maps, overlays, and overlay groups. Features include:

- Base map switching
- Overlay visibility toggles
- Grouped overlays
- State persistence (localStorage)
- Dynamic loading via `renderOnClick`
- Opacity controls
- Event system
- i18n support

---

## Installation & Setup

Include the LayersControl bundle in your HTML or load it as a module.

```html
<script src="path/to/layers-control.js"></script>
<link rel="stylesheet" href="path/to/main.css">
```

Or instantiate directly in JavaScript:

```javascript
const layersControl = new LayersControl(options);
```

---

## Constructor

new LayersControl(options)

Creates a new LayersControl instance.

Parameters:
- `options` (Object): configuration options (see Configuration Options)

Returns:
- `LayersControl` instance

Example:

```javascript
const layersControl = new LayersControl({
  baseStyles: [...],
  overlays: [...],
  defaultBaseId: 'osm-liberty',
  persist: { localStorageKey: 'my-layers' }
});
```

---

## Static Methods

### LayersControl.getInitialStyle(options)

Determines the initial map style based on provided config and persisted state.

Parameters:
- `options` (Object) — subset of constructor options (e.g. baseStyles, defaultBaseId, persist)

Returns:
- `String | Object | null` — map style URL or style object, or `null` if none found

Example:

```javascript
const initialStyle = LayersControl.getInitialStyle({
  baseStyles: [{ id: 'osm', style: 'https://example.com/osm.json', strategy: 'setStyle' }],
  defaultBaseId: 'osm',
  persist: { localStorageKey: 'my-layers' }
});
```

### LayersControl.getInitialViewport(options)

Reads persisted viewport from localStorage and returns it if present.

Parameters:
- `options` (Object) — may include `persist.localStorageKey`

Returns:
- `{ center, zoom, bearing, pitch } | null`

---

## Instance Methods

### Map Integration

#### addTo(map)
Adds the control to a MapLibre map instance.

Parameters:
- `map` (maplibregl.Map)

Returns:
- `LayersControl` (for chaining)

Example:

```javascript
layersControl.addTo(map);
```

#### onAdd(map)
MapLibre control interface. Returns the DOM element for the control.

#### onRemove()
MapLibre control interface. Called by the map when removing control.

#### remove()
Removes the control and cleans up resources.

---

### Base Map Management

#### setBase(baseId)
Change the active base map.

Parameters:
- `baseId` (String)

Emits:
- `basechange`
- `change`

Example:

```javascript
layersControl.setBase('satellite');
```

#### getCurrentStyle()
Returns the current style (URL or object) if the active base uses `setStyle`.

---

### Overlay Management

#### toggleOverlay(overlayId, visible = null, isUserInteraction = false)
Toggle or set an overlay's visibility.

Parameters:
- `overlayId` (String)
- `visible` (Boolean|null) — if null, toggles
- `isUserInteraction` (Boolean) — influences panOnAdd behavior

Returns:
- `Promise<void>` — resolves when the operation finishes (renders or hides overlay)

Emits:
- `overlaychange`, `loading`, `error`, `change`

Examples:

```javascript
await layersControl.toggleOverlay('traffic-flow');
await layersControl.toggleOverlay('weather-radar', true, true);
await layersControl.toggleOverlay('poi-restaurants', false);
```

#### setOverlayOpacity(overlayId, opacity)
Set overlay opacity (0.0 — 1.0).

Parameters:
- `overlayId` (String)
- `opacity` (Number)

Emits:
- `overlaychange`, `change`

---

### Group Management

#### toggleOverlayGroup(groupId, visible = null, isUserInteraction = false)
Toggle or set visibility for all overlays in a group.

Returns:
- `Promise<void>`

Emits:
- `overlaygroupchange`, `overlaychange` (for each overlay), `change`

#### setGroupOpacity(groupId, opacity)
Set opacity for all overlays in a group.

Emits:
- `overlaygroupchange`, `overlaychange`, `change`

---

### Dynamic Management

#### addOverlay(overlay)
Dynamically add a new overlay definition.

Parameters:
- `overlay` (Object)

Behavior:
- Initializes overlay state
- Rebuilds UI (`ui.destroy()` and `ui.build()`)
- Shows overlay if `overlay.defaultVisible === true`

Example:

```javascript
layersControl.addOverlay({
  id: 'new-layer',
  label: 'New Data Layer',
  source: { id: 'new-source', type: 'geojson', options: { data: geojsonData } },
  layers: [{ id: 'new-layer-circles', type: 'circle', paint: { 'circle-color': '#ff0000' } }],
  defaultVisible: true,
  opacityControls: true
});
```

#### removeOverlay(overlayId)
Remove overlay and clean its state.

---

### State Management

#### getState()
Returns the current state object:

```json
{
  "baseId": "current-base-id",
  "overlays": {
    "overlay-id": { "visible": true, "opacity": 0.8 }
  },
  "groups": {
    "group-id": { "visible": true, "opacity": 1.0 }
  }
}
```

#### setState(newState)
Apply a new state (partial updates supported). Triggers appropriate events and persistence.

Example:

```javascript
layersControl.setState({
  baseId: 'satellite',
  overlays: { 'traffic-flow': { visible: true, opacity: 0.6 } }
});
```

---

### Utility Methods

#### repositionOverlays()
Reposition visible overlays to maintain proper z-order.

#### getOverlayBeforeId()
Returns a layer ID (typically a label layer) to insert overlays before.

---

## Events

LayersControl extends EventEmitter. Key events:

- `basechange` — { baseId, previousBaseId }
- `overlaychange` — { id, visible, opacity, previousVisible, previousOpacity }
- `overlaygroupchange` — { groupId, visible, opacity, overlays[] }
- `change` — full state object
- `loading` — { id }
- `success` — { id }
- `error` — { id, error }
- `styleload` — (no payload)
- `sourceloaded` — sourceId (string)
- `viewportchange` — { viewport, previousViewport }

Example:

```javascript
layersControl.on('overlaychange', (data) => {
  console.log('Overlay changed', data);
});
```

---

## Configuration Options

Top-level options (defaults):

```js
{
  baseStyles: [],
  overlays: [],
  groups: [],
  defaultBaseId: null,
  persist: { localStorageKey: 'ml-layers' },
  i18n: (key) => key,
  onChange: null,
  autoClose: true,
  showOpacity: true,
  showLegends: true,
  position: 'top-right',
  icon: '⚏'
}
```

Persistence options:
- `persist.localStorageKey` (string) — key to store state in localStorage

See `docs/CONFIGURATION.md` for full schema and examples.

---

## Data Structures

### Base Style Definition

```js
{
  id: 'unique-id',
  label: 'Display Name',
  style: 'style-url-or-obj',
  strategy: 'setStyle' // or 'toggleBackground'
}
```

### Overlay Definition

Overlay can be provided as static source+layers, existing `layerIds`, or `renderOnClick`.

Supported fields:

- `id` (string) — required
- `label` (string) — required
- `source` (object) — optional — { id, type, options }
- `layers` (Array) — optional MapLibre layer definitions
- `layerIds` (Array<string>) — use existing map layers
- `renderOnClick` (async function) — dynamic loader
- `deckLayers` (Array) — deck.gl layer defs (when using deck integration)
- `group` (string)
- `defaultVisible` (boolean)
- `defaultOpacity` (number)
- `opacityControls` (boolean)
- `panOnAdd` (boolean)
- `panZoom` (number)
- `anchor` (object) — { beforeId?: string }

Example layer def snippet:

```js
{
  id: 'traffic',
  label: 'Traffic Flow',
  source: { id: 'traffic-source', type: 'vector', options: { url: 'mapbox://...' } },
  layers: [{ id: 'traffic-lines', type: 'line', 'source-layer': 'traffic', paint: { 'line-color': '#f00' } }],
  opacityControls: true
}
```

### Group Definition

```js
{
  id: 'group-id',
  label: 'Group Name',
  type: 'checkbox' // optional
}
```

---

## Examples

### Basic Setup

```javascript
const layersControl = new LayersControl({
  baseStyles: [
    { id: 'osm', label: 'OpenStreetMap', style: 'https://demotiles.maplibre.org/style.json', strategy: 'setStyle' }
  ],
  overlays: [
    {
      id: 'traffic',
      label: 'Traffic Flow',
      source: { id: 'traffic-source', type: 'vector', options: { url: 'mapbox://mapbox.mapbox-traffic-v1' } },
      layers: [{ id: 'traffic-lines', type: 'line', 'source-layer': 'traffic', paint: { 'line-color': '#ff0000', 'line-width': 2 } }],
      opacityControls: true
    }
  ]
});

map.on('load', () => {
  layersControl.addTo(map);
});
```

### Advanced Configuration

```javascript
const layersControl = new LayersControl({
  baseStyles: [/* base styles */],
  overlays: [/* overlays */],
  defaultBaseId: 'satellite',
  persist: { localStorageKey: 'my-app-layers' },
  i18n: (key) => ({ 'Base Maps': 'Mapas Base', 'Overlays': 'Camadas' }[key] || key),
  onChange: (state) => { console.log('Layers changed:', state); },
  autoClose: false,
  showOpacity: true,
  position: 'top-left'
});
```

### Dynamic Overlay with Error Handling

```javascript
const dynamicOverlay = {
  id: 'weather-data',
  label: 'Live Weather',
  renderOnClick: async () => {
    try {
      const response = await fetch('/api/weather-data');
      const geojson = await response.json();
      return {
        source: { id: 'weather-source', type: 'geojson', options: { data: geojson } },
        layers: [{ id: 'weather-points', type: 'circle', paint: { 'circle-color': ['get', 'temperature_color'], 'circle-radius': 8 } }]
      };
    } catch (error) {
      throw new Error(`Failed to load weather data: ${error.message}`);
    }
  },
  opacityControls: true,
  panOnAdd: true
};

layersControl.addOverlay(dynamicOverlay);
```

---

## Error Handling

Common error scenarios:
- Invalid overlay IDs
- Source loading failures (network/invalid URLs)
- `renderOnClick` failures (network, logic errors)
- Layer addition failures (invalid layer config)

Example handler:

```javascript
layersControl.on('error', (data) => {
  console.error(`Error with layer ${data.id}:`, data.error);
  showNotification(`Failed to load ${data.id}: ${data.error}`);
  if (data.error && data.error.includes('network')) {
    setTimeout(() => layersControl.toggleOverlay(data.id, true, true), 5000);
  }
});
```

---

## Validation

Validate overlays before adding:

```javascript
function validateOverlay(overlay) {
  if (!overlay.id || !overlay.label) throw new Error('Overlay must have id and label');
  if (!overlay.source && !overlay.layerIds && !overlay.renderOnClick) {
    throw new Error('Overlay must have source, layerIds, or renderOnClick');
  }
  return true;
}

try {
  validateOverlay(newOverlay);
  layersControl.addOverlay(newOverlay);
} catch (error) {
  console.error('Invalid overlay:', error.message);
}
```

---

## Best Practices

Performance
- Use `renderOnClick` for heavy overlays.
- Limit concurrent overlay loading.
- Use vector tiles for large datasets.
- Cache dynamic data where appropriate.

User experience
- Show loading indicators for async overlays.
- Provide retry options on errors.
- Use clear labels and group related overlays.

State management
- Persist user preferences with `persist.localStorageKey`.
- Validate persisted state during restore.
- Plan migrations for persisted keys/format changes.

Code organization
- Group related overlays into arrays and spread into `overlays` to keep config modular.
- Use factory functions for repetitive overlay definitions.

---

This API documentation provides the necessary references and examples to use LayersControl in MapLibre GL JS applications.
