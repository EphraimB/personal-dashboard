import { NextResponse } from 'next/server';

// Server-side in-memory cache for geocoded locations
const geocodeCache = new Map();

const HOME_LOCATION = {
  lat: 40.6226,
  lon: -73.7275,
  label: '141 Grove Av, Cedarhurst, NY'
};

const VIRTUAL_KEYWORDS = [
  'zoom', 'teams', 'meet.google', 'http://', 'https://', 'online', 
  'virtual', 'webinar', 'tbd', 'n/a', 'google calendar', 'phone call', 'discord'
];

function isVirtualLocation(locStr) {
  if (!locStr) return true;
  const lower = locStr.toLowerCase().trim();
  return VIRTUAL_KEYWORDS.some(kw => lower.includes(kw));
}

function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Radius of the Earth in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in miles
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawLocation = searchParams.get('location');

  if (!rawLocation || isVirtualLocation(rawLocation)) {
    return NextResponse.json({ valid: false, reason: 'virtual_or_empty' });
  }

  const cacheKey = rawLocation.trim().toLowerCase();
  if (geocodeCache.has(cacheKey)) {
    return NextResponse.json(geocodeCache.get(cacheKey));
  }

  try {
    // Append NY or USA context if location is short to improve OSM Nominatim accuracy in local area
    let queryLocation = rawLocation;
    if (!queryLocation.toLowerCase().includes('ny') && !queryLocation.toLowerCase().includes('york') && !queryLocation.toLowerCase().includes('usa')) {
      queryLocation = `${rawLocation}, NY`;
    }

    const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryLocation)}&limit=1`;
    const res = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'PersonalDashboard/2.0 (personal-dashboard-app)'
      },
      next: { revalidate: 86400 } // Cache fetch for 24h
    });

    if (!res.ok) {
      throw new Error(`Nominatim returned HTTP ${res.status}`);
    }

    const data = await res.json();
    if (!data || data.length === 0) {
      const result = { valid: false, reason: 'not_found' };
      geocodeCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    const destLat = parseFloat(data[0].lat);
    const destLon = parseFloat(data[0].lon);

    const distMiles = calculateHaversineDistance(HOME_LOCATION.lat, HOME_LOCATION.lon, destLat, destLon);
    const formattedDist = distMiles < 0.1 ? '< 0.1 mi away' : `${distMiles.toFixed(1)} mi away`;

    const result = {
      valid: true,
      origin: HOME_LOCATION,
      destination: {
        lat: destLat,
        lon: destLon,
        label: rawLocation,
        displayName: data[0].display_name
      },
      distanceMiles: Math.round(distMiles * 10) / 10,
      formattedDistance: formattedDist
    };

    geocodeCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Geocoding error for location:', rawLocation, err);
    return NextResponse.json({ valid: false, reason: 'error', message: err.message });
  }
}
