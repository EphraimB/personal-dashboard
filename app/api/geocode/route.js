import { NextResponse } from 'next/server';

// Server-side in-memory cache for geocoded locations
const geocodeCache = new Map();

const HOME_LOCATION = {
  lat: 40.6253378,
  lon: -73.7206490,
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

  // STRICT RULE: If location is generic text like "Virtual", "Online", "TBD", "N/A" without an explicit URL in the location line, DO NOT generate a false link or QR code!
  const genericTerms = ['virtual', 'online', 'virtual event', 'online event', 'tbd', 'n/a', 'google calendar', 'phone call', 'remote'];
  if (genericTerms.includes(lower)) {
    return null;
  }

  // Extract HTTP or HTTPS URL from location string
  const urlMatchFromLoc = raw.match(/(https?:\/\/[^\s,;<>"']+)/i);
  let meetingUrl = urlMatchFromLoc ? urlMatchFromLoc[1] : (meetingUrlParam && meetingUrlParam.startsWith('http') ? meetingUrlParam : '');

  // REQUIRE a full URL starting with http:// or https:// before generating a QR code!
  if (!meetingUrl || (!meetingUrl.startsWith('http://') && !meetingUrl.startsWith('https://'))) {
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
  if (totalMinutes === null || isNaN(totalMinutes)) return 'N/A';
  if (totalMinutes < 1) return '< 1m';
  const hrs = Math.floor(totalMinutes / 60);
  const mins = Math.round(totalMinutes % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

async function fetchTravelTimes(lat1, lon1, lat2, lon2, distMiles) {
  // Direct pedestrian sidewalk walking speed: ~3.4 mph (17.6 mins/mile)
  let walkMins = (distMiles * 1.1 / 3.4) * 60;
  
  // Bicycle speed: ~12 mph (5 mins/mile)
  let bikeMins = (distMiles * 1.15 / 12) * 60;
  
  // Driving speed in local Cedarhurst / Five Towns: ~22 mph + 1m parking
  let driveMins = (distMiles * 1.25 / 22) * 60 + 1;

  // Realistic Transit Calculation:
  // For short neighborhood walks (< 0.75 mi), public transit is N/A (walking is faster than taking a train/bus)
  let transitMins = null;
  if (distMiles >= 0.75 && distMiles < 2.5) {
    transitMins = Math.min(walkMins * 0.9, 16 + (distMiles / 12) * 60);
  } else if (distMiles >= 2.5 && distMiles < 12.0) {
    // LIRR trip: 8m walk to Cedarhurst station + 8m wait + LIRR ride (38 mph) + 5m destination walk
    const railTime = (distMiles / 38) * 60;
    transitMins = 8 + 8 + railTime + 5;
  } else if (distMiles >= 12.0) {
    // NYC / Regional LIRR trip: 8m station walk + 8m wait + LIRR express (42 mph) + 8m subway transfer
    const railTime = (distMiles / 42) * 60;
    transitMins = 8 + 8 + railTime + 8;
  }

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
        driveMins = (routeSecs / 60) + 1; // Real driving route duration + 1m parking buffer
      }
    }
  } catch (e) {
    // Fallback gracefully
  }

  return {
    walk: formatDurationMinutes(walkMins),
    bike: formatDurationMinutes(bikeMins),
    transit: transitMins !== null ? formatDurationMinutes(transitMins) : 'N/A',
    drive: formatDurationMinutes(driveMins)
  };
}

async function performMultiTierGeocode(cleanLoc) {
  const queryCandidates = [];
  let baseLoc = cleanLoc;
  if (!baseLoc.toLowerCase().includes('ny') && !baseLoc.toLowerCase().includes('york') && !baseLoc.toLowerCase().includes('usa')) {
    baseLoc = `${cleanLoc}, NY`;
  }
  queryCandidates.push(baseLoc);

  // Handle Queens-style hyphenated house numbers (e.g. '90-08 Rockaway Beach Blvd')
  if (/^\d+-\d+/.test(cleanLoc)) {
    const mainBlockNumber = cleanLoc.replace(/^(\d+)-\d+/, '$1');
    const qBlock = mainBlockNumber.toLowerCase().includes('ny') ? mainBlockNumber : `${mainBlockNumber}, NY`;
    queryCandidates.push(qBlock);
  }

  // Street level fallback without house numbers (e.g. 'Rockaway Beach Blvd, Far Rockaway, NY')
  const streetOnly = cleanLoc.replace(/^[\d-]+\s*/, '');
  if (streetOnly && streetOnly !== cleanLoc) {
    const qStreet = streetOnly.toLowerCase().includes('ny') ? streetOnly : `${streetOnly}, NY`;
    queryCandidates.push(qStreet);
  }

  for (const q of queryCandidates) {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
      const res = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'PersonalDashboard/2.0 (personal-dashboard-app)' },
        next: { revalidate: 86400 }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          return data[0];
        }
      }
    } catch (e) {
      // Try next query candidate
    }
  }

  return null;
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

  // Check if location string is non-physical / virtual text (e.g., 'Virtual', 'Online', 'Zoom', 'Teams')
  const lowerLoc = cleanLoc.toLowerCase().trim();
  const nonPhysicalKeywords = [
    'virtual', 'online', 'virtual event', 'online event', 'tbd', 'n/a', 
    'google calendar', 'phone call', 'zoom', 'teams', 'meet', 'webex', 'discord', 'skype', 'remote'
  ];
  const hasUrl = /(https?:\/\/[^\s,;<>"']+)/i.test(cleanLoc) || /(https?:\/\/[^\s,;<>"']+)/i.test(meetingUrlParam);
  
  if (!hasUrl && nonPhysicalKeywords.some(kw => lowerLoc === kw || lowerLoc.startsWith(kw + ' '))) {
    const result = { valid: false, reason: 'non_physical_location' };
    if (cacheKey.trim() !== '|') geocodeCache.set(cacheKey, result);
    return NextResponse.json(result);
  }

  try {
    const match = await performMultiTierGeocode(cleanLoc);
    if (!match) {
      const result = { valid: false, reason: 'not_found' };
      geocodeCache.set(cacheKey, result);
      return NextResponse.json(result);
    }

    const destLat = parseFloat(match.lat);
    const destLon = parseFloat(match.lon);

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
        displayName: match.display_name
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
