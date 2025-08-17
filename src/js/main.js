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
        this.previousBaseId = null; // Track previous base for potential restoration
        this.overlayStates = {};
        this.groupStates = {};
        this.layerOrder = []; // Track the order in which layers were added/shown
        this.viewportState = {
            center: null,
            zoom: null,
            bearing: 0,
            pitch: 0
        };
        // Track previous viewport for potential restoration
        this.previousViewportState = {
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
            overlays: {
                ...this.overlayStates
            },
            groups: {
                ...this.groupStates
            },
            layerOrder: [...this.layerOrder], // Include layer order in state
            viewport: {
                ...this.viewportState
            }
        };
    }

    setBase(baseId) {
        this.previousBaseId = this.currentBaseId;
        this.currentBaseId = baseId;
        this._persistState();

        this.emit('basechange', {
            baseId,
            previousBaseId: this.previousBaseId
        });
        this.emit('change', this.getState());
    }

    setOverlay(overlayId, state) {
        const previousState = {
            ...this.overlayStates[overlayId]
        };
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
            visible: this.groupStates[groupId].visible,
            opacity: this.groupStates[groupId].opacity,
            overlays: groupOverlays.map(o => o.id)
        });
        this.emit('change', this.getState());
    }

    setViewport(viewport) {
        this.previousViewportState = {
            ...this.viewportState
        };

        if (viewport.center !== undefined) this.viewportState.center = viewport.center;
        if (viewport.zoom !== undefined) this.viewportState.zoom = viewport.zoom;
        if (viewport.bearing !== undefined) this.viewportState.bearing = viewport.bearing;
        if (viewport.pitch !== undefined) this.viewportState.pitch = viewport.pitch;

        this._persistState();

        this.emit('viewportchange', {
            viewport: {
                ...this.viewportState
            },
            previousViewport: this.previousViewportState
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

    /**
     * Clear all persisted state from localStorage
     * This will remove all saved overlay states, base layer selection, viewport state, etc.
     */
    clearMemory() {
        if (!this.options.persist?.localStorageKey) {
            console.warn('No localStorage key configured for persistence');
            return false;
        }

        try {
            localStorage.removeItem(this.options.persist.localStorageKey);
            console.log(`Cleared persisted state from localStorage key: ${this.options.persist.localStorageKey}`);
            
            // Emit event to notify that memory has been cleared
            this.emit('memorycleared', {
                localStorageKey: this.options.persist.localStorageKey
            });
            
            return true;
        } catch (e) {
            console.error('Failed to clear persisted state:', e);
            return false;
        }
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
        this.zoomFilteredOverlays = new Set(); // Track overlays hidden due to zoom constraints
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
                pickingRadius: 10,
                controller: false,
                getTooltip: this._getTooltip.bind(this)
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

    /**
     * Main tooltip handler for Deck.gl
     */
    _getTooltip(info) {
        if (!info || !info.object || !info.layer) {
            return null;
        }

        const layerId = info.layer.id;
        const pickedObject = info.object;
        
        // Find the overlay that contains this layer
        const overlay = this._findOverlayByLayerId(layerId);
        if (!overlay) {
            return null;
        }

        // Check if overlay has custom tooltip configuration
        if (overlay.getTooltip && typeof overlay.getTooltip === 'function') {
            // Custom tooltip function
            const tooltipData = overlay.getTooltip(pickedObject, info);
            if (tooltipData) {
                return {
                    html: tooltipData.html || this._formatDefaultTooltip(tooltipData),
                    style: tooltipData.style || this._getDefaultTooltipStyle()
                };
            }
        } else if (overlay.tooltip) {
            // Simple tooltip configuration
            return {
                html: this._formatTooltipFromConfig(overlay.tooltip, pickedObject, info),
                style: this._getDefaultTooltipStyle()
            };
        } else if (pickedObject.name) {
            // Fallback to name property
            return {
                html: `<div class="tooltip-content">${pickedObject.name}</div>`,
                style: this._getDefaultTooltipStyle()
            };
        }

        return null;
    }

    /**
     * Helper method to find overlay by layer ID
     */
    _findOverlayByLayerId(layerId) {
        for (const overlay of this.options.overlays) {
            if (overlay.deckLayers) {
                for (const deckLayer of overlay.deckLayers) {
                    if (deckLayer.id === layerId) {
                        return overlay;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Format tooltip from simple configuration
     */
    _formatTooltipFromConfig(tooltipConfig, object, info) {
        if (typeof tooltipConfig === 'string') {
            // Simple property name
            return `<div class="tooltip-content">${object[tooltipConfig] || 'No data'}</div>`;
        } else if (typeof tooltipConfig === 'object') {
            // Configuration object
            let html = '<div class="tooltip-content">';
            
            if (tooltipConfig.title) {
                const title = this._getPropertyValue(object, tooltipConfig.title);
                html += `<div class="tooltip-title">${title}</div>`;
            }
            
            if (tooltipConfig.fields && Array.isArray(tooltipConfig.fields)) {
                html += '<div class="tooltip-fields">';
                tooltipConfig.fields.forEach(field => {
                    if (typeof field === 'string') {
                        const value = this._getPropertyValue(object, field);
                        html += `<div class="tooltip-field"><strong>${field}:</strong> ${value}</div>`;
                    } else if (field.label && field.property) {
                        const value = this._getPropertyValue(object, field.property);
                        html += `<div class="tooltip-field"><strong>${field.label}:</strong> ${value}</div>`;
                    }
                });
                html += '</div>';
            }
            
            html += '</div>';
            return html;
        }
        
        return `<div class="tooltip-content">${object.name || 'No data'}</div>`;
    }

    /**
     * Helper to get property value with dot notation support
     */
    _getPropertyValue(object, propertyPath) {
        if (!propertyPath) return '';
        
        const parts = propertyPath.split('.');
        let value = object;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return '';
            }
        }
        
        return value !== null && value !== undefined ? String(value) : '';
    }

    /**
     * Format default tooltip
     */
    _formatDefaultTooltip(data) {
        if (typeof data === 'string') {
            return `<div class="tooltip-content">${data}</div>`;
        } else if (data.title || data.content) {
            let html = '<div class="tooltip-content">';
            if (data.title) {
                html += `<div class="tooltip-title">${data.title}</div>`;
            }
            if (data.content) {
                html += `<div class="tooltip-body">${data.content}</div>`;
            }
            html += '</div>';
            return html;
        }
        return `<div class="tooltip-content">${JSON.stringify(data)}</div>`;
    }

    /**
     * Default tooltip styling
     */
    _getDefaultTooltipStyle() {
        return {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            maxWidth: '300px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            pointerEvents: 'none',
            zIndex: 1000
        };
    }

    _attachEventListeners() {
        if (!this.map) return;

        this.boundHandlers = {
            onStyleLoad: this._onStyleLoad.bind(this),
            onSourceData: this._onSourceData.bind(this),
            onError: this._onError.bind(this),
            onZoomEnd: this._onZoomEnd.bind(this)
        };

        this.map.on('style.load', this.boundHandlers.onStyleLoad);
        this.map.on('sourcedata', this.boundHandlers.onSourceData);
        this.map.on('error', this.boundHandlers.onError);
        this.map.on('zoomend', this.boundHandlers.onZoomEnd);
    }

    _detachEventListeners() {
        if (!this.map || !this.boundHandlers) return;

        this.map.off('style.load', this.boundHandlers.onStyleLoad);
        this.map.off('sourcedata', this.boundHandlers.onSourceData);
        this.map.off('error', this.boundHandlers.onError);
        this.map.off('zoomend', this.boundHandlers.onZoomEnd);
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

    _onZoomEnd() {
        // Update zoom filtering for all visible overlays when zoom changes
        this.updateAllZoomFiltering();
    }

    /**
     * Check if an overlay should be visible based on zoom constraints
     */
    _checkZoomConstraints(overlay) {
        if (!this.map) return true;
        
        const currentZoom = this.map.getZoom();
        
        if (overlay.minZoomLevel !== undefined && currentZoom < overlay.minZoomLevel) {
            return false;
        }
        
        if (overlay.maxZoomLevel !== undefined && currentZoom >= overlay.maxZoomLevel) {
            return false;
        }
        
        return true;
    }

    /**
     * Check if an overlay should be visible and update zoom filtering status
     */
    _updateZoomFiltering(overlayId) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay) return true;

        const shouldBeVisible = this._checkZoomConstraints(overlay);
        
        if (shouldBeVisible) {
            this.zoomFilteredOverlays.delete(overlayId);
        } else {
            this.zoomFilteredOverlays.add(overlayId);
        }
        
        // Emit event for UI update
        this.emit('zoomfilter', {
            id: overlayId,
            filtered: !shouldBeVisible
        });
        
        return shouldBeVisible;
    }

    /**
     * Check and update zoom filtering for all visible overlays
     */
    updateAllZoomFiltering() {
        if (!this.stateStore) return;
        
        Object.keys(this.stateStore.overlayStates).forEach(overlayId => {
            const state = this.stateStore.overlayStates[overlayId];
            if (state.visible) {
                const overlay = this.options.overlays.find(o => o.id === overlayId);
                if (!overlay) return;
                
                const shouldBeVisible = this._checkZoomConstraints(overlay);
                const isCurrentlyFiltered = this.zoomFilteredOverlays.has(overlayId);
                
                if (shouldBeVisible && isCurrentlyFiltered) {
                    // Should show but was filtered - show it now
                    this.zoomFilteredOverlays.delete(overlayId);
                    this._showOverlayLayers(overlay);
                    this.emit('zoomfilter', { id: overlayId, filtered: false });
                } else if (!shouldBeVisible && !isCurrentlyFiltered) {
                    // Should hide but was visible - hide it now
                    this.zoomFilteredOverlays.add(overlayId);
                    this._hideOverlayLayers(overlay);
                    this.emit('zoomfilter', { id: overlayId, filtered: true });
                }
            }
        });
    }

    /**
     * Show overlay layers (internal method)
     */
    _showOverlayLayers(overlay) {
        if (!overlay) return;
        
        // Add deck.gl layers
        if (overlay.deckLayers && this.deckOverlay) {
            overlay.deckLayers.forEach(deckLayerDef => {
                const layer = this._createDeckLayer(deckLayerDef, overlay);
                if (layer) {
                    this.deckLayers.set(deckLayerDef.id, layer);
                }
            });
            this._updateDeckLayers();
        }
    }

    /**
     * Hide overlay layers (internal method)
     */
    _hideOverlayLayers(overlay) {
        if (!overlay) return;
        
        // Hide deck.gl layers
        if (overlay.deckLayers) {
            overlay.deckLayers.forEach(deckLayerDef => {
                this.deckLayers.delete(deckLayerDef.id);
            });
            this._updateDeckLayers();
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
                this.emit('loading', {
                    id: overlayId
                });

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
                    this.emit('success', {
                        id: overlayId
                    });
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
                overlay = {
                    ...overlay,
                    deckLayers: cachedResult.deckLayers
                };
            }
        }

        // Handle forced base layer (default to true, configurable for programmatic calls)
        const shouldForceBase = isUserInteraction || (overlay.forcedBaseLayerId !== undefined);
        if (shouldForceBase && overlay.forcedBaseLayerId) {
            const targetBaseStyle = this.options.baseStyles.find(b => b.id === overlay.forcedBaseLayerId);
            if (targetBaseStyle) {
                if (this.stateStore.currentBaseId !== overlay.forcedBaseLayerId) {
                    this.setBase(overlay.forcedBaseLayerId);
                    if (this.stateStore) {
                        this.stateStore.setBase(overlay.forcedBaseLayerId);
                    }
                }
            } else {
                console.warn(`Forced base layer '${overlay.forcedBaseLayerId}' for overlay '${overlayId}' not found. Keeping current base layer.`);
            }
        }

        // Handle forced viewport changes (bearing and pitch) - only when showing overlay
        const shouldForceViewport = isUserInteraction || (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined);
        if (shouldForceViewport && (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined)) {
            const viewportChanges = {};
            
            // Always apply forced values if they exist
            if (overlay.forcedBearing !== undefined) {
                viewportChanges.bearing = overlay.forcedBearing;
            }
            if (overlay.forcedPitch !== undefined) {
                viewportChanges.pitch = overlay.forcedPitch;
            }
            
            if (Object.keys(viewportChanges).length > 0) {
                // Use jumpTo for immediate change (no animation to avoid race conditions)
                this.map.jumpTo({
                    ...viewportChanges
                });
                
                // Update state store
                if (this.stateStore) {
                    this.stateStore.setViewport(viewportChanges);
                }
            }
        }

        // Handle pan first if enabled - this might change the zoom level
        if (isUserInteraction && overlay.panOnAdd && overlay.deckLayers) {
            // Increase delay if forced viewport changes were applied to avoid conflicts
            const delay = (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined) ? 300 : 100;
            
            setTimeout(() => {
                this._panToDeckOverlay(overlay);
                // After panning, check zoom constraints again
                setTimeout(() => {
                    this.updateAllZoomFiltering();
                }, 1100); // After pan animation completes
            }, delay);
        }

        // Check zoom constraints before showing layers
        const shouldBeVisible = this._updateZoomFiltering(overlayId);
        
        if (!shouldBeVisible) {
            // Layer is hidden due to zoom constraints, but we still return true
            // because the overlay is "enabled" just filtered by zoom
            return true;
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
                this.emit('success', {
                    id: overlayId
                });
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

        return true;
    }

    hide(overlayId) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay || !this.map) return;

        // Clear zoom filtering state
        this.zoomFilteredOverlays.delete(overlayId);

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
                        const targetZoom = overlay.panZoom || 12;
                        
                        this.map.flyTo({
                            center: [lng, lat],
                            zoom: targetZoom,
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

        this.deckOverlay.setProps({
            layers
        });
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

    /**
     * Remove all overlays from the map
     */
    removeAllOverlays() {
        if (!this.map) return;

        // Get all overlay IDs
        const overlayIds = this.options.overlays.map(overlay => overlay.id);

        // Hide all overlays
        overlayIds.forEach(overlayId => {
            this.hide(overlayId);
        });

        // Clear all deck layers
        this.deckLayers.clear();
        this._updateDeckLayers();

        // Clear all caches and states
        this.loadingOverlays.clear();
        this.errorOverlays.clear();
        this.renderOnClickCache.clear();
        this.renderOnClickLoading.clear();
        this.renderOnClickErrors.clear();
        this.zoomFilteredOverlays.clear();
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
                        statusEl.textContent = '↻';
                        statusEl.style.display = 'inline-block';
                        break;
                    case 'error':
                        statusEl.classList.add('error');
                        statusEl.textContent = '🚨';
                        statusEl.title = 'Click to retry';
                        statusEl.style.display = 'inline-block';
                        statusEl.onclick = () => {
                            this.emit('retryoverlay', {
                                id
                            });
                        };
                        break;
                    case 'zoomfiltered':
                        statusEl.classList.add('zoomfiltered');
                        statusEl.textContent = '⛔';
                        statusEl.title = 'Hidden due to zoom level constraints';
                        statusEl.style.display = 'inline-block';
                        statusEl.onclick = null;
                        break;
                    case 'success':
                        statusEl.textContent = '';
                        statusEl.title = '✅';
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
        const stop = (e) => {
            e.stopPropagation();
        };
        ['click', 'mousedown', 'pointerdown', 'touchstart', 'dblclick', 'keydown'].forEach(evt => {
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
                this.emit('basechange', {
                    id: baseStyle.id
                });
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
        const grouped = {
            ungrouped: []
        };

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

        const hasOpacityControls = overlays.some(o => o.opacityControls);

        // Only use label element if we don't have opacity controls
        // This prevents label click behavior from interfering with the slider
        const labelOrDiv = document.createElement(hasOpacityControls && this.options.showOpacity ? 'div' : 'label');
        labelOrDiv.className = 'overlay-label';
        labelOrDiv.style.display = 'flex';
        labelOrDiv.style.alignItems = 'center';
        labelOrDiv.style.flex = '1';

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = groupId;
        input.id = `group-checkbox-${groupId}`;
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

        const labelText = document.createElement(hasOpacityControls && this.options.showOpacity ? 'label' : 'span');
        labelText.textContent = groupId;
        if (hasOpacityControls && this.options.showOpacity) {
            labelText.setAttribute('for', `group-checkbox-${groupId}`);
            labelText.style.cursor = 'pointer';
            labelText.style.flex = '1';
        }

        labelOrDiv.appendChild(input);
        labelOrDiv.appendChild(labelText);

        const status = document.createElement('div');
        status.className = 'overlay-status';

        labelContainer.appendChild(labelOrDiv);
        labelContainer.appendChild(status);
        item.appendChild(labelContainer);

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

    /**
     * Add a new overlay item to the UI
     */
    addOverlayItem(overlay) {
        if (!this.container) {
            console.warn('UI not built yet, cannot add overlay item');
            return;
        }

        // Ensure we target the overlays section list specifically
        let overlaySection = this.container.querySelector('.overlay-section');
        if (!overlaySection) {
            // Create overlay section on the fly if it doesn't exist
            if (!this.panel) {
                console.warn('Panel not built yet, cannot add overlay item');
                return;
            }
            overlaySection = this._createOverlaySection();
            this.panel.appendChild(overlaySection);
        }
        const overlayList = overlaySection.querySelector('.layers-list');
        if (!overlayList) {
            console.warn('Overlay list not found, cannot add overlay item');
            return;
        }

        // Avoid duplicates: if item exists already, do nothing
        const existing = overlaySection.querySelector(`input[type="checkbox"][value="${overlay.id}"]`);
        if (existing) {
            return;
        }

    const item = this._createOverlayItem(overlay);
        overlayList.appendChild(item);
    }

    /**
     * Remove an overlay item from the UI
     */
    removeOverlayItem(overlayId) {
        if (!this.container) {
            return;
        }

        // Find the overlay item by its input checkbox value
        const overlayInput = this.container.querySelector(`input[value="${overlayId}"]`);
        if (overlayInput) {
            const overlayItem = overlayInput.closest('.overlay-item');
            if (overlayItem && overlayItem.parentNode) {
                overlayItem.parentNode.removeChild(overlayItem);
            }
        }
    }

    /**
     * Remove all overlay items from the UI
     */
    removeAllOverlayItems() {
        if (!this.container) {
            return;
        }

        // Ensure we target the overlays section list specifically
        const overlaySection = this.container.querySelector('.overlay-section');
        if (!overlaySection) {
            return;
        }
        const overlayList = overlaySection.querySelector('.layers-list');
        if (!overlayList) {
            return;
        }
        // Remove all overlay items
        const overlayItems = overlayList.querySelectorAll('.overlay-item');
        overlayItems.forEach(item => {
            if (item.parentNode) {
                item.parentNode.removeChild(item);
            }
        });
    }

    /**
     * Add a new base item to the UI
     */
    _addBaseItem(baseStyle) {
        if (!this.container) {
            console.warn('UI not built yet, cannot add base item');
            return;
        }

        let baseSection = this.container.querySelector('.base-section');
        if (!baseSection) {
            // Create base section on the fly if it doesn't exist
            if (!this.panel) {
                console.warn('Panel not built yet, cannot add base item');
                return;
            }
            baseSection = this._createBaseSection();
            this.panel.insertBefore(baseSection, this.panel.firstChild);
        }

        const baseList = baseSection.querySelector('.layers-list');
        if (!baseList) {
            console.warn('Base layers list not found, cannot add base item');
            return;
        }

        // Avoid duplicates: if item exists already, do nothing
        const existing = baseSection.querySelector(`input[type="radio"][name="base-layer"][value="${baseStyle.id}"]`);
        if (existing) {
            return;
        }

        const item = this._createBaseItem(baseStyle);
        baseList.appendChild(item);
    }

    /**
     * Remove a base item from the UI
     */
    _removeBaseItem(styleId) {
        if (!this.container) {
            return;
        }

        // Find the base item by its radio input value
        const baseInput = this.container.querySelector(`input[name="base-layer"][value="${styleId}"]`);
        if (baseInput) {
            const baseItem = baseInput.closest('.base-item');
            if (baseItem && baseItem.parentNode) {
                baseItem.parentNode.removeChild(baseItem);
            }
        }
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
            // Persistence is disabled by default; enable by passing
            // persist: { localStorageKey: 'your-key' }
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
            ...options
        };

        let persistedBaseId = null;
    if (tempOptions.persist?.localStorageKey) {
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
            ...options
        };

        if (tempOptions.persist?.localStorageKey) {
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
     * Destroy the control completely (alias for remove() for clarity)
     */
    destroy() {
        this.remove();
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

        this.state.setOverlay(overlayId, {
            visible: newVisible
        });
    }

    /**
     * Hide an overlay (keeps it in the overlay list, just makes it invisible)
     */
    hideOverlay(overlayId) {
        return this.toggleOverlay(overlayId, false, false);
    }

    /**
     * Show an overlay (makes it visible if it's in the overlay list)
     */
    showOverlay(overlayId, isUserInteraction = false) {
        return this.toggleOverlay(overlayId, true, isUserInteraction);
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
        this.state.setOverlay(overlayId, {
            opacity
        });
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
            this.state.setOverlay(overlay.id, {
                visible: newVisible
            });
        }

        this.state.setGroup(groupId, {
            visible: newVisible
        });
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
            this.state.setOverlay(overlay.id, {
                opacity
            });
        });

        this.state.setGroup(groupId, {
            opacity
        });
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
            opacity: typeof overlay.defaultOpacity === 'number' ? overlay.defaultOpacity : 1.0
        };

        if (overlay.group && !this.state.groupStates[overlay.group]) {
            this.state.groupStates[overlay.group] = {
                visible: overlay.defaultVisible || false,
                opacity: 1.0
            };
        }

    // Add UI item for the new overlay (ensure section exists)
    this.ui.addOverlayItem(overlay);

        if (overlay.defaultVisible) {
            this.overlayManager.show(overlay.id);
            this.state.setOverlay(overlay.id, {
                visible: true
            });
        }
    }

    /**
     * Remove an overlay completely - hides it if visible, removes from DeckGL, and removes from UI listing
     */
    removeOverlay(overlayId) {
        const overlayIndex = this.options.overlays.findIndex(o => o.id === overlayId);
        if (overlayIndex === -1) {
            console.warn(`Overlay '${overlayId}' not found`);
            return;
        }

        // Hide the overlay if it's currently visible
        if (this.state.overlayStates[overlayId]?.visible) {
            this.overlayManager.hide(overlayId);
        }

        // Remove from options and state
        this.options.overlays.splice(overlayIndex, 1);
        delete this.state.overlayStates[overlayId];

        // Remove the UI item for this overlay
        this.ui.removeOverlayItem(overlayId);

        // Persist the updated state
        this.state._persistState();
    }

    /**
     * Remove all overlays completely - hides all visible overlays, removes from DeckGL, and removes from UI listing
     */
    removeAllOverlays() {
        // Get all overlay IDs before we start removing them
        const overlayIds = [...this.options.overlays.map(overlay => overlay.id)];
        
        if (overlayIds.length === 0) {
            return;
        }

        // Use the dedicated OverlayManager method to clean up all overlays at once
        this.overlayManager.removeAllOverlays();

        // Clear all overlays from options and state
        this.options.overlays = [];
        
        // Clear all overlay states
        overlayIds.forEach(overlayId => {
            delete this.state.overlayStates[overlayId];
        });

        // Remove all overlay UI items
        this.ui.removeAllOverlayItems();

        // Persist the updated state
        this.state._persistState();
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

    /**
     * Add a new base style to the control dynamically
     * If a base style with the same ID exists, it will be replaced
     */
    addBaseStyle(style) {
        if (!style || !style.id) {
            console.warn('Base style must have an id property');
            return;
        }

        // Find existing base style with same ID and replace it, or add new one
        const existingIndex = this.options.baseStyles.findIndex(b => b.id === style.id);
        if (existingIndex !== -1) {
            // Replace existing base style
            this.options.baseStyles[existingIndex] = style;
            // Remove old UI item and add new one
            this.ui._removeBaseItem(style.id);
            this.ui._addBaseItem(style);
        } else {
            // Add new base style
            this.options.baseStyles.push(style);
            // Add new UI item
            this.ui._addBaseItem(style);
        }

        // Keep current selection checked in UI
        if (this.state?.currentBaseId) {
            this.ui.updateBaseRadios(this.state.currentBaseId);
        }
    }

    /**
     * Remove a base style from the control
     * If the removed style is currently active, switches to default or first available base style
     */
    removeBaseStyle(styleId) {
        const baseStyleIndex = this.options.baseStyles.findIndex(b => b.id === styleId);
        if (baseStyleIndex === -1) {
            console.warn(`Base style '${styleId}' not found`);
            return;
        }

        // Remove the base style from options
        this.options.baseStyles.splice(baseStyleIndex, 1);

        // Remove the UI item
    this.ui._removeBaseItem(styleId);

        // Handle case where removed style was currently active
        if (this.state.currentBaseId === styleId) {
            if (this.options.baseStyles.length > 0) {
                // Switch to default base style if available, otherwise first available
                const newBaseId = this.options.defaultBaseId && 
                    this.options.baseStyles.find(b => b.id === this.options.defaultBaseId) 
                    ? this.options.defaultBaseId 
                    : this.options.baseStyles[0].id;
                
                this.setBase(newBaseId);
            } else {
                console.warn('No base styles remaining after removal');
            }
        }
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

        this.overlayManager.on('zoomfilter', (data) => {
            if (data.filtered) {
                this.ui.updateOverlayStatus(data.id, 'zoomfiltered');
            } else {
                this.ui.updateOverlayStatus(data.id, 'success');
            }
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

        // Update zoom filtering for all visible overlays
        this.overlayManager.updateAllZoomFiltering();

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