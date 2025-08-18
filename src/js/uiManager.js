/**
 * UIManager - Handles UI rendering, interactions, and overlay operations
 * Consolidates UIBuilder and OverlayManager responsibilities
 */
class UIManager {
    constructor(stateManager, options = {}) {
        this.stateManager = stateManager;
        this.options = options;
        
        // Core properties
        this.map = null;
        this.container = null;
        this.deckOverlay = null;
        
        // UI elements
        this.toggle = null;
        this.panel = null;
        this.isOpen = false;
        
        // Overlay management - MATCH OLD PATTERN
        this.deckLayers = new Map(); // Store individual layers by layer ID (not overlay ID)
        this.overlayToLayerIds = new Map(); // Track which layer IDs belong to each overlay
        this.dynamicOverlayCache = new Map();
        this.loadingStates = new Map();
        this.errorStates = new Map();
        this.zoomFilteredOverlays = new Set();
        
        // Bind methods
        this._handleToggleClick = this._handleToggleClick.bind(this);
        this._handleDocumentClick = this._handleDocumentClick.bind(this);
        this._onZoomEnd = this._onZoomEnd.bind(this);
    }

    setMap(map) {
        this.map = map;
        this._initializeDeckOverlay();
        this._attachMapEventListeners();
    }

    _initializeDeckOverlay() {
        if (this.map && !this.deckOverlay) {
            this.deckOverlay = new deck.MapboxOverlay({
                interleaved: true,
                pickingRadius: 10,
                controller: false,
                getTooltip: this._getTooltip.bind(this)
            });
            this.map.addControl(this.deckOverlay);
        }
    }

    _attachMapEventListeners() {
        if (!this.map) return;
        this.map.on('zoomend', this._onZoomEnd);
    }

    _onZoomEnd() {
        this.updateAllZoomFiltering();
    }

    setContainer(container) {
        this.container = container;
    }

    render() {
        if (!this.container) return;
        
        this.container.innerHTML = '';
        
        // Create toggle button
        this.toggle = document.createElement('button');
        this.toggle.className = 'layers-control__toggle';
        this.toggle.innerHTML = this.options.icon || '☰';
        this.toggle.setAttribute('aria-label', 'Toggle layers');
        this.toggle.addEventListener('click', this._handleToggleClick);
        
        // Create panel
        this.panel = document.createElement('div');
        this.panel.className = 'layers-control__panel';
        this.panel.style.display = 'none';
        
        this.container.appendChild(this.toggle);
        this.container.appendChild(this.panel);
        
        this._renderPanelContent();
        this._setupEventDelegation();
    }

    _renderPanelContent() {
        if (!this.panel) return;
        
        this.panel.innerHTML = '';
        
        // Render base layers section
        if (this.options.baseStyles?.length > 0) {
            const baseSection = this._createBaseSection();
            this.panel.appendChild(baseSection);
        }
        
        // Render overlays section
        if (this.options.overlays?.length > 0) {
            const overlaysSection = this._createOverlaysSection();
            this.panel.appendChild(overlaysSection);
        }
    }

    _createBaseSection() {
        const section = document.createElement('div');
        section.className = 'layers-control__base-section';
        
        const title = document.createElement('h3');
        title.className = 'layers-control__section-title';
        title.textContent = this.options.i18n?.baseHeader || 'Base Layers';
        
        const list = document.createElement('div');
        list.className = 'layers-control__base-list';
        
        const currentBase = this.stateManager.get('base');
        
        this.options.baseStyles.forEach(baseStyle => {
            const item = document.createElement('label');
            item.className = 'layers-control__base-item';
            if (baseStyle.id === currentBase) {
                item.classList.add('layers-control__base-item--active');
            }
            
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'base-layer';
            radio.value = baseStyle.id;
            radio.checked = baseStyle.id === currentBase;
            radio.addEventListener('change', () => {
                if (radio.checked) {
                    this.handleBaseChange(baseStyle.id);
                }
            });
            
            const label = document.createElement('span');
            label.textContent = baseStyle.label || baseStyle.id;
            
            item.appendChild(radio);
            item.appendChild(label);
            list.appendChild(item);
        });
        
        section.appendChild(title);
        section.appendChild(list);
        return section;
    }

    _createOverlaysSection() {
        const section = document.createElement('div');
        section.className = 'layers-control__overlays-section';
        
        const title = document.createElement('h3');
        title.className = 'layers-control__section-title';
        title.textContent = this.options.i18n?.overlaysHeader || 'Overlays';
        
        const list = document.createElement('div');
        list.className = 'layers-control__overlays-list';
        
        // Group overlays
        const groups = new Map();
        const ungroupedOverlays = [];
        
        this.options.overlays.forEach(overlay => {
            if (overlay.group) {
                if (!groups.has(overlay.group)) {
                    groups.set(overlay.group, []);
                }
                groups.get(overlay.group).push(overlay);
            } else {
                ungroupedOverlays.push(overlay);
            }
        });
        
        // Render groups
        groups.forEach((overlays, groupId) => {
            const groupElement = this._createGroupElement(groupId, overlays);
            list.appendChild(groupElement);
        });
        
        // Render ungrouped overlays
        ungroupedOverlays.forEach(overlay => {
            const overlayElement = this._createOverlayElement(overlay);
            list.appendChild(overlayElement);
        });
        
        section.appendChild(title);
        section.appendChild(list);
        return section;
    }

    _createGroupElement(groupId, overlays) {
        const group = document.createElement('div');
        group.className = 'layers-control__group';
        
        const header = document.createElement('div');
        header.className = 'layers-control__group-header';
        
        const toggle = document.createElement('label');
        toggle.className = 'layers-control__group-toggle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = groupId;
        const groupState = this.stateManager.get('groups')[groupId];
        checkbox.checked = groupState?.visible || false;
        checkbox.addEventListener('change', () => {
            this.handleToggleGroup(groupId);
        });
        
        const label = document.createElement('span');
        label.textContent = groupId;
        
        toggle.appendChild(checkbox);
        toggle.appendChild(label);
        header.appendChild(toggle);
        
        const overlaysContainer = document.createElement('div');
        overlaysContainer.className = 'layers-control__group-overlays';
        
        overlays.forEach(overlay => {
            const overlayElement = this._createOverlayElement(overlay);
            overlaysContainer.appendChild(overlayElement);
        });
        
        group.appendChild(header);
        group.appendChild(overlaysContainer);
        return group;
    }

    _createOverlayElement(overlay) {
        const item = document.createElement('div');
        item.className = 'layers-control__overlay-item';
        item.dataset.overlayId = overlay.id;
        
        const toggle = document.createElement('label');
        toggle.className = 'layers-control__overlay-toggle';
        
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = overlay.id;
        const overlayState = this.stateManager.get('overlays')[overlay.id];
        checkbox.checked = overlayState?.visible || false;
        checkbox.addEventListener('change', () => {
            this.handleToggleOverlay(overlay.id);
        });
        
        const label = document.createElement('span');
        label.className = 'layers-control__label';
        label.textContent = overlay.label || overlay.id;
        
        const loading = document.createElement('span');
        loading.className = 'layers-control__loading';
        loading.textContent = '⟳';
        loading.style.display = 'none';
        
        toggle.appendChild(checkbox);
        toggle.appendChild(label);
        toggle.appendChild(loading);
        item.appendChild(toggle);
        
        // Add opacity slider if enabled
        if (this.options.showOpacity && overlay.opacityControls) {
            const slider = this._createOpacitySlider(overlay.id, overlayState?.opacity || 1.0);
            item.appendChild(slider);
        }
        
        return item;
    }

    _createOpacitySlider(overlayId, currentOpacity) {
        const sliderContainer = document.createElement('div');
        sliderContainer.className = 'layers-control__opacity-control';
        
        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'layers-control__opacity-slider';
        slider.min = '0';
        slider.max = '1';
        slider.step = '0.1';
        slider.value = currentOpacity;
        
        const label = document.createElement('span');
        label.className = 'layers-control__opacity-label';
        label.textContent = `${Math.round(currentOpacity * 100)}%`;
        
        slider.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            label.textContent = `${Math.round(value * 100)}%`;
            this.handleOpacitySlider(overlayId, value, false);
        });
        
        sliderContainer.appendChild(slider);
        sliderContainer.appendChild(label);
        return sliderContainer;
    }

    _setupEventDelegation() {
        // Document click handler for auto-close
        if (this.options.autoClose) {
            document.addEventListener('click', this._handleDocumentClick);
        }
    }

    _handleToggleClick(e) {
        e.stopPropagation();
        this.isOpen = !this.isOpen;
        this.panel.style.display = this.isOpen ? 'block' : 'none';
        this.panel.classList.toggle('layers-control__panel--open', this.isOpen);
    }

    _handleDocumentClick(e) {
        if (!this.container.contains(e.target)) {
            this.isOpen = false;
            this.panel.style.display = 'none';
            this.panel.classList.remove('layers-control__panel--open');
        }
    }

    // Event Handlers
    handleBaseChange(baseId) {
        this.stateManager.setBase(baseId);
        this._applyBaseToMap(baseId);
        this._updateBaseUI();
    }

    handleToggleOverlay(overlayId) {
        const overlayState = this.stateManager.get('overlays')[overlayId];
        const newVisibility = !overlayState?.visible;
        
        this.stateManager.setOverlayVisibility(overlayId, newVisibility);
        
        if (newVisibility) {
            this._activateOverlay(overlayId, true);
        } else {
            this._deactivateOverlay(overlayId);
        }
        
        this._updateOverlayUI(overlayId);
    }

    handleToggleGroup(groupId) {
        const groupState = this.stateManager.get('groups')[groupId];
        const newVisibility = !groupState?.visible;
        
        this.stateManager.setGroupVisibility(groupId, newVisibility);
        
        // Toggle all overlays in group
        this.options.overlays
            .filter(overlay => overlay.group === groupId)
            .forEach(overlay => {
                this.stateManager.setOverlayVisibility(overlay.id, newVisibility);
                if (newVisibility) {
                    this._activateOverlay(overlay.id, true);
                } else {
                    this._deactivateOverlay(overlay.id);
                }
                this._updateOverlayUI(overlay.id);
            });
        
        this._updateGroupUI(groupId);
    }

    handleOpacitySlider(id, value, isGroup) {
        if (isGroup) {
            this.stateManager.setGroupOpacity(id, value);
            // Apply to all overlays in group
            this.options.overlays
                .filter(overlay => overlay.group === id)
                .forEach(overlay => {
                    this._updateOverlayOpacity(overlay.id, value);
                });
        } else {
            this.stateManager.setOverlayOpacity(id, value);
            this._updateOverlayOpacity(id, value);
        }
    }

    // Tooltip System
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
            const tooltipData = overlay.getTooltip(pickedObject, info);
            if (tooltipData) {
                return {
                    html: tooltipData.html || this._formatDefaultTooltip(tooltipData),
                    style: tooltipData.style || this._getDefaultTooltipStyle()
                };
            }
        } else if (overlay.tooltip) {
            return {
                html: this._formatTooltipFromConfig(overlay.tooltip, pickedObject, info),
                style: this._getDefaultTooltipStyle()
            };
        } else if (pickedObject.name) {
            return {
                html: `<div class="tooltip-content">${pickedObject.name}</div>`,
                style: this._getDefaultTooltipStyle()
            };
        }

        return null;
    }

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

    _formatTooltipFromConfig(tooltipConfig, object, info) {
        if (typeof tooltipConfig === 'string') {
            return `<div class="tooltip-content">${object[tooltipConfig] || 'No data'}</div>`;
        } else if (typeof tooltipConfig === 'object') {
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

    // Zoom Constraints System
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

    _updateZoomFiltering(overlayId) {
        const overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay) return true;

        const shouldBeVisible = this._checkZoomConstraints(overlay);
        
        if (shouldBeVisible) {
            this.zoomFilteredOverlays.delete(overlayId);
        } else {
            this.zoomFilteredOverlays.add(overlayId);
        }
        
        return shouldBeVisible;
    }

    updateAllZoomFiltering() {
        if (!this.map) return;
        
        Object.keys(this.stateManager.get('overlays')).forEach(overlayId => {
            const state = this.stateManager.get('overlays')[overlayId];
            if (state.visible) {
                const overlay = this.options.overlays.find(o => o.id === overlayId);
                if (!overlay) return;
                
                const shouldBeVisible = this._checkZoomConstraints(overlay);
                const isCurrentlyFiltered = this.zoomFilteredOverlays.has(overlayId);
                
                if (shouldBeVisible && isCurrentlyFiltered) {
                    this.zoomFilteredOverlays.delete(overlayId);
                    this._showOverlayLayers(overlay);
                    this._updateOverlayUI(overlayId);
                } else if (!shouldBeVisible && !isCurrentlyFiltered) {
                    this.zoomFilteredOverlays.add(overlayId);
                    this._hideOverlayLayers(overlay);
                    this._updateOverlayUI(overlayId);
                }
            }
        });
    }

    // Map Integration Methods
    _applyBaseToMap(baseId) {
        if (!this.map) return;
        
        const baseStyle = this.options.baseStyles.find(base => base.id === baseId);
        if (!baseStyle) return;
        
        if (baseStyle.style) {
            // Store current visible overlays by layer IDs
            const visibleLayerIds = new Set();
            this.overlayToLayerIds.forEach((layerIds, overlayId) => {
                const overlayState = this.stateManager.get('overlays')[overlayId];
                if (overlayState?.visible) {
                    layerIds.forEach(layerId => visibleLayerIds.add(layerId));
                }
            });
            
            // Remove existing deck overlay
            if (this.deckOverlay) {
                try {
                    this.map.removeControl(this.deckOverlay);
                } catch (e) {
                    console.warn('Error removing deck overlay:', e);
                }
                this.deckOverlay = null;
            }
            
            // Clear layer caches
            this.deckLayers.clear();
            this.overlayToLayerIds.clear();
            
            // Apply new style
            this.map.setStyle(baseStyle.style);
            
            // Wait for style to load, then recreate deck overlay and layers
            this.map.once('styledata', () => {
                setTimeout(() => {
                    this._initializeDeckOverlay();
                    
                    // Restore visible overlays
                    Object.keys(this.stateManager.get('overlays')).forEach(overlayId => {
                        const overlayState = this.stateManager.get('overlays')[overlayId];
                        if (overlayState?.visible) {
                            this._activateOverlay(overlayId, false);
                        }
                    });
                }, 50);
            });
        }
    }

    async _activateOverlay(overlayId, isUserInteraction = false) {
        if (!this.map || !this.deckOverlay) return;
        
        let overlay = this.options.overlays.find(o => o.id === overlayId);
        if (!overlay) return;
        
        this._setLoadingState(overlayId, true);
        
        try {
            // Handle renderOnClick overlays
            if (overlay.renderOnClick) {
                if (!this.dynamicOverlayCache.has(overlayId)) {
                    const context = {
                        map: this.map,
                        overlayManager: this,
                        stateManager: this.stateManager,
                        overlayId: overlayId,
                        overlay: overlay,
                        isUserInteraction: isUserInteraction,
                        deckOverlay: this.deckOverlay,
                        getCurrentViewport: () => ({
                            center: [this.map.getCenter().lng, this.map.getCenter().lat],
                            zoom: this.map.getZoom(),
                            bearing: this.map.getBearing(),
                            pitch: this.map.getPitch()
                        }),
                        getOverlayState: (id) => this.stateManager.get('overlays')[id],
                        getAllOverlayStates: () => this.stateManager.get('overlays')
                    };
                    
                    const result = await overlay.renderOnClick(context);
                    if (!result || !result.deckLayers) {
                        throw new Error('renderOnClick must return {deckLayers}');
                    }
                    
                    this.dynamicOverlayCache.set(overlayId, result);
                }
                
                const cachedResult = this.dynamicOverlayCache.get(overlayId);
                if (cachedResult) {
                    overlay = { ...overlay, deckLayers: cachedResult.deckLayers };
                }
            }
            
            // Handle forced base layer
            const shouldForceBase = isUserInteraction || (overlay.forcedBaseLayerId !== undefined);
            if (shouldForceBase && overlay.forcedBaseLayerId) {
                const targetBaseStyle = this.options.baseStyles.find(b => b.id === overlay.forcedBaseLayerId);
                if (targetBaseStyle) {
                    if (this.stateManager.get('base') !== overlay.forcedBaseLayerId) {
                        this.handleBaseChange(overlay.forcedBaseLayerId);
                    }
                } else {
                    console.warn(`Forced base layer '${overlay.forcedBaseLayerId}' not found.`);
                }
            }
            
            // Handle fitBounds first if enabled
            if (isUserInteraction && overlay.fitBounds) {
                this.map.fitBounds(overlay.fitBounds);
                
                // Apply forced bearing/pitch after fitBounds
                if (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined) {
                    setTimeout(() => {
                        const viewportChanges = {};
                        if (overlay.forcedBearing !== undefined) {
                            viewportChanges.bearing = overlay.forcedBearing;
                        }
                        if (overlay.forcedPitch !== undefined) {
                            viewportChanges.pitch = overlay.forcedPitch;
                        }
                        
                        if (Object.keys(viewportChanges).length > 0) {
                            this.map.jumpTo(viewportChanges);
                        }
                    }, 1000);
                }
            } else {
                // Handle forced viewport changes
                const shouldForceViewport = isUserInteraction || 
                    (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined);
                if (shouldForceViewport && 
                    (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined)) {
                    const viewportChanges = {};
                    
                    if (overlay.forcedBearing !== undefined) {
                        viewportChanges.bearing = overlay.forcedBearing;
                    }
                    if (overlay.forcedPitch !== undefined) {
                        viewportChanges.pitch = overlay.forcedPitch;
                    }
                    
                    if (Object.keys(viewportChanges).length > 0) {
                        this.map.jumpTo(viewportChanges);
                    }
                }
            }
            
            // Handle pan if enabled
            if (isUserInteraction && !overlay.fitBounds && overlay.panOnAdd && overlay.deckLayers) {
                const delay = (overlay.forcedBearing !== undefined || overlay.forcedPitch !== undefined) ? 300 : 100;
                
                setTimeout(() => {
                    this._panToDeckOverlay(overlay);
                    setTimeout(() => {
                        this.updateAllZoomFiltering();
                    }, 1100);
                }, delay);
            }
            
            // Check zoom constraints before showing layers
            const shouldBeVisible = this._updateZoomFiltering(overlayId);
            
            if (!shouldBeVisible) {
                this._setLoadingState(overlayId, false);
                this._updateOverlayUI(overlayId);
                return true;
            }
            
            // Create Deck.GL layers - STORE BY LAYER ID
            if (overlay.deckLayers) {
                const layerIds = [];
                
                overlay.deckLayers.forEach(layerConfig => {
                    const LayerClass = deck[layerConfig.type];
                    if (!LayerClass) {
                        throw new Error(`Unknown layer type: ${layerConfig.type}`);
                    }
                    
                    const overlayState = this.stateManager.get('overlays')[overlayId];
                    const opacity = overlayState?.opacity || 1.0;
                    
                    const layer = new LayerClass({
                        id: layerConfig.id,
                        opacity: opacity,
                        ...layerConfig.props
                    });
                    
                    // Store by layer ID (matching old pattern)
                    this.deckLayers.set(layerConfig.id, layer);
                    layerIds.push(layerConfig.id);
                });
                
                // Track which layer IDs belong to this overlay
                this.overlayToLayerIds.set(overlayId, layerIds);
                
                this._updateDeckOverlay();
            }
            
            this._setLoadingState(overlayId, false);
            this.errorStates.delete(overlayId);
            
        } catch (error) {
            console.error(`Error activating overlay ${overlayId}:`, error);
            this._setLoadingState(overlayId, false);
            this.errorStates.set(overlayId, error.message);
            this._updateOverlayUI(overlayId);
        }
    }

    _deactivateOverlay(overlayId) {
        // Remove layers by their individual IDs
        const layerIds = this.overlayToLayerIds.get(overlayId);
        if (layerIds) {
            layerIds.forEach(layerId => {
                this.deckLayers.delete(layerId);
            });
            this.overlayToLayerIds.delete(overlayId);
        }
        
        this.zoomFilteredOverlays.delete(overlayId);
        this._updateDeckOverlay();
        this._setLoadingState(overlayId, false);
    }

    _showOverlayLayers(overlay) {
        if (!overlay || !overlay.deckLayers) return;
        
        overlay.deckLayers.forEach(deckLayerDef => {
            const layer = this._createDeckLayer(deckLayerDef, overlay);
            if (layer) {
                // Store by layer ID
                this.deckLayers.set(deckLayerDef.id, layer);
            }
        });
        this._updateDeckOverlay();
    }

    _hideOverlayLayers(overlay) {
        if (!overlay || !overlay.deckLayers) return;
        
        overlay.deckLayers.forEach(deckLayerDef => {
            this.deckLayers.delete(deckLayerDef.id);
        });
        this._updateDeckOverlay();
    }

    _createDeckLayer(deckLayerDef, overlay) {
        if (!deck || !this.deckOverlay) return null;

        try {
            const LayerClass = deck[deckLayerDef.type];
            if (!LayerClass) {
                console.error(`Unknown deck.gl layer type: ${deckLayerDef.type}`);
                return null;
            }

            const overlayId = overlay.id;
            const persistedOpacity = this.stateManager.get('overlays')[overlayId]?.opacity;
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

    _updateDeckOverlay() {
        if (!this.deckOverlay) return;

        // Get all layers as array - this matches the old pattern
        const layers = Array.from(this.deckLayers.values());

        this.deckOverlay.setProps({
            layers: layers
        });
    }

    _updateOverlayOpacity(overlayId, opacity) {
        const layerIds = this.overlayToLayerIds.get(overlayId);
        if (!layerIds) return;
        
        layerIds.forEach(layerId => {
            const layer = this.deckLayers.get(layerId);
            if (layer) {
                const updatedLayer = layer.clone({ opacity: opacity });
                this.deckLayers.set(layerId, updatedLayer);
            }
        });
        
        this._updateDeckOverlay();
    }

    // Pan functionality
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

    // UI Update Methods
    _setLoadingState(overlayId, isLoading) {
        this.loadingStates.set(overlayId, isLoading);
        this._updateOverlayUI(overlayId);
    }

    _updateBaseUI() {
        const currentBase = this.stateManager.get('base');
        const baseItems = this.panel?.querySelectorAll('.layers-control__base-item');
        
        baseItems?.forEach(item => {
            const radio = item.querySelector('input[type="radio"]');
            const isActive = radio.value === currentBase;
            radio.checked = isActive;
            item.classList.toggle('layers-control__base-item--active', isActive);
        });
    }

    _updateOverlayUI(overlayId) {
        const overlayItem = this.panel?.querySelector(`[data-overlay-id="${overlayId}"]`);
        if (!overlayItem) return;
        
        const overlayState = this.stateManager.get('overlays')[overlayId];
        const checkbox = overlayItem.querySelector('input[type="checkbox"]');
        const loading = overlayItem.querySelector('.layers-control__loading');
        
        if (checkbox) {
            checkbox.checked = overlayState?.visible || false;
        }
        
        // Determine status
        let status = 'success';
        if (this.loadingStates.get(overlayId)) {
            status = 'loading';
        } else if (this.errorStates.has(overlayId)) {
            status = 'error';
        } else if (this.zoomFilteredOverlays.has(overlayId)) {
            status = 'zoomfiltered';
        }
        
        // Update loading spinner
        if (loading) {
            switch (status) {
                case 'loading':
                    loading.textContent = '↻';
                    loading.style.display = 'inline';
                    loading.classList.add('loadingRotate');
                    loading.title = 'Loading...';
                    break;
                case 'error':
                    loading.textContent = '🚨';
                    loading.style.display = 'inline';
                    loading.classList.remove('loadingRotate');
                    loading.title = 'Error loading overlay';
                    break;
                case 'zoomfiltered':
                    loading.textContent = '🔍';
                    loading.style.display = 'inline';
                    loading.classList.remove('loadingRotate');
                    loading.title = 'Hidden due to zoom level';
                    break;
                default:
                    loading.style.display = 'none';
                    loading.classList.remove('loadingRotate');
                    loading.title = '';
                    break;
            }
        }
        
        // Update item class
        overlayItem.classList.toggle('layers-control__overlay-item--loading', status === 'loading');
        overlayItem.classList.toggle('layers-control__overlay-item--error', status === 'error');
        overlayItem.classList.toggle('layers-control__overlay-item--filtered', status === 'zoomfiltered');
    }

    _updateGroupUI(groupId) {
        const groupElement = this.panel?.querySelector(`input[value="${groupId}"]`);
        if (!groupElement) return;
        
        const groupState = this.stateManager.get('groups')[groupId];
        groupElement.checked = groupState?.visible || false;
    }

    // Public methods
    updateOverlays() {
        this._renderPanelContent();
    }

    updateBaseStyles() {
        this._renderPanelContent();
    }

    addOverlay(overlay) {
        this.options.overlays.push(overlay);
        this.updateOverlays();
    }

    removeOverlay(overlayId) {
        if (this.overlayToLayerIds.has(overlayId)) {
            this._deactivateOverlay(overlayId);
        }
        
        this.options.overlays = this.options.overlays.filter(o => o.id !== overlayId);
        this.dynamicOverlayCache.delete(overlayId);
        this.loadingStates.delete(overlayId);
        this.errorStates.delete(overlayId);
        this.zoomFilteredOverlays.delete(overlayId);
        
        this.updateOverlays();
    }

    removeAllOverlays() {
        this.deckLayers.clear();
        this.overlayToLayerIds.clear();
        this._updateDeckOverlay();
        
        this.dynamicOverlayCache.clear();
        this.loadingStates.clear();
        this.errorStates.clear();
        this.zoomFilteredOverlays.clear();
        
        this.options.overlays = [];
        this.updateOverlays();
    }
}