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
        this.layerOrder = []; // Track the order in which layers were added/shown
        this.viewportState = {
            center: null,
            zoom: null,
            bearing: 0,
            pitch: 0
        };

        this._initializeOverlayStates();
        this._loadPersistedState();
    }

    _initializeOverlayStates() {
        this.options.overlays.forEach(overlay => {
            this.overlayStates[overlay.id] = {
                visible: overlay.defaultVisible || false,
                opacity: overlay.defaultOpacity || 1.0
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

                // Validate and restore base style
                if (persistedState.baseId) {
                    const baseStyleExists = this.options.baseStyles.find(b => b.id === persistedState.baseId);
                    if (baseStyleExists) {
                        this.currentBaseId = persistedState.baseId;
                    } else {
                        console.warn(`Persisted base style '${persistedState.baseId}' no longer exists. Using default base style.`);
                        // Keep the default baseId that was set in constructor
                    }
                }

                // Validate and restore overlay states
                if (persistedState.overlays) {
                    Object.keys(persistedState.overlays).forEach(overlayId => {
                        if (this.overlayStates[overlayId]) {
                            // Overlay still exists, restore its state
                            Object.assign(this.overlayStates[overlayId], persistedState.overlays[overlayId]);
                        } else {
                            console.warn(`Persisted overlay '${overlayId}' no longer exists. Skipping state restoration for this overlay.`);
                        }
                    });
                }

                // Validate and restore group states
                if (persistedState.groups) {
                    Object.keys(persistedState.groups).forEach(groupId => {
                        if (this.groupStates[groupId]) {
                            // Group still exists, restore its state
                            Object.assign(this.groupStates[groupId], persistedState.groups[groupId]);
                        } else {
                            // Check if group still has overlays
                            const groupOverlays = this.options.overlays.filter(o => o.group === groupId);
                            if (groupOverlays.length === 0) {
                                console.warn(`Persisted group '${groupId}' no longer exists. Skipping state restoration for this group.`);
                            } else {
                                // Group exists but wasn't initialized - handle it
                                console.warn(`Group '${groupId}' exists but wasn't properly initialized. Reinitializing group state.`);
                                this.groupStates[groupId] = {
                                    visible: false,
                                    opacity: 1.0
                                };
                                Object.assign(this.groupStates[groupId], persistedState.groups[groupId]);
                            }
                        }
                    });
                }

                // Restore layer order
                if (persistedState.layerOrder && Array.isArray(persistedState.layerOrder)) {
                    // Filter out any layer IDs that no longer exist
                    this.layerOrder = persistedState.layerOrder.filter(layerId => 
                        this.overlayStates[layerId]
                    );
                }

                // Restore viewport state (this is generally safe)
                if (persistedState.viewport) {
                    this.viewportState = {
                        center: persistedState.viewport.center || null,
                        zoom: persistedState.viewport.zoom || null,
                        bearing: persistedState.viewport.bearing || 0,
                        pitch: persistedState.viewport.pitch || 0
                    };
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
            groups: { ...this.groupStates },
            layerOrder: [...this.layerOrder], // Include layer order in state
            viewport: { ...this.viewportState }
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

        // Track layer order when visibility changes
        if (state.visible !== undefined) {
            if (state.visible && !previousState.visible) {
                // Layer is being shown - add to end of order (top of stack)
                this._addToLayerOrder(overlayId);
            } else if (!state.visible && previousState.visible) {
                // Layer is being hidden - remove from order
                this._removeFromLayerOrder(overlayId);
            }
        }

        this._persistState();

        this.emit('overlaychange', {
            id: overlayId,
            visible: this.overlayStates[overlayId].visible, // Use current state, not input
            opacity: this.overlayStates[overlayId].opacity, // Use current state, not input
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

    setViewport(viewport) {
        const previousState = { ...this.viewportState };
        
        if (viewport.center !== undefined) this.viewportState.center = viewport.center;
        if (viewport.zoom !== undefined) this.viewportState.zoom = viewport.zoom;
        if (viewport.bearing !== undefined) this.viewportState.bearing = viewport.bearing;
        if (viewport.pitch !== undefined) this.viewportState.pitch = viewport.pitch;
        
        this._persistState();

        this.emit('viewportchange', {
            viewport: { ...this.viewportState },
            previousViewport: previousState
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

        if (newState.viewport) {
            this.setViewport(newState.viewport);
        }
    }

    _addToLayerOrder(overlayId) {
        // Remove from current position if it exists
        this._removeFromLayerOrder(overlayId);
        // Add to end (top of stack)
        this.layerOrder.push(overlayId);
    }

    _removeFromLayerOrder(overlayId) {
        const index = this.layerOrder.indexOf(overlayId);
        if (index > -1) {
            this.layerOrder.splice(index, 1);
        }
    }

    getLayerOrder() {
        return [...this.layerOrder];
    }
}

/**
 * OverlayManager - Handles all map layer operations
 */
class OverlayManager extends EventEmitter {
    constructor(options, stateStore = null) {
        super();
        this.options = options;
        this.stateStore = stateStore;
        this.map = null;
        this.deckgl = null;
        this.deckLayers = new Map();
        this.loadingOverlays = new Set();
        this.errorOverlays = new Set();
        this.renderOnClickCache = new Map();
        this.renderOnClickLoading = new Set();
        this.renderOnClickErrors = new Set();
    }

    setMap(map) {
        this.map = map;
        this._initializeDeckGL();
        this._attachEventListeners();
    }

    removeMap() {
        this._detachEventListeners();
        this._destroyDeckGL();
        this.map = null;
    }

    _initializeDeckGL() {
        if (!this.map || typeof deck === 'undefined' || this.deckOverlay) return;

        try {
            // Create deck.gl overlay for MapLibre
            this.deckOverlay = new deck.MapboxOverlay({
                interleaved: false,
                layers: [],
                pickingRadius: 5,
                controller: false,
                getTooltip: ({object}) => object && {
                    html: `<div><strong>${object.name || object.id || 'Feature'}</strong></div>`,
                    style: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        color: 'white',
                        padding: '8px',
                        borderRadius: '4px',
                        fontSize: '12px'
                    }
                }
            });
            
            this.map.addControl(this.deckOverlay);

            console.log('Deck.gl initialized successfully');
        } catch (error) {
            console.error('Failed to initialize Deck.gl:', error);
        }
    }

    _destroyDeckGL() {
        if (this.deckOverlay && this.map) {
            try {
                this.map.removeControl(this.deckOverlay);
            } catch (e) {
                console.warn('Error removing deck.gl overlay:', e);
            }
        }
        this.deckOverlay = null;
        this.deckLayers.clear();
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
                    // Create context object with useful references for data manipulation
                    const context = {
                        map: this.map,
                        overlayManager: this,
                        stateStore: this.stateStore,
                        overlayId: overlayId,
                        overlay: overlay,
                        isUserInteraction: isUserInteraction,
                        deckOverlay: this.deckOverlay,
                        // Helper methods
                        getCurrentViewport: () => ({
                            center: [this.map.getCenter().lng, this.map.getCenter().lat],
                            zoom: this.map.getZoom(),
                            bearing: this.map.getBearing(),
                            pitch: this.map.getPitch()
                        }),
                        // Access to other overlay states
                        getOverlayState: (id) => this.stateStore?.overlayStates?.[id],
                        getAllOverlayStates: () => this.stateStore?.overlayStates || {}
                    };
                    
                    const result = await overlay.renderOnClick(context);
                    if (!result || !result.deckLayers) {
                        throw new Error('renderOnClick must return {deckLayers}');
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
                overlay = { ...overlay, deckLayers: cachedResult.deckLayers };
            }
        }

        // Add deck.gl layers
        if (overlay.deckLayers && this.deckOverlay) {
            try {
                overlay.deckLayers.forEach(deckLayerDef => {
                    const layer = this._createDeckLayer(deckLayerDef, overlay);
                    if (layer) {
                        this.deckLayers.set(deckLayerDef.id, layer);
                    }
                });
                this._updateDeckLayers();
                this.emit('success', { id: overlayId });
            } catch (error) {
                console.error('Failed to add deck.gl layers:', error);
                this.errorOverlays.add(overlayId);
                this.emit('error', {
                    id: overlayId,
                    error: error.message || 'Failed to add deck.gl layers'
                });
                return false;
            }
        }

        // Pan to overlay if enabled
        if (isUserInteraction && overlay.panOnAdd && overlay.deckLayers) {
            setTimeout(() => {
                this._panToDeckOverlay(overlay);
            }, 100);
        }

        return true;
    }

    hide(overlayId) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return;

        // Hide deck.gl layers
        if (overlay.deckLayers) {
            overlay.deckLayers.forEach(deckLayerDef => {
                this.deckLayers.delete(deckLayerDef.id);
            });
            this._updateDeckLayers();
        }

        // Handle renderOnClick cache
        if (overlay.renderOnClick && this.renderOnClickCache.has(overlayId)) {
            const cachedResult = this.renderOnClickCache.get(overlayId);
            if (cachedResult?.deckLayers) {
                cachedResult.deckLayers.forEach(deckLayerDef => {
                    this.deckLayers.delete(deckLayerDef.id);
                });
                this._updateDeckLayers();
            }
        }
    }

    applyOpacity(overlayId, opacity) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return;

        // Apply opacity to deck.gl layers
        if (overlay.deckLayers) {
            this.applyDeckOpacity(overlayId, opacity);
        }

        // Also apply opacity to renderOnClick cached layers
        if (overlay.renderOnClick && this.renderOnClickCache.has(overlayId)) {
            const cachedResult = this.renderOnClickCache.get(overlayId);
            if (cachedResult?.deckLayers) {
                cachedResult.deckLayers.forEach(deckLayerDef => {
                    const layer = this.deckLayers.get(deckLayerDef.id);
                    if (layer) {
                        // Update the layer with new opacity
                        const updatedLayer = layer.clone({
                            opacity: opacity
                        });
                        this.deckLayers.set(deckLayerDef.id, updatedLayer);
                    }
                });
                this._updateDeckLayers();
            }
        }
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

    _panToDeckOverlay(overlay) {
        try {
            if (overlay.deckLayers && overlay.deckLayers.length > 0) {
                const firstLayer = overlay.deckLayers[0];
                if (firstLayer.props && firstLayer.props.data && firstLayer.props.data.length > 0) {
                    const firstPoint = firstLayer.props.data[0];
                    if (firstPoint.position) {
                        const [lng, lat] = firstPoint.position;
                        this.map.flyTo({
                            center: [lng, lat],
                            zoom: overlay.panZoom || 12,
                            duration: 1000
                        });
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to pan to deck overlay ${overlay.id}:`, error);
        }
    }

    _createDeckLayer(deckLayerDef, overlay) {
        if (!deck || !this.deckOverlay) return null;

        try {
            const LayerClass = deck[deckLayerDef.type];
            if (!LayerClass) {
                console.error(`Unknown deck.gl layer type: ${deckLayerDef.type}`);
                return null;
            }

            // Respect persisted opacity if available
            const persistedOpacity = this.stateStore?.overlayStates?.[overlay.id]?.opacity;
            const finalProps = {
                id: deckLayerDef.id,
                ...deckLayerDef.props
            };
            if (typeof persistedOpacity === 'number') {
                finalProps.opacity = persistedOpacity;
            }

            return new LayerClass(finalProps);
        } catch (error) {
            console.error(`Failed to create deck.gl layer ${deckLayerDef.id}:`, error);
            return null;
        }
    }

    _updateDeckLayers() {
        if (!this.deckOverlay) return;

        let layers;
        
        if (this.stateStore) {
            // Respect the layer order from state store
            const layerOrder = this.stateStore.getLayerOrder();
            layers = [];
            
            // Add layers in the order they appear in layerOrder
            layerOrder.forEach(overlayId => {
                const overlay = this.options.overlays.find(o => o.id === overlayId);
                if (overlay && overlay.deckLayers) {
                    overlay.deckLayers.forEach(deckLayerDef => {
                        const layer = this.deckLayers.get(deckLayerDef.id);
                        if (layer) {
                            layers.push(layer);
                        }
                    });
                }
            });
            
            // Add any remaining layers that aren't in the order (fallback)
            this.deckLayers.forEach((layer, layerId) => {
                if (!layers.includes(layer)) {
                    layers.push(layer);
                }
            });
        } else {
            // Fallback to original behavior if no state store
            layers = Array.from(this.deckLayers.values());
        }
        
        this.deckOverlay.setProps({ layers });
    }

    applyDeckOpacity(overlayId, opacity) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !overlay.deckLayers) return;

        overlay.deckLayers.forEach(deckLayerDef => {
            const layer = this.deckLayers.get(deckLayerDef.id);
            if (layer) {
                // Update the layer with new opacity
                const updatedLayer = layer.clone({
                    opacity: opacity
                });
                this.deckLayers.set(deckLayerDef.id, updatedLayer);
            }
        });

        this._updateDeckLayers();
    }
}

/**
 * UIBuilder - Handles DOM creation and user interactions
 */
class UIBuilder extends EventEmitter {
    constructor(options, stateStore = null) {
        super();
        this.options = options;
        this.stateStore = stateStore;
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

        // Prevent slider interactions from toggling the checkbox
        const stop = (e) => { e.stopPropagation(); };
        ['click','mousedown','pointerdown','touchstart','dblclick','keydown'].forEach(evt => {
            slider.addEventListener(evt, stop);
            container.addEventListener(evt, stop);
        });

        let timeout;
        slider.addEventListener('input', () => {
            // Update label immediately for responsive UI feedback
            label.textContent = Math.round(parseFloat(slider.value) * 100) + '%';
            
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
            // Get initial opacity from state store
            const initialOpacity = this.stateStore?.groupStates[groupId]?.opacity || 1.0;
            const opacityControl = this.createOpacitySlider(groupId, initialOpacity);
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
            // Get initial opacity from state store
            const initialOpacity = this.stateStore?.overlayStates[overlay.id]?.opacity || 1.0;
            const opacityControl = this.createOpacitySlider(overlay.id, initialOpacity);
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
        this.overlayManager = new OverlayManager(this.options, this.state);
    this.ui = new UIBuilder(this.options, this.state);

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
     * Static method to get the initial viewport state from localStorage
     */
    static getInitialViewport(options = {}) {
        const tempOptions = {
            persist: {
                localStorageKey: 'ml-layers'
            },
            ...options
        };

        if (tempOptions.persist.localStorageKey) {
            try {
                const stored = localStorage.getItem(tempOptions.persist.localStorageKey);
                if (stored) {
                    const persistedState = JSON.parse(stored);
                    if (persistedState.viewport) {
                        return persistedState.viewport;
                    }
                }
            } catch (e) {
                console.warn('Failed to parse persisted viewport state:', e);
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
        const uiElement = this.ui.build();
        this._applyInitialState();
        return uiElement;
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

        // Apply viewport state (bearing and pitch)
        if (state.viewport) {
            const currentCenter = this.map.getCenter();
            const currentZoom = this.map.getZoom();
            
            const viewportOptions = {};
            
            // Only apply persisted values if they exist
            if (state.viewport.center && Array.isArray(state.viewport.center)) {
                viewportOptions.center = state.viewport.center;
            }
            if (typeof state.viewport.zoom === 'number') {
                viewportOptions.zoom = state.viewport.zoom;
            }
            if (typeof state.viewport.bearing === 'number') {
                viewportOptions.bearing = state.viewport.bearing;
            }
            if (typeof state.viewport.pitch === 'number') {
                viewportOptions.pitch = state.viewport.pitch;
            }

            // Apply viewport state if we have any persisted values
            if (Object.keys(viewportOptions).length > 0) {
                this.map.jumpTo(viewportOptions);
            }
        }

        // Apply base map
        if (state.baseId) {
            this.overlayManager.setBase(state.baseId);
            this.ui.updateBaseRadios(state.baseId);
        }

        // Apply overlay states in the correct order
        const layerOrder = this.state.getLayerOrder();
        
        // First, apply overlays in their persisted order
        layerOrder.forEach(overlayId => {
            const overlayState = state.overlays[overlayId];
            if (overlayState) {
                if (overlayState.visible) {
                    this.overlayManager.show(overlayId);
                }
                if (overlayState.opacity !== undefined && overlayState.opacity !== 1.0) {
                    this.overlayManager.applyOpacity(overlayId, overlayState.opacity);
                }
                this.ui.updateOverlayCheckbox(overlayId, overlayState.visible);
                // Always update slider to show correct opacity value
                this.ui.updateOpacitySlider(overlayId, overlayState.opacity || 1.0);
            }
        });
        
        // Then, apply any remaining overlays that weren't in the layer order
        Object.entries(state.overlays).forEach(([overlayId, overlayState]) => {
            if (!layerOrder.includes(overlayId)) {
                if (overlayState.visible) {
                    this.overlayManager.show(overlayId);
                }
                if (overlayState.opacity !== undefined && overlayState.opacity !== 1.0) {
                    this.overlayManager.applyOpacity(overlayId, overlayState.opacity);
                }
                this.ui.updateOverlayCheckbox(overlayId, overlayState.visible);
                // Always update slider to show correct opacity value
                this.ui.updateOpacitySlider(overlayId, overlayState.opacity || 1.0);
            }
        });

        // Apply group states
        Object.entries(state.groups).forEach(([groupId, groupState]) => {
            this.ui.updateGroupCheckbox(groupId, groupState.visible);
        });

        // Set up viewport change listeners
        this._setupViewportPersistence();
    }

    _setupViewportPersistence() {
        if (!this.map) return;

        // Debounce function to prevent too frequent saves
        let saveTimeout;
        const debouncedSave = () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                this.state.setViewport({
                    center: [this.map.getCenter().lng, this.map.getCenter().lat],
                    zoom: this.map.getZoom(),
                    bearing: this.map.getBearing(),
                    pitch: this.map.getPitch()
                });
            }, 500); // Save after 500ms of no movement
        };

        // Listen to map movement events
        this.map.on('moveend', debouncedSave);
        this.map.on('zoomend', debouncedSave);
        this.map.on('rotateend', debouncedSave);
        this.map.on('pitchend', debouncedSave);
    }
}