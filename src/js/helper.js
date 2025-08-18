/**
 * BoundsHelper - Static utility class for calculating bounding boxes
 */
class BoundsHelper {
    /**
     * Calculate bounding box from an array of coordinate pairs
     * @param {Array<[number, number]>} points - Array of [lng, lat] coordinate pairs
     * @param {number|Object} padding - Padding around bounds. Can be:
     *   - number: uniform padding for all sides
     *   - object: {top, bottom, left, right} for different padding per side
     * @returns {Array<[number, number]>} Bounding box as [[minLng, minLat], [maxLng, maxLat]]
     */
    static calculateBounds(points, padding = 0) {
        if (!points || !Array.isArray(points) || points.length === 0) {
            throw new Error('Points array is required and must not be empty');
        }

        let minLng = Infinity;
        let minLat = Infinity;
        let maxLng = -Infinity;
        let maxLat = -Infinity;

        // Calculate min/max from all points
        for (const [lng, lat] of points) {
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
        }

        // Apply padding
        let paddingTop, paddingBottom, paddingLeft, paddingRight;
        
        if (typeof padding === 'number') {
            // Uniform padding
            paddingTop = paddingBottom = paddingLeft = paddingRight = padding;
        } else if (typeof padding === 'object' && padding !== null) {
            // Object padding
            paddingTop = padding.top || 0;
            paddingBottom = padding.bottom || 0;
            paddingLeft = padding.left || 0;
            paddingRight = padding.right || 0;
        } else {
            // Invalid padding, use no padding
            paddingTop = paddingBottom = paddingLeft = paddingRight = 0;
        }

        return [
            [minLng - paddingLeft, minLat - paddingBottom],
            [maxLng + paddingRight, maxLat + paddingTop]
        ];
    }
}
