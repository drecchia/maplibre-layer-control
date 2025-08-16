layers-control-refactored.js (~900 LOC total)

1. EventEmitter (40 LOC)
Simple event handling utility for inter-component communication with on(), off(), and emit() methods.

2. StateStore (150 LOC)
Manages all layer states (currentBaseId, overlayStates, groupStates) and handles localStorage persistence. Emits events when state changes occur.

3. OverlayManager (350 LOC)
The only class that touches the MapLibre map object. Handles:

Adding/removing sources and layers
Opacity management for all layer types
renderOnClick async loading with caching
Z-order positioning and repositioning
Base map style switching
Pan-to-overlay functionality
Error handling and loading states

4. UIBuilder (200 LOC)
Manages DOM creation and user interactions:

Creates control button and dropdown panel
Builds base layer radios and overlay checkboxes
Handles opacity sliders and status indicators
Processes user clicks and emits events to facade
Updates UI state based on external changes

5. LayersControl (160 LOC)
Main facade that coordinates all components:

Exposes the same public API as the original
Wires events between StateStore ↔ UIBuilder ↔ OverlayManager
Implements MapLibre control interface (onAdd, onRemove)
Handles initial state application
LayersControl-Documentation.md
Comprehensive documentation covering:

Architecture overview and class responsibilities
Complete public API reference with examples
Configuration options for bases, overlays, and groups
Event system documentation
Migration guide from original monolithic version
Benefits: maintainability, testability, performance, extensibility

Key Benefits of This Refactor:
✅ Single Responsibility - Each class has one clear purpose
✅ Testable - Components can be unit tested in isolation
✅ Maintainable - Changes to UI don't affect map logic
✅ Same Public API - Drop-in replacement for existing code
✅ Better Error Handling - Proper loading states and error recovery
✅ Memory Safe - Proper cleanup prevents memory leaks
✅ Extensible - Easy to add new features to the appropriate class

The refactored version maintains full backward compatibility while providing a much cleaner internal architecture for long-term maintenance and feature development.