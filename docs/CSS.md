# CSS — LayersControl

This file documents the CSS classes, layout behavior and customization points used by the LayersControl UI. The canonical styles live in `src/css/main.css`. Use these class names to override appearance or integrate with application themes.

## Key selectors

- `.maplibregl-ctrl.layers-control`
  - Root control container added to MapLibre control DOM.
  - Base background, border-radius and box-shadow are applied here.

- `.layers-control-toggle`
  - The clickable control button that toggles the panel.
  - Accepts either an icon HTMLElement or string HTML inserted by the control.
  - Width/height and hover background handled here.

- `.layers-control-panel`
  - Floating panel that contains base maps and overlays.
  - Positioned absolutely inside the MapLibre control container; sizing includes min-width, max-width and max-height with vertical scrolling.
  - Z-index set to 1000 by default.

- `.layers-section`, `.layers-section-title`
  - Sections inside the panel (Base Maps, Overlays).
  - `.layers-section-title` uses uppercase, small font-size and subtle background.

- `.layers-item`, `.overlay-item`, `.base-item`, `.group-item`
  - Individual items for base styles, overlays and groups.
  - `.overlay-item` uses column layout to allow an opacity slider beneath the label.

- `.overlay-label`
  - Flex container for checkbox/radio and label text. Used to make click targets consistent.

- `.overlay-status`
  - Status indicator element shown next to overlay labels.
  - States:
    - Default: `display: none`
    - `.loading` — shows spinner animation and blue color (CSS `spin` keyframes)
    - `.error` — shows error icon styling and click cursor
    - `.error:hover` — color darkens on hover
  - The UI sets `textContent` to icons (`⟳`, `⚠`) and toggles class names.

- `.opacity-control`, `.opacity-slider`, `.opacity-label`
  - Opacity control wrapper and slider input.
  - Slider uses `type="range"` with min `0`, max `1`, step `0.1`.
  - Slider thumb is styled for WebKit and Mozilla.
  - The `.opacity-label` shows percentage text and is updated by the UI.

## Positioning behavior

- Panel positioning depends on the MapLibre control container location:
  - `.maplibregl-ctrl-top-left .layers-control-panel` and `.maplibregl-ctrl-top-right .layers-control-panel` position panel below the control (`top: 100%`).
  - `.maplibregl-ctrl-bottom-left` and `.maplibregl-ctrl-bottom-right` position panel above the control (`bottom: 100%`).
  - Left/right alignment is controlled by `.maplibregl-ctrl-*-left` and `.maplibregl-ctrl-*-right`.

## Accessibility & interactions

- The slider input prevents pointer events from bubbling up to avoid toggling the checkbox when interacting with the slider.
- Status icons use `title` attributes for tooltip text when in error state.
- Buttons have `type="button"` to avoid accidental form submissions.

## Customization tips

1. Theme colors
   - Override colors (background, hover, active) by targeting `.maplibregl-ctrl.layers-control` and `.layers-control-panel`.

2. Panel size
   - Adjust `min-width`, `max-width` and `max-height` on `.layers-control-panel` to fit your layout.

3. Status icons
   - Replace status text with custom SVGs by updating `.overlay-status` content via CSS or by intercepting UI updates (use your own icon HTMLElement as `options.icon`).

4. Integrating with app layout
   - MapLibre exposes container classes such as `.maplibregl-ctrl-top-right`; use these to adjust panel offsets or add responsive rules.

## Implementation notes (from source)

- The UIBuilder creates DOM elements with these class names and directly manipulates properties such as `style.display`, `textContent`, and `onclick`.
- The slider input events are debounced (50ms) in the UI to avoid flooding StateStore with updates.
- The control relies on stable overlay IDs so the UI can query and update elements using `querySelector(input[value="${id}"])`.

## Example override (CSS snippet)

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

Use the selectors above to keep overrides minimal and resilient to future internal DOM structure changes.
