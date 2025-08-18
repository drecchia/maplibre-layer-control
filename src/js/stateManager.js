/**
 * StateManager - Handles state persistence and events
 * Consolidates EventEmitter and StateStore functionality
 */
class StateManager {
    constructor(config) {
        this.config = config;
        this.events = {}; // EventEmitter functionality
        
        // Core state
        this.currentBaseId = config.defaultBaseId || (config.baseStyles[0]?.id);
        this.previousBaseId = null;
        this.overlayStates = {};
        this.groupStates = {};
        this.layerOrder = [];
        this.viewportState = {
            center: null,
            zoom: null,
            bearing: 0,
            pitch: 0
        };
        this.previousViewportState = {
            center: null,
            zoom: null,
            bearing: 0,
            pitch: 0
        };

        this._initializeStates();
        this._loadPersistedState();
        this._setupPersistenceDebounce();
    }

    // Event system (from EventEmitter)
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

    // Core state access
    get(key) {
        switch (key) {
            case 'base': return this.currentBaseId;
            case 'overlays': return { ...this.overlayStates };
            case 'groups': return { ...this.groupStates };
            case 'viewport': return { ...this.viewportState };
            case 'layerOrder': return [...this.layerOrder];
            default: return this.getAll()[key];
        }
    }

    getAll() {
        return {
            baseId: this.currentBaseId,
            overlays: { ...this.overlayStates },
            groups: { ...this.groupStates },
            layerOrder: [...this.layerOrder],
            viewport: { ...this.viewportState }
        };
    }

    // State setters
    setBase(id) {
        this.previousBaseId = this.currentBaseId;
        this.currentBaseId = id;
        this._debouncedPersist();

        this.emit('basechange', {
            baseId: id,
            previousBaseId: this.previousBaseId
        });
        this.emit('change', this.getAll());
    }

    setOverlayVisibility(id, visible) {
        const previousState = { ...this.overlayStates[id] };
        this.overlayStates[id].visible = visible;

        // Handle layer ordering
        if (visible && !previousState.visible) {
            this._addToLayerOrder(id);
        } else if (!visible && previousState.visible) {
            this._removeFromLayerOrder(id);
        }

        this._debouncedPersist();
        this._emitOverlayChange(id, previousState);
    }

    setOverlayOpacity(id, opacity) {
        const previousState = { ...this.overlayStates[id] };
        this.overlayStates[id].opacity = opacity;
        this._debouncedPersist();
        this._emitOverlayChange(id, previousState);
    }

    setGroupVisibility(id, visible) {
        this.groupStates[id].visible = visible;
        this._debouncedPersist();
        this._emitGroupChange(id);
    }

    setGroupOpacity(id, opacity) {
        this.groupStates[id].opacity = opacity;
        this._debouncedPersist();
        this._emitGroupChange(id);
    }

    reorderLayers(newOrder) {
        this.layerOrder = [...newOrder];
        this._debouncedPersist();
        this.emit('change', this.getAll());
    }

    // Viewport auto-save
    setViewport(viewport) {
        this.previousViewportState = { ...this.viewportState };

        if (viewport.center !== undefined) this.viewportState.center = viewport.center;
        if (viewport.zoom !== undefined) this.viewportState.zoom = viewport.zoom;
        if (viewport.bearing !== undefined) this.viewportState.bearing = viewport.bearing;
        if (viewport.pitch !== undefined) this.viewportState.pitch = viewport.pitch;

        this._debouncedPersist();
        
        this.emit('viewportchange', {
            viewport: { ...this.viewportState },
            previousViewport: this.previousViewportState
        });
        this.emit('change', this.getAll());
    }

    // Persistence
    persist() {
        if (!this.config.persist?.localStorageKey) return;

        try {
            const state = this.getAll();
            localStorage.setItem(this.config.persist.localStorageKey, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to persist layer state:', e);
        }
    }

    clearPersisted() {
        if (!this.config.persist?.localStorageKey) {
            console.warn('No localStorage key configured for persistence');
            return false;
        }

        try {
            localStorage.removeItem(this.config.persist.localStorageKey);
            this.emit('memorycleared', {
                localStorageKey: this.config.persist.localStorageKey
            });
            return true;
        } catch (e) {
            console.error('Failed to clear persisted state:', e);
            return false;
        }
    }

    // Private methods
    _initializeStates() {
        this.config.overlays.forEach(overlay => {
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
        if (!this.config.persist?.localStorageKey) return;

        try {
            const stored = localStorage.getItem(this.config.persist.localStorageKey);
            if (!stored) return;

            const persistedState = JSON.parse(stored);

            // Restore base style
            if (persistedState.baseId) {
                const baseStyleExists = this.config.baseStyles.find(b => b.id === persistedState.baseId);
                if (baseStyleExists) {
                    this.currentBaseId = persistedState.baseId;
                } else {
                    console.warn(`Persisted base style '${persistedState.baseId}' no longer exists`);
                }
            }

            // Restore overlay states
            if (persistedState.overlays) {
                Object.entries(persistedState.overlays).forEach(([overlayId, state]) => {
                    if (this.overlayStates[overlayId]) {
                        Object.assign(this.overlayStates[overlayId], state);
                    }
                });
            }

            // Restore group states
            if (persistedState.groups) {
                Object.entries(persistedState.groups).forEach(([groupId, state]) => {
                    if (this.groupStates[groupId]) {
                        Object.assign(this.groupStates[groupId], state);
                    }
                });
            }

            // Restore layer order
            if (persistedState.layerOrder && Array.isArray(persistedState.layerOrder)) {
                this.layerOrder = persistedState.layerOrder.filter(layerId =>
                    this.overlayStates[layerId]
                );
            }

            // Restore viewport
            if (persistedState.viewport) {
                this.viewportState = {
                    center: persistedState.viewport.center || null,
                    zoom: persistedState.viewport.zoom || null,
                    bearing: persistedState.viewport.bearing || 0,
                    pitch: persistedState.viewport.pitch || 0
                };
            }
        } catch (e) {
            console.warn('Failed to parse persisted layer state:', e);
        }
    }

    _setupPersistenceDebounce() {
        let persistTimeout;
        this._debouncedPersist = () => {
            clearTimeout(persistTimeout);
            persistTimeout = setTimeout(() => {
                this.persist();
            }, 300);
        };
    }

    _addToLayerOrder(overlayId) {
        this._removeFromLayerOrder(overlayId);
        this.layerOrder.push(overlayId);
    }

    _removeFromLayerOrder(overlayId) {
        const index = this.layerOrder.indexOf(overlayId);
        if (index > -1) {
            this.layerOrder.splice(index, 1);
        }
    }

    _emitOverlayChange(id, previousState) {
        this.emit('overlaychange', {
            id,
            visible: this.overlayStates[id].visible,
            opacity: this.overlayStates[id].opacity,
            previousVisible: previousState.visible,
            previousOpacity: previousState.opacity
        });
        this.emit('change', this.getAll());
    }

    _emitGroupChange(groupId) {
        const groupOverlays = this.config.overlays.filter(o => o.group === groupId);
        this.emit('overlaygroupchange', {
            groupId,
            visible: this.groupStates[groupId].visible,
            opacity: this.groupStates[groupId].opacity,
            overlays: groupOverlays.map(o => o.id)
        });
        this.emit('change', this.getAll());
    }
}