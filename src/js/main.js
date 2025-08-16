/**
 * EventEmitter - Simple event handling utility
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, handler) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(handler);
        return this;
    }

    off(event, handler) {
        if (this.events[event]) {
            const index = this.events[event].indexOf(handler);
            if (index > -1) {
                this.events[event].splice(index, 1);
            }
        }
        return this;
    }

    emit(event, data) {
        if (this.events[event]) {
            this.events[event].forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error('Event handler error:', error);
                }
            });
        }
    }
}

/**
 * StateStore - Manages layer states and persistence
 */
class StateStore extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.currentBaseId = options.defaultBaseId || (options.baseStyles[0]?.id);
        this.overlayStates = {};
        this.groupStates = {};

        this._initializeOverlayStates();
        this._loadPersistedState();
    }

    _initializeOverlayStates() {
        this.options.overlays.forEach(overlay => {
            this.overlayStates[overlay.id] = {
                visible: overlay.defaultVisible || false,
                opacity: 1.0
            };

            if (overlay.group && !this.groupStates[overlay.group]) {
                this.groupStates[overlay.group] = {
                    visible: overlay.defaultVisible || false,
                    opacity: 1.0
                };
            }
        });
    }

    _loadPersistedState() {
        if (!this.options.persist?.localStorageKey) return;

        try {
            const stored = localStorage.getItem(this.options.persist.localStorageKey);
            if (stored) {
                const persistedState = JSON.parse(stored);

                if (persistedState.baseId) {
                    this.currentBaseId = persistedState.baseId;
                }

                if (persistedState.overlays) {
                    Object.keys(persistedState.overlays).forEach(overlayId => {
                        if (this.overlayStates[overlayId]) {
                            Object.assign(this.overlayStates[overlayId], persistedState.overlays[overlayId]);
                        }
                    });
                }

                if (persistedState.groups) {
                    Object.keys(persistedState.groups).forEach(groupId => {
                        if (this.groupStates[groupId]) {
                            Object.assign(this.groupStates[groupId], persistedState.groups[groupId]);
                        }
                    });
                }
            }
        } catch (e) {
            console.warn('Failed to parse persisted layer state:', e);
        }
    }

    _persistState() {
        if (!this.options.persist?.localStorageKey) return;

        try {
            const state = this.getState();
            localStorage.setItem(this.options.persist.localStorageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to persist layer state:', e);
        }
    }

    getState() {
        return {
            baseId: this.currentBaseId,
            overlays: { ...this.overlayStates },
            groups: { ...this.groupStates }
        };
    }

    setBase(baseId) {
        const previousBaseId = this.currentBaseId;
        this.currentBaseId = baseId;
        this._persistState();

        this.emit('basechange', {
            baseId,
            previousBaseId
        });
        this.emit('change', this.getState());
    }

    setOverlay(overlayId, state) {
        const previousState = { ...this.overlayStates[overlayId] };
        Object.assign(this.overlayStates[overlayId], state);
        this._persistState();

        this.emit('overlaychange', {
            id: overlayId,
            visible: state.visible,
            opacity: state.opacity,
            previousVisible: previousState.visible,
            previousOpacity: previousState.opacity
        });
        this.emit('change', this.getState());
    }

    setGroup(groupId, state) {
        Object.assign(this.groupStates[groupId], state);
        this._persistState();

        const groupOverlays = this.options.overlays.filter(o => o.group === groupId);
        this.emit('overlaygroupchange', {
            groupId,
            visible: state.visible,
            opacity: state.opacity,
            overlays: groupOverlays.map(o => o.id)
        });
        this.emit('change', this.getState());
    }

    setState(newState) {
        if (newState.baseId && newState.baseId !== this.currentBaseId) {
            this.setBase(newState.baseId);
        }

        if (newState.overlays) {
            Object.entries(newState.overlays).forEach(([overlayId, overlayState]) => {
                if (this.overlayStates[overlayId]) {
                    this.setOverlay(overlayId, overlayState);
                }
            });
        }

        if (newState.groups) {
            Object.entries(newState.groups).forEach(([groupId, groupState]) => {
                if (this.groupStates[groupId]) {
                    this.setGroup(groupId, groupState);
                }
            });
        }
    }
}

/**
 * OverlayManager - Handles all map layer operations
 */
class OverlayManager extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.map = null;
        this.loadingOverlays = new Set();
        this.errorOverlays = new Set();
        this.renderOnClickCache = new Map();
        this.renderOnClickLoading = new Set();
        this.renderOnClickErrors = new Set();
    }

    setMap(map) {
        this.map = map;
        this._attachEventListeners();
    }

    removeMap() {
        this._detachEventListeners();
        this.map = null;
    }

    _attachEventListeners() {
        if (!this.map) return;

        this.boundHandlers = {
            onStyleLoad: this._onStyleLoad.bind(this),
            onSourceData: this._onSourceData.bind(this),
            onError: this._onError.bind(this)
        };

        this.map.on('style.load', this.boundHandlers.onStyleLoad);
        this.map.on('sourcedata', this.boundHandlers.onSourceData);
        this.map.on('error', this.boundHandlers.onError);
    }

    _detachEventListeners() {
        if (!this.map || !this.boundHandlers) return;

        this.map.off('style.load', this.boundHandlers.onStyleLoad);
        this.map.off('sourcedata', this.boundHandlers.onSourceData);
        this.map.off('error', this.boundHandlers.onError);
    }

    _onStyleLoad() {
        // Clear caches since style change removes all sources/layers
        this.loadingOverlays.clear();
        this.errorOverlays.clear();
        this.emit('styleload');
    }

    _onSourceData(e) {
        if (e.isSourceLoaded) {
            this.loadingOverlays.delete(e.sourceId);
            this.emit('sourceloaded', e.sourceId);
        }
    }

    _onError(e) {
        if (e.sourceId) {
            this.errorOverlays.add(e.sourceId);
            this.emit('error', {
                id: e.sourceId,
                error: e.error
            });
        }
    }

    async show(overlayId, isUserInteraction = false) {
        let overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return false;

        // Handle renderOnClick overlays
        if (overlay.renderOnClick) {
            if (!this.renderOnClickCache.has(overlayId)) {
                if (this.renderOnClickLoading.has(overlayId)) {
                    return false;
                }

                this.renderOnClickErrors.delete(overlayId);
                this.renderOnClickLoading.add(overlayId);
                this.emit('loading', { id: overlayId });

                try {
                    const result = await overlay.renderOnClick();
                    if (!result || !result.source || !result.layers) {
                        throw new Error('renderOnClick must return {source, layers}');
                    }

                    this.renderOnClickCache.set(overlayId, result);
                    this.renderOnClickLoading.delete(overlayId);
                    this.emit('success', { id: overlayId });
                } catch (error) {
                    console.error(`renderOnClick failed for overlay ${overlayId}:`, error);
                    this.renderOnClickLoading.delete(overlayId);
                    this.renderOnClickErrors.add(overlayId);
                    this.emit('error', {
                        id: overlayId,
                        error: error.message || 'renderOnClick failed'
                    });
                    return false;
                }
            }

            const cachedResult = this.renderOnClickCache.get(overlayId);
            if (cachedResult) {
                overlay = { ...overlay, source: cachedResult.source, layers: cachedResult.layers };
            }
        }

        // Add source if needed
        if (overlay.source && !this.map.getSource(overlay.source.id)) {
            this.emit('loading', { id: overlayId });
            this.loadingOverlays.add(overlay.source.id);

            try {
                this.map.addSource(overlay.source.id, {
                    type: overlay.source.type,
                    ...overlay.source.options
                });

                // Clear loading state immediately for non-data sources
                if (overlay.source.type !== 'geojson' && overlay.source.type !== 'vector' && overlay.source.type !== 'raster') {
                    this.loadingOverlays.delete(overlay.source.id);
                    this.emit('success', { id: overlayId });
                }
            } catch (error) {
                console.error('Failed to add source:', overlay.source.id, error);
                this.errorOverlays.add(overlay.source.id);
                this.loadingOverlays.delete(overlay.source.id);
                return false;
            }
        }

        // Add layers
        if (overlay.layers) {
            overlay.layers.forEach(layerDef => {
                if (!this.map.getLayer(layerDef.id)) {
                    const beforeId = this._findBeforeId(layerDef, overlay);
                    const layerConfig = this._createLayerConfig(layerDef, overlay);

                    try {
                        this.map.addLayer(layerConfig, beforeId);
                    } catch (error) {
                        console.error('Failed to add layer:', layerDef.id, error);
                        this.errorOverlays.add(overlay.source?.id || overlayId);
                    }
                } else {
                    this.map.setLayoutProperty(layerDef.id, 'visibility', 'visible');
                }
            });
        }

        // Show existing layers
        if (overlay.layerIds) {
            overlay.layerIds.forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', 'visible');
                }
            });
        }

        // Pan to overlay if enabled
        if (isUserInteraction && overlay.panOnAdd) {
            setTimeout(() => {
                this._panToOverlay(overlay);
            }, 100);
        }

        // Clear loading state if no source was added or if all layers were added successfully
        if (!overlay.source || this.map.getSource(overlay.source.id)) {
            this.loadingOverlays.delete(overlay.source?.id);
            this.emit('success', { id: overlayId });
        }

        return true;
    }

    hide(overlayId) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return;

        let layerIds = [];

        if (overlay.renderOnClick && this.renderOnClickCache.has(overlayId)) {
            const cachedResult = this.renderOnClickCache.get(overlayId);
            if (cachedResult?.layers) {
                layerIds = cachedResult.layers.map(l => l.id);
            }
        } else {
            layerIds = this._getOverlayLayerIds(overlay);
        }

        layerIds.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.setLayoutProperty(layerId, 'visibility', 'none');
            }
        });
    }

    applyOpacity(overlayId, opacity) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return;

        const layerIds = this._getOverlayLayerIds(overlay);
        layerIds.forEach(layerId => {
            const layer = this.map.getLayer(layerId);
            if (!layer) return;

            const layerType = layer.type;
            const paintProperties = {
                fill: 'fill-opacity',
                line: 'line-opacity',
                circle: 'circle-opacity',
                symbol: ['text-opacity', 'icon-opacity'],
                raster: 'raster-opacity',
                'fill-extrusion': 'fill-extrusion-opacity',
                heatmap: 'heatmap-opacity'
            };

            const props = paintProperties[layerType];
            if (Array.isArray(props)) {
                props.forEach(prop => this.map.setPaintProperty(layerId, prop, opacity));
            } else if (props) {
                this.map.setPaintProperty(layerId, props, opacity);
            }
        });
    }

    setBase(baseId) {
        const baseStyle = this.options.baseStyles.find(b => b.id === baseId);
        if (!baseStyle || !this.map) return;

        if (baseStyle.strategy === 'setStyle') {
            this.map.setStyle(baseStyle.style);
        } else if (baseStyle.strategy === 'toggleBackground') {
            this._toggleBackgroundLayers(baseStyle);
        }
    }

    reposition() {
        if (!this.map) return;

        const beforeId = this.getOverlayBeforeId();

        this.options.overlays.forEach(overlay => {
            const layerIds = this._getOverlayLayerIds(overlay);
            layerIds.forEach(layerId => {
                if (this.map.getLayer(layerId) && beforeId) {
                    try {
                        this.map.moveLayer(layerId, beforeId);
                    } catch (error) {
                        console.warn(`Could not reposition overlay layer ${layerId}:`, error);
                    }
                }
            });
        });
    }

    getOverlayBeforeId() {
        if (!this.map) return undefined;

        const layers = this.map.getStyle().layers;

        const labelLayer = layers.find(layer =>
            layer.type === 'symbol' && (
                layer.id.includes('roadname') ||
                layer.id.includes('road-label') ||
                layer.id.includes('street-label') ||
                layer.id.includes('place-label') ||
                layer.id.includes('poi-label') ||
                layer.id.includes('label-road') ||
                layer.id.includes('label-street') ||
                layer.id.includes('label-place') ||
                layer.id.includes('label-poi') ||
                layer.id.includes('place_') ||
                layer.id.includes('poi_') ||
                layer.id.includes('label') ||
                layer.id.includes('text') ||
                layer.id.includes('name') ||
                (layer.layout && layer.layout['text-field'])
            )
        ) || layers.find(layer => layer.type === 'symbol');

        return labelLayer?.id;
    }

    _findBeforeId(layerDef, overlay) {
        return layerDef.beforeId || overlay.anchor?.beforeId || this.getOverlayBeforeId();
    }

    _createLayerConfig(layerDef, overlay) {
        const layerConfig = {
            id: layerDef.id,
            type: layerDef.type,
            source: layerDef.source || overlay.source.id,
            layout: {
                visibility: 'visible',
                ...layerDef.layout
            },
            paint: layerDef.paint
        };

        if (layerDef['source-layer']) {
            layerConfig['source-layer'] = layerDef['source-layer'];
        }

        if (layerDef.filter) {
            layerConfig.filter = layerDef.filter;
        }

        return layerConfig;
    }

    _getOverlayLayerIds(overlay) {
        const layerIds = [];
        if (overlay.layers) {
            layerIds.push(...overlay.layers.map(l => l.id));
        }
        if (overlay.layerIds) {
            layerIds.push(...overlay.layerIds);
        }
        return layerIds;
    }

    _toggleBackgroundLayers(baseStyle) {
        this.options.baseStyles.forEach(base => {
            if (base.strategy === 'toggleBackground') {
                base.visibleLayerIds.forEach(layerId => {
                    if (this.map.getLayer(layerId)) {
                        this.map.setLayoutProperty(layerId, 'visibility', 'none');
                    }
                });
                if (base.hiddenLayerIds) {
                    base.hiddenLayerIds.forEach(layerId => {
                        if (this.map.getLayer(layerId)) {
                            this.map.setLayoutProperty(layerId, 'visibility', 'visible');
                        }
                    });
                }
            }
        });

        baseStyle.visibleLayerIds.forEach(layerId => {
            if (this.map.getLayer(layerId)) {
                this.map.setLayoutProperty(layerId, 'visibility', 'visible');
            }
        });
        if (baseStyle.hiddenLayerIds) {
            baseStyle.hiddenLayerIds.forEach(layerId => {
                if (this.map.getLayer(layerId)) {
                    this.map.setLayoutProperty(layerId, 'visibility', 'none');
                }
            });
        }
    }

    _panToOverlay(overlay) {
        try {
            if (overlay.source?.type === 'geojson' && overlay.source.options.data) {
                const bounds = this._calculateGeoJSONBounds(overlay.source.options.data);
                if (bounds) {
                    const zoom = overlay.panZoom || this.map.getZoom();
                    const options = {
                        padding: 50,
                        maxZoom: zoom,
                        duration: 1000
                    };
                    this.map.fitBounds(bounds, options);
                }
            }
        } catch (error) {
            console.error(`Failed to pan to overlay ${overlay.id}:`, error);
        }
    }

    _calculateGeoJSONBounds(geojsonData) {
        if (!geojsonData?.features) return null;

        let minLng = Infinity, minLat = Infinity;
        let maxLng = -Infinity, maxLat = -Infinity;

        const processCoordinates = (coords) => {
            if (Array.isArray(coords[0])) {
                coords.forEach(processCoordinates);
            } else {
                const [lng, lat] = coords;
                minLng = Math.min(minLng, lng);
                maxLng = Math.max(maxLng, lng);
                minLat = Math.min(minLat, lat);
                maxLat = Math.max(maxLat, lat);
            }
        };

        geojsonData.features.forEach(feature => {
            if (feature.geometry?.coordinates) {
                processCoordinates(feature.geometry.coordinates);
            }
        });

        if (minLng !== Infinity && minLat !== Infinity && maxLng !== -Infinity && maxLat !== -Infinity) {
            return [[minLng, minLat], [maxLng, maxLat]];
        }

        return null;
    }
}

/**
 * UIBuilder - Handles DOM creation and user interactions
 */
class UIBuilder extends EventEmitter {
    constructor(options) {
        super();
        this.options = options;
        this.container = null;
        this.panel = null;
        this.isOpen = false;
        this.boundHandlers = {
            onDocumentClick: this._onDocumentClick.bind(this)
        };
    }

    build() {
        this._createControl();
        return this.container;
    }

    destroy() {
        if (this.container?.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        document.removeEventListener('click', this.boundHandlers.onDocumentClick);
        this.container = null;
        this.panel = null;
    }

    updateBaseRadios(currentId) {
        const radios = this.container?.querySelectorAll('input[name="base-layer"]');
        radios?.forEach(radio => {
            radio.checked = radio.value === currentId;
        });
    }

    updateOverlayCheckbox(id, visible) {
        const checkbox = this.container?.querySelector(`input[value="${id}"]`);
        if (checkbox) {
            checkbox.checked = visible;
        }
    }

    updateOverlayStatus(id, status) {
        const item = this.container?.querySelector(`input[value="${id}"]`)?.closest('.overlay-item');
        if (item) {
            const statusEl = item.querySelector('.overlay-status');
            if (statusEl) {
                statusEl.className = 'overlay-status';
                switch (status) {
                    case 'loading':
                        statusEl.classList.add('loading');
                        statusEl.textContent = '⟳';
                        statusEl.style.display = 'inline-block';
                        break;
                    case 'error':
                        statusEl.classList.add('error');
                        statusEl.textContent = '⚠';
                        statusEl.title = 'Click to retry';
                        statusEl.style.display = 'inline-block';
                        statusEl.onclick = () => {
                            this.emit('retryoverlay', { id });
                        };
                        break;
                    case 'success':
                        statusEl.textContent = '';
                        statusEl.title = '';
                        statusEl.onclick = null;
                        statusEl.style.display = 'none';
                        break;
                }
            }
        }
    }

    updateGroupCheckbox(groupId, visible) {
        const checkbox = this.container?.querySelector(`input[value="${groupId}"]`);
        if (checkbox) {
            checkbox.checked = visible;
        }
    }

    createOpacitySlider(id, initialValue) {
        const container = document.createElement('div');
        container.className = 'opacity-control';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.1';
        slider.value = initialValue;
        slider.className = 'opacity-slider';

        let timeout;
        slider.addEventListener('input', () => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                this.emit('opacitychange', {
                    id,
                    opacity: parseFloat(slider.value)
                });
            }, 50);
        });

        const label = document.createElement('span');
        label.className = 'opacity-label';
        label.textContent = Math.round(initialValue * 100) + '%';

        container.appendChild(slider);
        container.appendChild(label);

        return container;
    }

    updateOpacitySlider(id, opacity) {
        const item = this.container?.querySelector(`input[value="${id}"]`)?.closest('.overlay-item');
        if (item) {
            const slider = item.querySelector('.opacity-slider');
            const label = item.querySelector('.opacity-label');
            if (slider) slider.value = opacity;
            if (label) label.textContent = Math.round(opacity * 100) + '%';
        }
    }

    _createControl() {
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group layers-control';

        const button = document.createElement('button');
        button.className = 'layers-control-toggle';
        button.type = 'button';
        button.title = this.options.i18n('layers');

        if (this.options.icon instanceof HTMLElement) {
            button.appendChild(this.options.icon);
        } else if (typeof this.options.icon === 'string') {
            button.innerHTML = this.options.icon;
        } else {
            button.innerHTML = '⚏';
        }

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this._togglePanel();
        });

        this.container.appendChild(button);
        this._createPanel();
    }

    _createPanel() {
        this.panel = document.createElement('div');
        this.panel.className = 'layers-control-panel';
        this.panel.style.display = 'none';

        if (this.options.baseStyles.length > 0) {
            const baseSection = this._createBaseSection();
            this.panel.appendChild(baseSection);
        }

        if (this.options.overlays.length > 0) {
            const overlaySection = this._createOverlaySection();
            this.panel.appendChild(overlaySection);
        }

        this.container.appendChild(this.panel);
    }

    _createBaseSection() {
        const section = document.createElement('div');
        section.className = 'layers-section base-section';

        const title = document.createElement('div');
        title.className = 'layers-section-title';
        title.textContent = this.options.i18n('Base Maps');
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'layers-list';

        this.options.baseStyles.forEach(baseStyle => {
            const item = this._createBaseItem(baseStyle);
            list.appendChild(item);
        });

        section.appendChild(list);
        return section;
    }

    _createBaseItem(baseStyle) {
        const item = document.createElement('label');
        item.className = 'layers-item base-item';

        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'base-layer';
        radio.value = baseStyle.id;
        radio.addEventListener('change', () => {
            if (radio.checked) {
                this.emit('basechange', { id: baseStyle.id });
                if (this.options.autoClose) {
                    this._closePanel();
                }
            }
        });

        const label = document.createElement('span');
        label.textContent = baseStyle.label;

        item.appendChild(radio);
        item.appendChild(label);
        return item;
    }

    _createOverlaySection() {
        const section = document.createElement('div');
        section.className = 'layers-section overlay-section';

        const title = document.createElement('div');
        title.className = 'layers-section-title';
        title.textContent = this.options.i18n('Overlays');
        section.appendChild(title);

        const list = document.createElement('div');
        list.className = 'layers-list';

        const grouped = this._groupOverlaysByAttribute();

        Object.entries(grouped).forEach(([groupId, overlays]) => {
            if (groupId !== 'ungrouped') {
                const groupItem = this._createOverlayGroupItem(groupId, overlays);
                list.appendChild(groupItem);
            } else {
                overlays.forEach(overlay => {
                    const item = this._createOverlayItem(overlay);
                    list.appendChild(item);
                });
            }
        });

        section.appendChild(list);
        return section;
    }

    _groupOverlaysByAttribute() {
        const grouped = { ungrouped: [] };

        this.options.overlays.forEach(overlay => {
            const groupId = overlay.group || 'ungrouped';
            if (!grouped[groupId]) {
                grouped[groupId] = [];
            }
            grouped[groupId].push(overlay);
        });

        return grouped;
    }

    _createOverlayGroupItem(groupId, overlays) {
        const item = document.createElement('div');
        item.className = 'layers-item overlay-item group-item';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.width = '100%';

        const label = document.createElement('label');
        label.className = 'overlay-label';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.flex = '1';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = groupId;
        input.addEventListener('change', () => {
            this.emit('groupchange', {
                id: groupId,
                visible: input.checked,
                isUserInteraction: true
            });
            if (this.options.autoClose && !this.options.showOpacity) {
                this._closePanel();
            }
        });

        const labelText = document.createElement('span');
        labelText.textContent = groupId;

        label.appendChild(input);
        label.appendChild(labelText);

        const status = document.createElement('div');
        status.className = 'overlay-status';

        labelContainer.appendChild(label);
        labelContainer.appendChild(status);
        item.appendChild(labelContainer);

        const hasOpacityControls = overlays.some(o => o.opacityControls);
        if (hasOpacityControls && this.options.showOpacity) {
            const opacityControl = this.createOpacitySlider(groupId, 1.0);
            item.appendChild(opacityControl);
        }

        return item;
    }

    _createOverlayItem(overlay) {
        const item = document.createElement('div');
        item.className = 'layers-item overlay-item';

        const labelContainer = document.createElement('div');
        labelContainer.style.display = 'flex';
        labelContainer.style.alignItems = 'center';
        labelContainer.style.width = '100%';

        const label = document.createElement('label');
        label.className = 'overlay-label';
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.flex = '1';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = overlay.id;
        input.addEventListener('change', () => {
            this.emit('overlaychange', {
                id: overlay.id,
                visible: input.checked,
                isUserInteraction: true
            });
            if (this.options.autoClose && !this.options.showOpacity) {
                this._closePanel();
            }
        });

        const labelText = document.createElement('span');
        labelText.textContent = overlay.label;

        label.appendChild(input);
        label.appendChild(labelText);

        const status = document.createElement('div');
        status.className = 'overlay-status';

        labelContainer.appendChild(label);
        labelContainer.appendChild(status);
        item.appendChild(labelContainer);

        if (overlay.opacityControls && this.options.showOpacity) {
            const opacityControl = this.createOpacitySlider(overlay.id, 1.0);
            item.appendChild(opacityControl);
        }

        return item;
    }

    _togglePanel() {
        if (this.isOpen) {
            this._closePanel();
        } else {
            this._openPanel();
        }
    }

    _openPanel() {
        this.panel.style.display = 'block';
        this.isOpen = true;
        document.addEventListener('click', this.boundHandlers.onDocumentClick);
    }

    _closePanel() {
        this.panel.style.display = 'none';
        this.isOpen = false;
        document.removeEventListener('click', this.boundHandlers.onDocumentClick);
    }

    _onDocumentClick(e) {
        if (!this.container.contains(e.target)) {
            this._closePanel();
        }
    }
}

/**
 * LayersControl - Main facade class for MapLibre layer management
 */
class LayersControl extends EventEmitter {
    constructor(options = {}) {
        super();

        this.options = {
            baseStyles: [],
            overlays: [],
            groups: [],
            defaultBaseId: null,
            persist: {
                localStorageKey: 'ml-layers'
            },
            i18n: (key) => key,
            onChange: null,
            autoClose: true,
            showOpacity: true,
            showLegends: true,
            position: 'top-right',
            ...options
        };

        this.map = null;

        // Initialize sub-components
        this.state = new StateStore(this.options);
        this.overlayManager = new OverlayManager(this.options);
        this.ui = new UIBuilder(this.options);

        // Wire up events between components
        this._wireEvents();
    }

    /**
     * Static method to get the initial style that would be used by LayersControl
     */
    static getInitialStyle(options = {}) {
        const tempOptions = {
            baseStyles: [],
            defaultBaseId: null,
            persist: {
                localStorageKey: 'ml-layers'
            },
            ...options
        };

        let persistedBaseId = null;
        if (tempOptions.persist.localStorageKey) {
            try {
                const stored = localStorage.getItem(tempOptions.persist.localStorageKey);
                if (stored) {
                    const persistedState = JSON.parse(stored);
                    if (persistedState.baseId) {
                        persistedBaseId = persistedState.baseId;
                    }
                }
            } catch (e) {
                console.warn('Failed to parse persisted layer state:', e);
            }
        }

        const targetBaseId = persistedBaseId || tempOptions.defaultBaseId || (tempOptions.baseStyles[0]?.id);

        if (targetBaseId) {
            const baseStyle = tempOptions.baseStyles.find(b => b.id === targetBaseId);
            if (baseStyle && baseStyle.strategy === 'setStyle') {
                return baseStyle.style;
            }
        }

        return null;
    }

    /**
     * Get the current style that this control is using
     */
    getCurrentStyle() {
        const state = this.state.getState();
        if (state.baseId) {
            const baseStyle = this.options.baseStyles.find(b => b.id === state.baseId);
            if (baseStyle && baseStyle.strategy === 'setStyle') {
                return baseStyle.style;
            }
        }
        return null;
    }

    /**
     * Add control to map
     */
    addTo(map) {
        this.map = map;
        this.overlayManager.setMap(map);

        // Use MapLibre's built-in addControl method instead of manual DOM management
        map.addControl(this, this.options.position);

        return this;
    }

    /**
     * MapLibre control interface
     */
    onAdd(map) {
        this.map = map;
        this.overlayManager.setMap(map);
        this._applyInitialState();
        return this.ui.build();
    }

    onRemove() {
        this.remove();
    }

    getDefaultPosition() {
        return this.options.position;
    }

    /**
     * Remove control from map
     */
    remove() {
        this.ui.destroy();
        this.overlayManager.removeMap();
        this.map = null;
    }

    /**
     * Set base map
     */
    setBase(baseId) {
        const baseStyle = this.options.baseStyles.find(b => b.id === baseId);
        if (!baseStyle) {
            console.warn(`Base style '${baseId}' not found`);
            return;
        }

        this.overlayManager.setBase(baseId);
        this.state.setBase(baseId);
    }

    /**
     * Toggle overlay visibility
     */
    async toggleOverlay(overlayId, visible = null, isUserInteraction = false) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay) {
            console.warn(`Overlay '${overlayId}' not found`);
            return;
        }

        const currentState = this.state.overlayStates[overlayId];
        const newVisible = visible !== null ? visible : !currentState.visible;

        if (newVisible) {
            const success = await this.overlayManager.show(overlayId, isUserInteraction);
            if (!success) return;
        } else {
            this.overlayManager.hide(overlayId);
        }

        this.state.setOverlay(overlayId, { visible: newVisible });
    }

    /**
     * Set overlay opacity
     */
    setOverlayOpacity(overlayId, opacity) {
        if (opacity < 0 || opacity > 1) {
            console.warn('Opacity must be between 0 and 1');
            return;
        }

        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay) {
            console.warn(`Overlay '${overlayId}' not found`);
            return;
        }

        this.overlayManager.applyOpacity(overlayId, opacity);
        this.state.setOverlay(overlayId, { opacity });
        this.ui.updateOpacitySlider(overlayId, opacity);
    }

    /**
     * Reposition all visible overlays to proper z-order
     */
    repositionOverlays() {
        this.overlayManager.reposition();
    }

    /**
     * Get the appropriate beforeId for positioning overlay layers
     */
    getOverlayBeforeId() {
        return this.overlayManager.getOverlayBeforeId();
    }

    /**
     * Toggle overlay group visibility
     */
    async toggleOverlayGroup(groupId, visible = null, isUserInteraction = false) {
        const groupOverlays = this.options.overlays.filter(o => o.group === groupId);
        if (groupOverlays.length === 0) {
            console.warn(`Overlay group '${groupId}' not found`);
            return;
        }

        const currentState = this.state.groupStates[groupId];
        const newVisible = visible !== null ? visible : !currentState.visible;

        for (const overlay of groupOverlays) {
            if (newVisible) {
                await this.overlayManager.show(overlay.id, isUserInteraction);
            } else {
                this.overlayManager.hide(overlay.id);
            }
            this.state.setOverlay(overlay.id, { visible: newVisible });
        }

        this.state.setGroup(groupId, { visible: newVisible });
    }

    /**
     * Set group opacity
     */
    setGroupOpacity(groupId, opacity) {
        if (opacity < 0 || opacity > 1) {
            console.warn('Opacity must be between 0 and 1');
            return;
        }

        const groupOverlays = this.options.overlays.filter(o => o.group === groupId);
        if (groupOverlays.length === 0) {
            console.warn(`Overlay group '${groupId}' not found`);
            return;
        }

        groupOverlays.forEach(overlay => {
            this.overlayManager.applyOpacity(overlay.id, opacity);
            this.state.setOverlay(overlay.id, { opacity });
        });

        this.state.setGroup(groupId, { opacity });
    }

    /**
     * Add a new overlay to the control dynamically
     */
    addOverlay(overlay) {
        if (this.options.overlays.find(o => o.id === overlay.id)) {
            console.warn(`Overlay '${overlay.id}' already exists`);
            return;
        }

        this.options.overlays.push(overlay);
        this.state.overlayStates[overlay.id] = {
            visible: overlay.defaultVisible || false,
            opacity: 1.0
        };

        if (overlay.group && !this.state.groupStates[overlay.group]) {
            this.state.groupStates[overlay.group] = {
                visible: overlay.defaultVisible || false,
                opacity: 1.0
            };
        }

        // Rebuild UI and show if defaultVisible
        this.ui.destroy();
        this.ui.build();

        if (overlay.defaultVisible) {
            this.overlayManager.show(overlay.id);
            this.state.setOverlay(overlay.id, { visible: true });
        }
    }

    /**
     * Remove an overlay from the control dynamically
     */
    removeOverlay(overlayId) {
        const overlayIndex = this.options.overlays.findIndex(o => o.id === overlayId);
        if (overlayIndex === -1) {
            console.warn(`Overlay '${overlayId}' not found`);
            return;
        }

        if (this.state.overlayStates[overlayId]?.visible) {
            this.overlayManager.hide(overlayId);
        }

        this.options.overlays.splice(overlayIndex, 1);
        delete this.state.overlayStates[overlayId];

        // Rebuild UI
        this.ui.destroy();
        this.ui.build();
    }

    /**
     * Get current state
     */
    getState() {
        return this.state.getState();
    }

    /**
     * Set state
     */
    setState(newState) {
        this.state.setState(newState);
    }

    _wireEvents() {
        // State events → UI updates
        this.state.on('basechange', (data) => {
            this.ui.updateBaseRadios(data.baseId);
            this.emit('basechange', data);
        });

        this.state.on('overlaychange', (data) => {
            this.ui.updateOverlayCheckbox(data.id, data.visible);
            this.emit('overlaychange', data);
        });

        this.state.on('overlaygroupchange', (data) => {
            this.ui.updateGroupCheckbox(data.groupId, data.visible);
            this.emit('overlaygroupchange', data);
        });

        this.state.on('change', (data) => {
            if (this.options.onChange) {
                this.options.onChange(data);
            }
            this.emit('change', data);
        });

        // UI events → Actions
        this.ui.on('basechange', (data) => {
            this.setBase(data.id);
        });

        this.ui.on('overlaychange', (data) => {
            this.toggleOverlay(data.id, data.visible, data.isUserInteraction);
        });

        this.ui.on('groupchange', (data) => {
            this.toggleOverlayGroup(data.id, data.visible, data.isUserInteraction);
        });

        this.ui.on('opacitychange', (data) => {
            if (this.state.groupStates[data.id]) {
                this.setGroupOpacity(data.id, data.opacity);
            } else {
                this.setOverlayOpacity(data.id, data.opacity);
            }
        });

        this.ui.on('retryoverlay', (data) => {
            this.overlayManager.renderOnClickCache.delete(data.id);
            this.overlayManager.renderOnClickErrors.delete(data.id);
            this.toggleOverlay(data.id, true, true);
        });

        // OverlayManager events → UI updates
        this.overlayManager.on('loading', (data) => {
            this.ui.updateOverlayStatus(data.id, 'loading');
            this.emit('loading', data);
        });

        this.overlayManager.on('error', (data) => {
            this.ui.updateOverlayStatus(data.id, 'error');
            this.emit('error', data);
        });

        this.overlayManager.on('success', (data) => {
            this.ui.updateOverlayStatus(data.id, 'success');
        });

        this.overlayManager.on('styleload', () => {
            this._applyInitialState();
        });
    }

    _applyInitialState() {
        if (!this.map) return;

        const state = this.state.getState();

        // Apply base map
        if (state.baseId) {
            this.overlayManager.setBase(state.baseId);
            this.ui.updateBaseRadios(state.baseId);
        }

        // Apply overlay states
        Object.entries(state.overlays).forEach(([overlayId, overlayState]) => {
            if (overlayState.visible) {
                this.overlayManager.show(overlayId);
            }
            if (overlayState.opacity !== 1.0) {
                this.overlayManager.applyOpacity(overlayId, overlayState.opacity);
            }
            this.ui.updateOverlayCheckbox(overlayId, overlayState.visible);
            this.ui.updateOpacitySlider(overlayId, overlayState.opacity);
        });

        // Apply group states
        Object.entries(state.groups).forEach(([groupId, groupState]) => {
            this.ui.updateGroupCheckbox(groupId, groupState.visible);
        });
    }
}