# Configuration — LayersControl

This document describes all recognized options accepted by `new LayersControl(options)` and the persisted state format. All options are based on the implementation in `src/js/main.js`. Any additional keys passed in the options object will be accepted but are ignored unless used by the code.

---

## Top-level Options

| Option           | Type                      | Default                | Description                                                                                  |
|------------------|---------------------------|------------------------|----------------------------------------------------------------------------------------------|
| baseStyles       | Array\<BaseStyle\>        | []                     | List of available base map styles.                                                           |
| overlays         | Array\<Overlay\>          | []                     | List of overlay definitions.                                                                 |
| groups           | Array\<Group\>            | []                     | Optional. Overlay groups for UI grouping and group toggling.                                 |
| defaultBaseId    | string \| null            | null                   | Default base style id.                                                                       |
| persist          | object                    | —                        | Persistence options (opt-in). See below.                                                     |
| i18n             | function                  | (key) => key           | Label translation function.                                                                  |
| onChange         | function \| null          | null                   | Callback invoked on state changes.                                                           |
| autoClose        | boolean                   | true                   | Close panel after selection.                                                                 |
| showOpacity      | boolean                   | true                   | Show per-overlay/group opacity controls.                                                     |
| showLegends      | boolean                   | true                   | Reserved for future use.                                                                     |
| position         | string                    | 'top-right'            | MapLibre control position.                                                                   |
| icon             | string \| HTMLElement     | '⚏'                    | Icon for the control button.                                                                 |

**Note:** Any additional keys in the options object will be accepted but are ignored unless used by the code.

---

## persist (opt-in)

- **localStorageKey** (string): Key for saving state in localStorage. If omitted, no persistence is performed.

---

## BaseStyle (baseStyles array)

- **id** (string, required): Unique identifier.
- **label** (string, required): Human-readable name.
- **style** (string \| object, required): MapLibre style (URL or object).
- **strategy** (string, required): `'setStyle'` or `'toggleBackground'`.

Example:
```js
{
  id: 'osm',
  label: 'OpenStreetMap',
  style: 'https://demotiles.maplibre.org/style.json',
  strategy: 'setStyle'
}
```

---

## Overlay (overlays array)

Overlays are deck.gl-first. Only `deckLayers` or `renderOnClick` overlays are supported. Deprecated MapLibre `source`/`layers`/`layerIds` are not supported.

Supported fields:
- **id** (string, required)
- **label** (string, required)
- **group** (string, optional)
- **defaultVisible** (boolean, optional, default false)
- **defaultOpacity** (number, optional, default 1.0)
- **opacityControls** (boolean, optional)
- **renderOnClick** (async function, optional) — see [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md)
- **deckLayers** (array, optional) — deck.gl layer definitions
- **panOnAdd** (boolean, optional)
- **panZoom** (number, optional)
- **anchor** ({ beforeId?: string }, optional)
- **minZoomLevel** (number, optional)
- **maxZoomLevel** (number, optional)
- **forcedBaseLayerId** (string, optional)
- **forcedBearing** (number, optional)
- **forcedPitch** (number, optional)
- **tooltip** (string|object, optional)
- **getTooltip** (function, optional)

Example:
```js
{
  id: 'traffic',
  label: 'Traffic Flow',
  deckLayers: [/* deck.gl layer definitions */],
  defaultVisible: false,
  opacityControls: true
}
```

---

## Group (groups array, optional)

- **id** (string, required)
- **label** (string, required)
- **type** (string, optional, e.g. `'checkbox'`)

Group semantics:
- Group visibility toggles all overlays with `overlay.group === group.id`
- Group opacity applies to all overlays in that group

---

## Persistence (persist.localStorageKey) — opt-in

When set, state is saved to `localStorage` under the given key.

Persisted state shape:
```json
{
  "baseId": "osm",
  "overlays": {
    "overlay-id": { "visible": true, "opacity": 0.8 }
  },
  "groups": {
    "group-id": { "visible": true, "opacity": 1.0 }
  },
  "layerOrder": ["overlay-a","overlay-b"],
  "viewport": {
    "center": [lng, lat],
    "zoom": 5,
    "bearing": 0,
    "pitch": 0
  }
}
```

Restoration:
- Only valid IDs are restored; unknown entries are skipped with a warning.
- `layerOrder` is filtered to remove unknown overlay IDs.
- `viewport` is restored if present.

---

## i18n

- Function `(key) => string` for label translation. Default is identity.
- Used for UI section titles and labels.

---

## Positioning & CSS hooks

- Control position uses MapLibre container classes, e.g. `.maplibregl-ctrl-top-right`.
- The control panel uses `.layers-control-panel`.
- See [CSS.md](./CSS.md) for class list and customization.

---

## Examples

See [QUICKSTART.md](./QUICKSTART.md) and [API_REFERENCE.md](./API_REFERENCE.md) for usage and configuration examples.

---

## Notes

- Only options and fields supported in code are documented.
- Deprecated MapLibre `source`/`layers`/`layerIds` are not supported.
- For dynamic overlays, see [RENDER_ON_CLICK.md](./RENDER_ON_CLICK.md).
