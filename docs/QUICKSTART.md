# Quickstart — LayersControl (MapLibre)

Minimal, copy-paste example to get LayersControl running with MapLibre GL JS.

## Install / Include

- Include MapLibre GL JS and deck.gl as needed in your page.
- Include the built LayersControl script (this project provides a UMD/ES build).

Example (HTML):
```html
<script src="https://unpkg.com/maplibre-gl/dist/maplibre-gl.js"></script>
<script src="https://unpkg.com/deck.gl/dist.min.js"></script>
<script src="path/to/layers-control.js"></script>
<link rel="stylesheet" href="path/to/main.css">
```

## Minimal initialization

```javascript
const baseStyles = [
  {
    id: 'osm',
    label: 'OpenStreetMap',
    style: 'https://demotiles.maplibre.org/style.json',
    strategy: 'setStyle'
  }
];

const overlays = [
  {
    id: 'traffic',
    label: 'Traffic Flow',
    // Either provide a source + layers, layerIds (existing map layers), or renderOnClick
    source: {
      id: 'traffic-source',
      type: 'vector',
      options: { url: 'mapbox://mapbox.mapbox-traffic-v1' }
    },
    layers: [
      {
        id: 'traffic-lines',
        type: 'line',
        'source-layer': 'traffic',
        paint: { 'line-color': '#ff0000', 'line-width': 2 }
      }
    ],
    opacityControls: true,
    defaultVisible: false
  }
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
  // Add control to map
  layersControl.addTo(map);

  // Optionally restore viewport from persisted state
  const vp = LayersControl.getInitialViewport({ persist: { localStorageKey: 'my-app-layers' } });
  if (vp) {
    map.jumpTo(vp);
  }
});
```

## Notes
- Use `renderOnClick` for heavy or dynamic overlays that should only load on demand (see RENDER_ON_CLICK.md).
- The control persists user choices (base map, overlay visibility, opacity, viewport) into localStorage at key `persist.localStorageKey`. See CONFIGURATION.md for state shape and validation.
- CSS selectors used by the control are in `src/css/main.css`. To customize appearance, override those classes (e.g., `.layers-control-panel`, `.overlay-status`, `.opacity-slider`).
