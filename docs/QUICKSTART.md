# Quickstart — LayersControl (MapLibre)

Minimal, copy-paste example to get LayersControl running with MapLibre GL JS and deck.gl, reflecting the actual implementation.

---

## 1. Install / Include

- Include MapLibre GL JS and deck.gl in your page.
- Include the built LayersControl script (UMD/ES build).
- Include the CSS file for correct UI.

**Example (HTML):**
```html
<script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/deck.gl/dist.min.js"></script>
<script src="path/to/layers-control.js"></script>
<link rel="stylesheet" href="path/to/main.css">
```

---

## 2. Minimal Initialization

```javascript
const baseStyles = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    style: 'https://demotiles.maplibre.org/style.json',
    strategy: 'setStyle'
  }
];

// Overlays must use deckLayers or renderOnClick. MapLibre source/layers are NOT supported.
const overlays = [
  {
    id: 'traffic',
    label: 'Traffic Flow',
    deckLayers: [
      {
        id: 'traffic-lines',
        type: 'LineLayer', // deck.gl layer type
        props: {
          data: [ /* your line data here */ ],
          getSourcePosition: d => d.from,
          getTargetPosition: d => d.to,
          getColor: [255,0,0],
          getWidth: 2
        }
      }
    ],
    opacityControls: true,
    defaultVisible: false
  }
  // For dynamic overlays, use renderOnClick (see RENDER_ON_CLICK.md)
];

const layersControl = new LayersControl({
  baseStyles,
  overlays,
  defaultBaseId: 'osm',
  persist: { localStorageKey: 'my-app-layers' },
  position: 'top-right'
});

const map = new maplibregl.Map({
  container: 'map',
  style: LayersControl.getInitialStyle({
    baseStyles,
    defaultBaseId: 'osm',
    persist: { localStorageKey: 'my-app-layers' }
  }) || 'https://demotiles.maplibre.org/style.json',
  center: [0, 0],
  zoom: 2
});

map.on('load', () => {
  layersControl.addTo(map);

  // Optionally restore viewport from persisted state
  const vp = LayersControl.getInitialViewport({ persist: { localStorageKey: 'my-app-layers' } });
  if (vp) map.jumpTo(vp);
});
```

---

## 3. Persistence

- User choices (base map, overlays, opacity, viewport) are saved in `localStorage` at the key you specify.
- State is restored automatically if the key exists.

---

## 4. CSS Customization

- All UI classes are defined in `src/css/main.css`.
- To customize appearance, override these classes in your own CSS:
  - `.layers-control-panel`
  - `.overlay-status`
  - `.opacity-slider`
  - `.maplibregl-ctrl.layers-control`
- See [CSS.md](./CSS.md) for a full class reference.

---

## 5. Notes

- Only `deckLayers` and `renderOnClick` overlays are supported. MapLibre `source`/`layers`/`layerIds` are NOT supported.
- For dynamic overlays, see [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md).
- For configuration options, see [CONFIGURATION.md](./CONFIGURATION.md).
- For API details, see [API_REFERENCE.md](./API_REFERENCE.md).
