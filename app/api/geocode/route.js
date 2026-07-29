import { NextResponse } from 'next/server';

// Server-side in-memory cache for geocoded locations
const geocodeCache = new Map();

const HOME_LOCATION = {
  lat: 40.6226,
  lon: -73.7275,
  label: '141 Grove Av, Cedarhurst, NY'
};

function sanitizeLocationString(locStr) {
  if (!locStr) return '';
  return locStr
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .split(/\r?\n/)
    .map(line => line.trim().replace(/^[,;\s]+|[,;\s]+$/g, ''))
    .filter(Boolean)
    .join(', ');
}

function extractVirtualEventData(locStr, meetingUrlParam) {
  const raw = (locStr || '').trim();
  const lower = raw.toLowerCase();

  // Extract HTTP or HTTPS URL from location string if not passed directly
  const urlMatch = raw.match(/(https?:\/\/[^\s,;<>"']+)/i);
  let meetingUrl = meetingUrlParam || (urlMatch ? urlMatch[1] : '');

  // ONLY return virtual event QR data if an exact meeting URL (http/https) is present!
  if (!meetingUrl || !meetingUrl.startsWith('http')) {
    return null;
  }

  const urlLower = meetingUrl.toLowerCase();
  let platform = 'WEB';
  let platformName = 'ONLINE MEETING';
  let platformIcon = '🌐';
  let themeColor = '#00F0FF';

  if (urlLower.includes('zoom.us') || lower.includes('zoom')) {
    platform = 'ZOOM';
    platformName = 'ZOOM MEETING';
    platformIcon = '📹';
    themeColor = '#2D8CFF';
  } else if (urlLower.includes('meet.google') || lower.includes('google meet')) {
    platform = 'MEET';
    platformName = 'GOOGLE MEET';
    platformIcon = '🟢';
    themeColor = '#00875A';
  } else if (urlLower.includes('teams.microsoft') || lower.includes('teams')) {
    platform = 'TEAMS';
    platformName = 'MICROSOFT TEAMS';
    platformIcon = '🟦';
    themeColor = '#6264A7';
  } else if (urlLower.includes('webex') || lower.includes('webex')) {
    platform = 'WEBEX';
    platformName = 'WEBEX MEETING';
    platformIcon = '🟣';
    themeColor = '#00E676';
  } else if (urlLower.includes('discord') || lower.includes('discord')) {
    platform = 'DISCORD';
    platformName = 'DISCORD SERVER';
    platformIcon = '💬';
    themeColor = '#5865F2';
  }

  return {
    valid: true,
    isVirtual: true,
    meetingUrl,
    rawLocation: raw,
    platform,
    platformName,
    platformIcon,
    themeColor
  };
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

function formatDurationMinutes(totalMinutes) {
  if (totalMinutes < 1) return '< 1m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

async function fetchTravelTimes(lat1, lon1, lat2, lon2, distMiles) {
  const roadDistMiles = distMiles * 1.25;

  let driveMins = (roadDistMiles / 28) * 60 + 2;
  let walkMins = (roadDistMiles / 3.0) * 60;
  let bikeMins = (roadDistMiles / 11.5) * 60;
  let transitMins = (roadDistMiles / 26) * 60 + 6;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const osrmUrl = `http://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`;
    const res = await fetch(osrmUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data.routes && data.routes.length > 0) {
        const routeSecs = data.routes[0].duration;
        driveMins = routeSecs / 60;
        const routeMiles = data.routes[0].distance / 1609.34;
        walkMins = (routeMiles / 3.0) * 60;
        bikeMins = (routeMiles / 11.5) * 60;
        transitMins = (routeMiles / 26) * 60 + 6;
      }
    }
  } catch (e) {
    // Fallback gracefully on timeout or offline
  }

  return {
    walk: formatDurationMinutes(walkMins),
    bike: formatDurationMinutes(bikeMins),
    transit: formatDurationMinutes(transitMins),
    drive: formatDurationMinutes(driveMins)
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const rawLocation = searchParams.get('location');
  const meetingUrlParam = searchParams.get('meetingUrl') || '';
  const cleanLoc = sanitizeLocationString(rawLocation);

  const cacheKey = `${(cleanLoc || rawLocation || '').toLowerCase()}|${meetingUrlParam.toLowerCase()}`;
  if (cacheKey.trim() !== '|' && geocodeCache.has(cacheKey)) {
    return NextResponse.json(geocodeCache.get(cacheKey));
  }

  // Check if location or meetingUrl contains an exact virtual meeting URL
  const virtualData = extractVirtualEventData(rawLocation || cleanLoc, meetingUrlParam);
  if (virtualData) {
    if (cacheKey.trim() !== '|') geocodeCache.set(cacheKey, virtualData);
    return NextResponse.json(virtualData);
  }

  if (!cleanLoc || !cleanLoc.trim()) {
    return NextResponse.json({ valid: false, reason: 'empty_location' });
  }

  try {
    // Append NY or USA context if location is short to improve OSM Nominatim accuracy in local area
    let queryLocation = cleanLoc;
    if (!queryLocation.toLowerCase().includes('ny') && !queryLocation.toLowerCase().includes('york') && !queryLocation.toLowerCase().includes('usa')) {
      queryLocation = `${cleanLoc}, NY`;
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

    const travelTimes = await fetchTravelTimes(HOME_LOCATION.lat, HOME_LOCATION.lon, destLat, destLon, distMiles);

    const result = {
      valid: true,
      isVirtual: false,
      origin: HOME_LOCATION,
      destination: {
        lat: destLat,
        lon: destLon,
        label: cleanLoc,
        displayName: data[0].display_name
      },
      distanceMiles: Math.round(distMiles * 10) / 10,
      formattedDistance: formattedDist,
      travelTimes
    };

    geocodeCache.set(cacheKey, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error('Geocoding error for location:', cleanLoc, err);
    return NextResponse.json({ valid: false, reason: 'error', message: err.message });
  }
}
