# CSS — LayersControl

This document describes all CSS classes, layout, and customization points for the LayersControl UI, strictly reflecting the implementation in `src/css/main.css`.

---

## Key Selectors

- `.maplibregl-ctrl.layers-control`
  - Root container for the control.
  - Sets background, border-radius, and box-shadow.

- `.layers-control-toggle`
  - Button to open/close the panel.
  - Handles icon, size, and hover background.

- `.layers-control-panel`
  - Floating panel for base maps and overlays.
  - Absolute positioning, min/max width, max height, scroll, z-index.

- `.layers-section`, `.layers-section-title`
  - Panel sections and their titles.
  - Section titles: uppercase, small font, background.

- `.layers-item`, `.overlay-item`, `.base-item`, `.group-item`
  - Items for base styles, overlays, and groups.
  - `.overlay-item`: column layout for slider below label.
  - `.group-item`: bold, subtle background.

- `.overlay-label`
  - Flex container for checkbox/radio and label.

- `.overlay-status`
  - Status indicator next to overlay labels.
  - States:
    - Default: `display: none`
    - `.loading`: blue spinner (↻), animated
    - `.error`: red icon (🚨), clickable for retry
    - `.zoomfiltered`: blue icon (⛔), semi-transparent

- `.opacity-control`, `.opacity-slider`, `.opacity-label`
  - Opacity slider and label.
  - Slider: `type="range"`, min 0, max 1, step 0.1, custom thumb.
  - Label: percentage, updated live.

- `.tooltip-content`, `.tooltip-title`, `.tooltip-body`, `.tooltip-fields`, `.tooltip-field`
  - Tooltip layout for deck.gl hover popups.

---

## Positioning

- Panel position depends on MapLibre container:
  - `.maplibregl-ctrl-top-left .layers-control-panel`, `.maplibregl-ctrl-top-right .layers-control-panel`: below control (`top: 100%`)
  - `.maplibregl-ctrl-bottom-left .layers-control-panel`, `.maplibregl-ctrl-bottom-right .layers-control-panel`: above control (`bottom: 100%`)
  - Left/right alignment by container class.

---

## Accessibility & Interactions

- Sliders prevent pointer events from toggling checkboxes.
- Status icons use `title` for tooltips.
- All buttons use `type="button"`.

---

## Customization Tips

- **Theme colors:** Override `.maplibregl-ctrl.layers-control` and `.layers-control-panel`.
- **Panel size:** Adjust `min-width`, `max-width`, `max-height` on `.layers-control-panel`.
- **Status icons:** Replace content in `.overlay-status` or use a custom icon via JS.
- **Integrate with layout:** Use MapLibre container classes for responsive rules.

---

## Implementation Notes

- UIBuilder creates/manipulates DOM with these classes.
- Sliders are debounced (50ms) to avoid flooding state.
- Overlay IDs are used for querying/updating elements.

---

## Example CSS Override

```css
.maplibregl-ctrl.layers-control {
  background: rgba(255,255,255,0.95);
  border-radius: 6px;
}

.layers-control-panel {
  min-width: 250px;
  max-height: 60vh;
}

.overlay-status.loading {
  color: #005fa3;
}
```

---

## Reference

All selectors and behaviors above are directly mapped to the implementation in `src/css/main.css`. For advanced customization, inspect the DOM and override these classes as needed.
