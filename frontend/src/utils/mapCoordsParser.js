/**
 * Utility to extract latitude and longitude from Google Maps URLs, 
 * WhatsApp shared location links, or raw coordinate strings.
 */
export const extractCoordsFromInput = (input) => {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Check for raw coordinates: "-16.3988, -71.5369" or "-16.3988 -71.5369"
    const rawMatch = trimmed.match(/^([-+]?\d{1,2}(?:\.\d+)?)[,\s]+([-+]?\d{1,3}(?:\.\d+)?)$/);
    if (rawMatch) {
        const lat = parseFloat(rawMatch[1]);
        const lng = parseFloat(rawMatch[2]);
        if (isValidLatLng(lat, lng)) {
            return { lat, lng };
        }
    }

    // 2. Check for @lat,lng in Google Maps URLs (e.g. /@ -16.398892,-71.536912,17z)
    const atMatch = trimmed.match(/@([-+]?\d{1,2}(?:\.\d+)?),([-+]?\d{1,3}(?:\.\d+)?)/);
    if (atMatch) {
        const lat = parseFloat(atMatch[1]);
        const lng = parseFloat(atMatch[2]);
        if (isValidLatLng(lat, lng)) {
            return { lat, lng };
        }
    }

    // 3. Check for ?q=lat,lng or ?q=loc:lat,lng or &ll=lat,lng
    const queryMatch = trimmed.match(/[?&](?:q=(?:loc:)?|ll=)([-+]?\d{1,2}(?:\.\d+)?)[,%2C]([-+]?\d{1,3}(?:\.\d+)?)/i);
    if (queryMatch) {
        const lat = parseFloat(queryMatch[1]);
        const lng = parseFloat(queryMatch[2]);
        if (isValidLatLng(lat, lng)) {
            return { lat, lng };
        }
    }

    // 4. Check for destination=lat,lng or center=lat,lng
    const paramMatch = trimmed.match(/[?&](?:destination|center|origin)=([-+]?\d{1,2}(?:\.\d+)?)[,%2C]([-+]?\d{1,3}(?:\.\d+)?)/i);
    if (paramMatch) {
        const lat = parseFloat(paramMatch[1]);
        const lng = parseFloat(paramMatch[2]);
        if (isValidLatLng(lat, lng)) {
            return { lat, lng };
        }
    }

    return null;
};

export const isValidLatLng = (lat, lng) => {
    return (
        typeof lat === 'number' &&
        !Number.isNaN(lat) &&
        typeof lng === 'number' &&
        !Number.isNaN(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180
    );
};
