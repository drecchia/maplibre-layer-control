/**
 * LayersControl - Main facade class that integrates StateManager and UIManager
 * Implements MapLibre control interface and provides public API
 */
class LayersControl {
    constructor(options = {}) {
        this.options = {
            // Default configuration
            // persist: { localStorageKey: 'layersControlState' },
            showOpacity: true,
            autoClose: false,
            icon: '☰',
            i18n: {
                baseHeader: 'Base Layers',
                overlaysHeader: 'Overlays'
            },
            ...options
        };

        // Validate required configuration
        if (!this.options.baseStyles || !Array.isArray(this.options.baseStyles)) {
            throw new Error('LayersControl requires baseStyles array');
        }
        if (!this.options.overlays || !Array.isArray(this.options.overlays)) {
            throw new Error('LayersControl requires overlays array');
        }

        // Core components
        this.stateManager = new StateManager(this.options);
        this.uiManager = new UIManager(this.stateManager, this.options);
        
        // MapLibre properties
        this.map = null;
        this.container = null;
        
        // Viewport auto-save setup
        this.viewportSaveTimeout = null;
        this.mapEventHandlers = new Map();
        
        this._setupPublicEventForwarding();
    }

    // MapLibre Control Interface
    onAdd(map) {
        this.map = map;
        
        // Create container element
        this.container = document.createElement('div');
        this.container.className = 'maplibregl-ctrl maplibregl-ctrl-group layers-control-container';
        
        // Connect components
        this.uiManager.setMap(map);
        this.uiManager.setContainer(this.container);
        
        // Initial render
        this.uiManager.render();
        
        // Setup map event listeners for viewport auto-save
        this._setupMapEventListeners();
        
        // Apply persisted state to map
        this._restoreMapState();
        
        return this.container;
    }

    onRemove() {
        // Cleanup map event listeners
        this._cleanupMapEventListeners();
        
        // Remove container
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
        
        // Clear references
        this.map = null;
        this.container = null;
        this.uiManager.setMap(null);
        this.uiManager.setContainer(null);
    }

    // State Control API
    setBaseLayer(id) {
        const baseExists = this.options.baseStyles.find(base => base.id === id);
        if (!baseExists) {
            console.warn(`Base layer '${id}' not found`);
            return false;
        }
        
        this.stateManager.setBase(id);
        this._applyBaseToMap(id);
        return true;
    }

    // Overlay Management
    addOverlay(overlayConfig, fireOverlayCallback = false) {
        if (!overlayConfig.id) {
            throw new Error('Overlay config must have an id');
        }
        
        // Check if overlay already exists
        const existingIndex = this.options.overlays.findIndex(o => o.id === overlayConfig.id);
        if (existingIndex > -1) {
            // Update existing overlay
            this.options.overlays[existingIndex] = { ...this.options.overlays[existingIndex], ...overlayConfig };
        } else {
            // Add new overlay
            this.options.overlays.push(overlayConfig);
        }
        
        // Initialize state for new overlay in StateManager's internal state
        if (!this.stateManager.overlayStates[overlayConfig.id]) {
            this.stateManager.overlayStates[overlayConfig.id] = {
                visible: overlayConfig.defaultVisible || false,
                opacity: overlayConfig.defaultOpacity || 1.0
            };
        }
        
        // Handle groups
        if (overlayConfig.group) {
            if (!this.stateManager.groupStates[overlayConfig.group]) {
                this.stateManager.groupStates[overlayConfig.group] = {
                    visible: overlayConfig.defaultVisible || false,
                    opacity: 1.0
                };
            }
        }
        
        // If defaultVisible is true, activate the overlay on the map
        if (overlayConfig.defaultVisible) {
            this.uiManager._activateOverlay(overlayConfig.id);
            
            // Call onChecked callback if provided and fireOverlayCallback is true
            if (fireOverlayCallback && typeof overlayConfig.onChecked === 'function') {
                this.uiManager._callOverlayCallback(overlayConfig.onChecked, overlayConfig.id, overlayConfig, false);
            }
        }
        
        // Re-render UI
        this.uiManager.updateOverlays();
        
        return true;
    }

    removeOverlay(id, fireOverlayCallback = false) {
        // Find and remove from config
        const overlayIndex = this.options.overlays.findIndex(o => o.id === id);
        if (overlayIndex === -1) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        const overlay = this.options.overlays[overlayIndex];
        
        // Deactivate if currently active
        const overlayState = this.stateManager.get('overlays')[id];
        if (overlayState?.visible) {
            // Call onUnchecked callback if provided and fireOverlayCallback is true
            if (fireOverlayCallback && typeof overlay.onUnchecked === 'function') {
                this.uiManager._callOverlayCallback(overlay.onUnchecked, id, overlay, false);
            }
            
            // Deactivate overlay without triggering additional callbacks
            this.stateManager.setOverlayVisibility(id, false);
            this.uiManager._deactivateOverlay(id);
            this.uiManager._updateOverlayUI(id);
        }
        
        // Remove from configuration
        this.options.overlays.splice(overlayIndex, 1);
        
        // Remove from state
        const allOverlays = this.stateManager.get('overlays');
        delete allOverlays[id];
        
        // Remove from layer order
        const layerOrder = this.stateManager.get('layerOrder');
        const orderIndex = layerOrder.indexOf(id);
        if (orderIndex > -1) {
            layerOrder.splice(orderIndex, 1);
        }
        
        // Re-render UI
        this.uiManager.updateOverlays();
        
        return true;
    }

    removeAllOverlays() {
        // Get all overlay IDs
        const overlayIds = this.options.overlays.map(o => o.id);
        
        // Deactivate all visible overlays
        overlayIds.forEach(id => {
            const overlayState = this.stateManager.get('overlays')[id];
            if (overlayState?.visible) {
                this.hideOverlay(id);
            }
        });
        
        // Clear configuration
        this.options.overlays = [];
        
        // Clear state
        this.stateManager.overlayStates = {};
        this.stateManager.groupStates = {};
        this.stateManager.layerOrder = [];
        
        // Clear UI manager caches
        this.uiManager.deckLayers.clear();
        this.uiManager.dynamicOverlayCache.clear();
        this.uiManager.loadingStates.clear();
        this.uiManager.errorStates.clear();
        
        // Re-render UI
        this.uiManager.updateOverlays();
        
        // Emit change event
        this.stateManager.emit('change', this.stateManager.getAll());
        
        return true;
    }

    updateOverlay(id, updates) {
        const overlayIndex = this.options.overlays.findIndex(o => o.id === id);
        if (overlayIndex === -1) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        // Update configuration
        this.options.overlays[overlayIndex] = { ...this.options.overlays[overlayIndex], ...updates };
        
        // Clear dynamic cache if renderOnClick changed
        if (updates.renderOnClick) {
            this.uiManager.dynamicOverlayCache.delete(id);
        }
        
        // Re-render UI
        this.uiManager.updateOverlays();
        
        return true;
    }

    getOverlay(id) {
        const overlay = this.options.overlays.find(o => o.id === id);
        if (!overlay) return null;
        
        const state = this.stateManager.get('overlays')[id];
        return {
            ...overlay,
            visible: state?.visible || false,
            opacity: state?.opacity || 1.0
        };
    }

    // Visibility Controls
    showOverlay(id, fireOverlayCallback = false) {
        const overlay = this.options.overlays.find(o => o.id === id);
        if (!overlay) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        this.stateManager.setOverlayVisibility(id, true);
        this.uiManager._activateOverlay(id);
        this.uiManager._updateOverlayUI(id);
        
        // Call onChecked callback if provided and fireOverlayCallback is true
        if (fireOverlayCallback && typeof overlay.onChecked === 'function') {
            this.uiManager._callOverlayCallback(overlay.onChecked, id, overlay, false);
        }
        
        return true;
    }

    hideOverlay(id, fireOverlayCallback = false) {
        const overlay = this.options.overlays.find(o => o.id === id);
        if (!overlay) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        this.stateManager.setOverlayVisibility(id, false);
        this.uiManager._deactivateOverlay(id);
        this.uiManager._updateOverlayUI(id);
        
        // Call onUnchecked callback if provided and fireOverlayCallback is true
        if (fireOverlayCallback && typeof overlay.onUnchecked === 'function') {
            this.uiManager._callOverlayCallback(overlay.onUnchecked, id, overlay, false);
        }
        
        return true;
    }

    toggleOverlayVisibility(id) {
        const overlayState = this.stateManager.get('overlays')[id];
        if (!overlayState) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        if (overlayState.visible) {
            return this.hideOverlay(id);
        } else {
            return this.showOverlay(id);
        }
    }

    // Group Controls
    showGroup(id) {
        const hasGroupOverlays = this.options.overlays.some(o => o.group === id);
        if (!hasGroupOverlays) {
            console.warn(`Group '${id}' not found or has no overlays`);
            return false;
        }
        
        this.stateManager.setGroupVisibility(id, true);
        this.uiManager.handleToggleGroup(id);
        return true;
    }

    hideGroup(id) {
        const hasGroupOverlays = this.options.overlays.some(o => o.group === id);
        if (!hasGroupOverlays) {
            console.warn(`Group '${id}' not found or has no overlays`);
            return false;
        }
        
        this.stateManager.setGroupVisibility(id, false);
        
        // Deactivate all overlays in group
        this.options.overlays
            .filter(overlay => overlay.group === id)
            .forEach(overlay => {
                this.stateManager.setOverlayVisibility(overlay.id, false);
                this.uiManager._deactivateOverlay(overlay.id);
                this.uiManager._updateOverlayUI(overlay.id);
            });
        
        this.uiManager._updateGroupUI(id);
        return true;
    }

    toggleGroupVisibility(id) {
        const groupState = this.stateManager.get('groups')[id];
        if (!groupState) {
            console.warn(`Group '${id}' not found`);
            return false;
        }
        
        if (groupState.visible) {
            return this.hideGroup(id);
        } else {
            return this.showGroup(id);
        }
    }

    // Opacity Controls
    setOverlayOpacity(id, value) {
        const overlay = this.options.overlays.find(o => o.id === id);
        if (!overlay) {
            console.warn(`Overlay '${id}' not found`);
            return false;
        }
        
        const clampedValue = Math.max(0, Math.min(1, parseFloat(value)));
        this.stateManager.setOverlayOpacity(id, clampedValue);
        this.uiManager.handleOpacitySlider(id, clampedValue, false);
        return true;
    }

    setGroupOpacity(id, value) {
        const hasGroupOverlays = this.options.overlays.some(o => o.group === id);
        if (!hasGroupOverlays) {
            console.warn(`Group '${id}' not found or has no overlays`);
            return false;
        }
        
        const clampedValue = Math.max(0, Math.min(1, parseFloat(value)));
        this.stateManager.setGroupOpacity(id, clampedValue);
        this.uiManager.handleOpacitySlider(id, clampedValue, true);
        return true;
    }

    // Layer Ordering
    bringOverlayToFront(id) {
        const layerOrder = [...this.stateManager.get('layerOrder')];
        const index = layerOrder.indexOf(id);
        
        if (index > -1) {
            layerOrder.splice(index, 1); // Remove from current position
        }
        layerOrder.push(id); // Add to end (front)
        
        this.stateManager.reorderLayers(layerOrder);
        return true;
    }

    sendOverlayToBack(id) {
        const layerOrder = [...this.stateManager.get('layerOrder')];
        const index = layerOrder.indexOf(id);
        
        if (index > -1) {
            layerOrder.splice(index, 1); // Remove from current position
        }
        layerOrder.unshift(id); // Add to beginning (back)
        
        this.stateManager.reorderLayers(layerOrder);
        return true;
    }

    reorderOverlays(orderedIds) {
        if (!Array.isArray(orderedIds)) {
            console.warn('reorderOverlays requires an array of overlay IDs');
            return false;
        }
        
        // Validate all IDs exist
        const validIds = orderedIds.filter(id => 
            this.options.overlays.some(o => o.id === id)
        );
        
        if (validIds.length !== orderedIds.length) {
            console.warn('Some overlay IDs in reorderOverlays were not found');
        }
        
        this.stateManager.reorderLayers(validIds);
        return true;
    }

    // Viewport Controls
    saveCurrentViewport() {
        if (!this.map) {
            console.warn('Map not available for viewport save');
            return false;
        }
        
        const viewport = {
            center: this.map.getCenter(),
            zoom: this.map.getZoom(),
            bearing: this.map.getBearing(),
            pitch: this.map.getPitch()
        };
        
        this.stateManager.setViewport(viewport);
        return true;
    }

    applySavedViewport() {
        const savedViewport = this.stateManager.get('viewport');
        if (!this.map || !savedViewport.center) {
            console.warn('No saved viewport or map not available');
            return false;
        }
        
        this.map.jumpTo({
            center: savedViewport.center,
            zoom: savedViewport.zoom,
            bearing: savedViewport.bearing || 0,
            pitch: savedViewport.pitch || 0
        });
        
        return true;
    }

    // Persistence
    clearPersistedData() {
        return this.stateManager.clearPersisted();
    }

    // Events
    on(event, callback) {
        this.stateManager.on(event, callback);
        return this;
    }

    off(event, callback) {
        this.stateManager.off(event, callback);
        return this;
    }

    // State Access
    getCurrentState() {
        return this.stateManager.getAll();
    }

    getBaseLayers() {
        const currentBase = this.stateManager.get('base');
        return this.options.baseStyles.map(base => ({
            ...base,
            active: base.id === currentBase
        }));
    }

    getOverlays() {
        const overlayStates = this.stateManager.get('overlays');
        return this.options.overlays.map(overlay => ({
            ...overlay,
            visible: overlayStates[overlay.id]?.visible || false,
            opacity: overlayStates[overlay.id]?.opacity || 1.0
        }));
    }

    getGroups() {
        const groupStates = this.stateManager.get('groups');
        const groups = new Map();
        
        this.options.overlays.forEach(overlay => {
            if (overlay.group && !groups.has(overlay.group)) {
                const groupConfig = this.options.groups?.find(g => g.id === overlay.group);
                groups.set(overlay.group, {
                    id: overlay.group,
                    label: groupConfig?.label || overlay.group,
                    visible: groupStates[overlay.group]?.visible || false,
                    opacity: groupStates[overlay.group]?.opacity || 1.0,
                    overlays: []
                });
            }
        });
        
        // Add overlays to their groups
        this.options.overlays.forEach(overlay => {
            if (overlay.group && groups.has(overlay.group)) {
                groups.get(overlay.group).overlays.push(overlay.id);
            }
        });
        
        return Array.from(groups.values());
    }

    // Private methods
    _setupPublicEventForwarding() {
        // Forward all StateManager events as public events
        ['change', 'basechange', 'overlaychange', 'overlaygroupchange', 'viewportchange', 'memorycleared']
            .forEach(eventType => {
                this.stateManager.on(eventType, (data) => {
                    // Events are already emitted by StateManager, no need to re-emit
                });
            });
    }

    _setupMapEventListeners() {
        if (!this.map) return;
        
        // Viewport auto-save on moveend
        const handleMoveEnd = () => {
            // Debounce viewport saves
            clearTimeout(this.viewportSaveTimeout);
            this.viewportSaveTimeout = setTimeout(() => {
                this.saveCurrentViewport();
            }, 500);
        };
        
        // Store handlers for cleanup
        this.mapEventHandlers.set('moveend', handleMoveEnd);
        
        // Add listeners
        this.map.on('moveend', handleMoveEnd);
    }

    _cleanupMapEventListeners() {
        if (!this.map || this.mapEventHandlers.size === 0) return;
        
        // Remove all stored event listeners
        this.mapEventHandlers.forEach((handler, eventType) => {
            this.map.off(eventType, handler);
        });
        
        this.mapEventHandlers.clear();
        
        // Clear debounce timeout
        if (this.viewportSaveTimeout) {
            clearTimeout(this.viewportSaveTimeout);
            this.viewportSaveTimeout = null;
        }
    }

    _restoreMapState() {
        if (!this.map) return;
        
        // Apply saved base layer
        const currentBase = this.stateManager.get('base');
        if (currentBase) {
            this._applyBaseToMap(currentBase);
        }
        
        // Apply saved viewport
        const savedViewport = this.stateManager.get('viewport');
        if (savedViewport.center) {
            // Use setTimeout to ensure map is fully initialized
            setTimeout(() => {
                this.applySavedViewport();
            }, 100);
        }
        
        // Activate visible overlays
        const overlayStates = this.stateManager.get('overlays');
        Object.entries(overlayStates).forEach(([overlayId, state]) => {
            if (state.visible) {
                // Use setTimeout to ensure proper initialization order
                setTimeout(() => {
                    this.uiManager._activateOverlay(overlayId);
                }, 200);
            }
        });
    }

    _applyBaseToMap(baseId) {
        if (!this.map) return;
        
        const baseStyle = this.options.baseStyles.find(base => base.id === baseId);
        if (!baseStyle) return;
        
        // Apply base style to map
        if (baseStyle.style) {
            this.map.setStyle(baseStyle.style);
        }
    }
}
