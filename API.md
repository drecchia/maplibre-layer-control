LayersControl API Documentation
Table of Contents
Overview
Installation & Setup
Constructor
Static Methods
Instance Methods
Events
Configuration Options
Data Structures
Examples
Error Handling
Best Practices
Overview

The LayersControl is a comprehensive layer management system for MapLibre GL JS that provides an intuitive interface for managing base maps, overlays, and layer groups. It features state persistence, dynamic loading, opacity controls, and extensive customization options.

Key Features
Base Map Management: Switch between different map styles
Overlay Management: Toggle visibility of data layers
Group Management: Organize overlays into logical groups
State Persistence: Automatic saving/loading of layer states
Dynamic Loading: Support for renderOnClick overlays
Opacity Controls: Fine-grained opacity adjustment
Event System: Comprehensive event notifications
Internationalization: Built-in i18n support
Installation & Setup
// Include the LayersControl script in your HTML
<script src="path/to/layers-control.js"></script>

// Or use it directly in your JavaScript
const layersControl = new LayersControl(options);

Constructor
new LayersControl(options)

Creates a new LayersControl instance.

Parameters:

options (Object): Configuration options

Returns:

LayersControl: New instance

Example:

const layersControl = new LayersControl({
    baseStyles: [...],
    overlays: [...],
    defaultBaseId: 'osm-liberty',
    persist: { localStorageKey: 'my-layers' }
});

Static Methods
LayersControl.getInitialStyle(options)

Determines the initial map style based on configuration and persisted state.

Parameters:

options (Object): Configuration options (subset of constructor options)
baseStyles (Array): Array of base style definitions
defaultBaseId (String, optional): Default base style ID
persist (Object, optional): Persistence configuration

Returns:

String|Object|null: Map style URL/object or null if no style found

Example:

const initialStyle = LayersControl.getInitialStyle({
    baseStyles: [
        { id: 'osm', style: 'https://example.com/osm.json', strategy: 'setStyle' }
    ],
    defaultBaseId: 'osm',
    persist: { localStorageKey: 'my-layers' }
});

const map = new maplibregl.Map({
    container: 'map',
    style: initialStyle || 'https://fallback-style.json'
});

Instance Methods
Map Integration
addTo(map)

Adds the control to a MapLibre map instance.

Parameters:

map (maplibregl.Map): MapLibre map instance

Returns:

LayersControl: Self for method chaining

Example:

layersControl.addTo(map);

remove()

Removes the control from the map and cleans up resources.

Returns:

void

Example:

layersControl.remove();

Base Map Management
setBase(baseId)

Changes the active base map.

Parameters:

baseId (String): ID of the base style to activate

Returns:

void

Events Emitted:

basechange: When base map changes
change: When overall state changes

Example:

layersControl.setBase('satellite');

getCurrentStyle()

Gets the current base map style.

Returns:

String|Object|null: Current style URL/object or null

Example:

const currentStyle = layersControl.getCurrentStyle();
console.log('Current style:', currentStyle);

Overlay Management
toggleOverlay(overlayId, visible, isUserInteraction)

Toggles or sets the visibility of an overlay.

Parameters:

overlayId (String): ID of the overlay
visible (Boolean, optional): Explicit visibility state. If null, toggles current state
isUserInteraction (Boolean, optional): Whether this is a user-initiated action (affects pan behavior)

Returns:

Promise<void>: Resolves when operation completes

Events Emitted:

overlaychange: When overlay visibility changes
loading: When overlay starts loading (for renderOnClick overlays)
error: If overlay fails to load
change: When overall state changes

Example:

// Toggle overlay
await layersControl.toggleOverlay('traffic-flow');

// Explicitly show overlay with user interaction (may trigger pan)
await layersControl.toggleOverlay('weather-radar', true, true);

// Hide overlay
await layersControl.toggleOverlay('poi-restaurants', false);

setOverlayOpacity(overlayId, opacity)

Sets the opacity of an overlay.

Parameters:

overlayId (String): ID of the overlay
opacity (Number): Opacity value between 0.0 and 1.0

Returns:

void

Events Emitted:

overlaychange: When overlay opacity changes
change: When overall state changes

Example:

// Set overlay to 50% opacity
layersControl.setOverlayOpacity('weather-radar', 0.5);

// Make overlay fully transparent
layersControl.setOverlayOpacity('traffic-flow', 0.0);

Group Management
toggleOverlayGroup(groupId, visible, isUserInteraction)

Toggles or sets the visibility of all overlays in a group.

Parameters:

groupId (String): ID of the group
visible (Boolean, optional): Explicit visibility state. If null, toggles current state
isUserInteraction (Boolean, optional): Whether this is a user-initiated action

Returns:

Promise<void>: Resolves when operation completes

Events Emitted:

overlaygroupchange: When group visibility changes
overlaychange: For each overlay in the group
change: When overall state changes

Example:

// Toggle entire POI group
await layersControl.toggleOverlayGroup('Points of Interest');

// Show all overlays in transportation group
await layersControl.toggleOverlayGroup('Transportation', true, true);

setGroupOpacity(groupId, opacity)

Sets the opacity of all overlays in a group.

Parameters:

groupId (String): ID of the group
opacity (Number): Opacity value between 0.0 and 1.0

Returns:

void

Events Emitted:

overlaygroupchange: When group opacity changes
overlaychange: For each overlay in the group
change: When overall state changes

Example:

// Set all POI overlays to 75% opacity
layersControl.setGroupOpacity('Points of Interest', 0.75);

Dynamic Management
addOverlay(overlay)

Dynamically adds a new overlay to the control.

Parameters:

overlay (Object): Overlay definition object

Returns:

void

Example:

layersControl.addOverlay({
    id: 'new-layer',
    label: 'New Data Layer',
    source: {
        id: 'new-source',
        type: 'geojson',
        options: { data: geojsonData }
    },
    layers: [{
        id: 'new-layer-circles',
        type: 'circle',
        paint: { 'circle-color': '#ff0000' }
    }],
    defaultVisible: true,
    opacityControls: true
});

removeOverlay(overlayId)

Dynamically removes an overlay from the control.

Parameters:

overlayId (String): ID of the overlay to remove

Returns:

void

Example:

layersControl.removeOverlay('temporary-layer');

State Management
getState()

Gets the current state of all layers.

Returns:

Object: Current state object

Structure:

{
    baseId: 'current-base-id',
    overlays: {
        'overlay-id': { visible: true, opacity: 0.8 }
    },
    groups: {
        'group-id': { visible: true, opacity: 1.0 }
    }
}


Example:

const currentState = layersControl.getState();
console.log('Current layers state:', currentState);

setState(newState)

Sets the state of layers.

Parameters:

newState (Object): New state object (partial updates supported)

Returns:

void

Events Emitted:

Various events based on what changes (basechange, overlaychange, etc.)

Example:

layersControl.setState({
    baseId: 'satellite',
    overlays: {
        'traffic-flow': { visible: true, opacity: 0.6 }
    }
});

Utility Methods
repositionOverlays()

Repositions all visible overlays to ensure proper z-order (above base map, below labels).

Returns:

void

Example:

// Call after adding custom layers to ensure proper ordering
layersControl.repositionOverlays();

getOverlayBeforeId()

Gets the appropriate layer ID for positioning overlays (typically a label layer).

Returns:

String|undefined: Layer ID to insert overlays before

Example:

const beforeId = layersControl.getOverlayBeforeId();
map.addLayer(customLayer, beforeId);

Events

The LayersControl extends EventEmitter and emits various events during operation.

Event: 'basechange'

Emitted when the base map changes.

Event Data:

{
    baseId: 'new-base-id',
    previousBaseId: 'old-base-id'
}


Example:

layersControl.on('basechange', (data) => {
    console.log(`Base changed from ${data.previousBaseId} to ${data.baseId}`);
});

Event: 'overlaychange'

Emitted when an overlay's visibility or opacity changes.

Event Data:

{
    id: 'overlay-id',
    visible: true,
    opacity: 0.8,
    previousVisible: false,
    previousOpacity: 1.0
}


Example:

layersControl.on('overlaychange', (data) => {
    console.log(`Overlay ${data.id} visibility: ${data.visible}, opacity: ${data.opacity}`);
});

Event: 'overlaygroupchange'

Emitted when a group's visibility or opacity changes.

Event Data:

{
    groupId: 'group-id',
    visible: true,
    opacity: 0.9,
    overlays: ['overlay1', 'overlay2']
}

Event: 'change'

Emitted when any state changes occur. Contains the complete current state.

Event Data:

{
    baseId: 'current-base',
    overlays: { /* overlay states */ },
    groups: { /* group states */ }
}

Event: 'loading'

Emitted when an overlay starts loading (typically for renderOnClick overlays).

Event Data:

{
    id: 'overlay-id'
}

Event: 'error'

Emitted when an overlay fails to load.

Event Data:

{
    id: 'overlay-id',
    error: 'Error message'
}

Configuration Options
Constructor Options
Option	Type	Default	Description
baseStyles	Array	[]	Array of base map definitions
overlays	Array	[]	Array of overlay definitions
groups	Array	[]	Array of group definitions (optional)
defaultBaseId	String	First base style ID	Default base map to use
persist	Object	{localStorageKey: 'ml-layers'}	State persistence configuration
i18n	Function	(key) => key	Internationalization function
onChange	Function	null	Global change callback
autoClose	Boolean	true	Auto-close panel after selection
showOpacity	Boolean	true	Show opacity controls
showLegends	Boolean	true	Show legend controls (future feature)
position	String	'top-right'	Control position on map
icon	String/HTMLElement	'⚏'	Control button icon
Persistence Options
Option	Type	Default	Description
localStorageKey	String	'ml-layers'	localStorage key for state persistence
Data Structures
Base Style Definition
{
    id: 'unique-id',           // Required: Unique identifier
    label: 'Display Name',     // Required: Human-readable name
    style: 'style-url-or-obj', // Required: MapLibre style
    strategy: 'setStyle'       // Required: 'setStyle' or 'toggleBackground'
}

Overlay Definition
{
    id: 'unique-id',           // Required: Unique identifier
    label: 'Display Name',     // Required: Human-readable name
    
    // Static overlay definition
    source: {                  // Optional: Source definition
        id: 'source-id',
        type: 'geojson',       // geojson, vector, raster, image
        options: { /* source options */ }
    },
    layers: [{                 // Optional: Layer definitions
        id: 'layer-id',
        type: 'circle',        // MapLibre layer type
        paint: { /* paint properties */ },
        layout: { /* layout properties */ },
        filter: [ /* filter expression */ ]
    }],
    
    // OR existing layers
    layerIds: ['existing-layer-1', 'existing-layer-2'],
    
    // OR dynamic overlay
    renderOnClick: async () => { // Optional: Dynamic loading function
        return {
            source: { /* source definition */ },
            layers: [ /* layer definitions */ ]
        };
    },
    
    // Optional properties
    group: 'group-name',       // Group membership
    defaultVisible: false,     // Initial visibility
    opacityControls: true,     // Show opacity slider
    panOnAdd: false,          // Pan to overlay when shown
    panZoom: 12,              // Zoom level for pan
    anchor: {                 // Layer positioning
        beforeId: 'layer-id'
    }
}

Group Definition
{
    id: 'group-id',           // Required: Unique identifier
    label: 'Group Name',      // Required: Human-readable name
    type: 'checkbox'          // Optional: UI type
}

Examples
Basic Setup
const layersControl = new LayersControl({
    baseStyles: [
        {
            id: 'osm',
            label: 'OpenStreetMap',
            style: 'https://demotiles.maplibre.org/style.json',
            strategy: 'setStyle'
        }
    ],
    overlays: [
        {
            id: 'traffic',
            label: 'Traffic Flow',
            source: {
                id: 'traffic-source',
                type: 'vector',
                options: { url: 'mapbox://mapbox.mapbox-traffic-v1' }
            },
            layers: [{
                id: 'traffic-lines',
                type: 'line',
                'source-layer': 'traffic',
                paint: { 'line-color': '#ff0000', 'line-width': 2 }
            }],
            opacityControls: true
        }
    ]
});

map.on('load', () => {
    layersControl.addTo(map);
});

Advanced Configuration
const layersControl = new LayersControl({
    baseStyles: [/* base styles */],
    overlays: [/* overlays */],
    defaultBaseId: 'satellite',
    persist: {
        localStorageKey: 'my-app-layers'
    },
    i18n: (key) => {
        const translations = {
            'Base Maps': 'Mapas Base',
            'Overlays': 'Camadas'
        };
        return translations[key] || key;
    },
    onChange: (state) => {
        console.log('Layers changed:', state);
        // Send to analytics, etc.
    },
    autoClose: false,
    showOpacity: true,
    position: 'top-left'
});

Dynamic Overlay with Error Handling
const dynamicOverlay = {
    id: 'weather-data',
    label: 'Live Weather',
    renderOnClick: async () => {
        try {
            const response = await fetch('/api/weather-data');
            const geojson = await response.json();
            
            return {
                source: {
                    id: 'weather-source',
                    type: 'geojson',
                    options: { data: geojson }
                },
                layers: [{
                    id: 'weather-points',
                    type: 'circle',
                    paint: {
                        'circle-color': ['get', 'temperature_color'],
                        'circle-radius': 8
                    }
                }]
            };
        } catch (error) {
            throw new Error(`Failed to load weather data: ${error.message}`);
        }
    },
    opacityControls: true,
    panOnAdd: true
};

layersControl.addOverlay(dynamicOverlay);

Error Handling
Common Error Scenarios
Invalid Overlay ID: When referencing non-existent overlays
Source Loading Failures: Network issues, invalid URLs
RenderOnClick Failures: Dynamic loading errors
Layer Addition Failures: Invalid layer configurations
Error Event Handling
layersControl.on('error', (data) => {
    console.error(`Error with layer ${data.id}:`, data.error);
    
    // Show user-friendly message
    showNotification(`Failed to load ${data.id}: ${data.error}`);
    
    // Optionally retry
    if (data.error.includes('network')) {
        setTimeout(() => {
            layersControl.toggleOverlay(data.id, true, true);
        }, 5000);
    }
});

Validation
// Validate overlay before adding
function validateOverlay(overlay) {
    if (!overlay.id || !overlay.label) {
        throw new Error('Overlay must have id and label');
    }
    
    if (!overlay.source && !overlay.layerIds && !overlay.renderOnClick) {
        throw new Error('Overlay must have source, layerIds, or renderOnClick');
    }
    
    return true;
}

try {
    validateOverlay(newOverlay);
    layersControl.addOverlay(newOverlay);
} catch (error) {
    console.error('Invalid overlay:', error.message);
}

Best Practices
Performance
Use renderOnClick for heavy overlays: Defer loading until needed
Limit concurrent loading: Avoid showing many overlays simultaneously
Optimize source data: Use vector tiles for large datasets
Cache dynamic data: Store renderOnClick results when appropriate
User Experience
Provide loading indicators: Users see feedback during async operations
Handle errors gracefully: Show retry options for failed loads
Use meaningful labels: Clear, descriptive overlay names
Group related overlays: Organize layers logically
State Management
Use persistence: Save user preferences across sessions
Validate state: Check for valid IDs when restoring state
Handle missing layers: Gracefully handle removed overlays
Provide state migration: Handle configuration changes
Code Organization
// Organize overlays by category
const trafficOverlays = [/* traffic-related overlays */];
const weatherOverlays = [/* weather-related overlays */];
const poiOverlays = [/* POI overlays */];

const allOverlays = [
    ...trafficOverlays,
    ...weatherOverlays,
    ...poiOverlays
];

// Use factory functions for similar overlays
function createPOIOverlay(type, data, color) {
    return {
        id: `poi-${type}`,
        label: `${type} Locations`,
        group: 'Points of Interest',
        source: {
            id: `${type}-source`,
            type: 'geojson',
            options: { data }
        },
        layers: [{
            id: `${type}-circles`,
            type: 'circle',
            paint: { 'circle-color': color, 'circle-radius': 6 }
        }],
        opacityControls: true,
        panOnAdd: true
    };
}


This comprehensive API documentation provides all the details needed to effectively use the LayersControl component in MapLibre GL JS applications.