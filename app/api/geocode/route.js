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

function cleanAddressForGeocode(rawLoc) {
  if (!rawLoc) return '';
  let cleaned = rawLoc
    .replace(/\\n/gi, ' ')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/[•|]/g, ',')
    .replace(/\s+/g, ' ')
    .trim();

  // Extract address starting at house number if present (e.g. 'Temple Israel • 140 Central Ave...')
  const addrMatch = cleaned.match(/(?:\b\d+[-\d]*\s+[A-Za-z0-9\s.,'-]+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Pl|Place|Pkwy|Parkway|Ct|Court)\b[^\n]*)/i);
  if (addrMatch) {
    let extracted = addrMatch[0].trim();
    if (!/\b(ny|new york|nj|ct)\b/i.test(extracted)) {
      extracted = `${extracted}, NY`;
    }
    return extracted;
  }
  return cleaned;
}

function extractVirtualEventData(locStr, meetingUrlParam) {
  const raw = (locStr || '').trim();
  const lower = raw.toLowerCase();

  const genericTerms = ['virtual', 'online', 'virtual event', 'online event', 'tbd', 'n/a', 'google calendar', 'phone call', 'remote'];
  if (genericTerms.includes(lower)) {
    return null;
  }

  const urlMatchFromLoc = raw.match(/(https?:\/\/[^\s,;<>"']+)/i);
  let meetingUrl = urlMatchFromLoc ? urlMatchFromLoc[1] : (meetingUrlParam && meetingUrlParam.startsWith('http') ? meetingUrlParam : '');

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
  let walkMins = (distMiles * 1.1 / 3.4) * 60;
  let bikeMins = (distMiles * 1.15 / 12) * 60;
  let driveMins = (distMiles * 1.25 / 22) * 60 + 1;

  let transitMins = null;
  if (distMiles >= 0.75 && distMiles < 2.5) {
    transitMins = Math.min(walkMins * 0.9, 16 + (distMiles / 12) * 60);
  } else if (distMiles >= 2.5 && distMiles < 12.0) {
    const railTime = (distMiles / 38) * 60;
    transitMins = 8 + 8 + railTime + 5;
  } else if (distMiles >= 12.0) {
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
        driveMins = (routeSecs / 60) + 1;
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

const LOCAL_VENUE_FALLBACKS = {
  'ohel regional family center': { lat: 40.59695, lon: -73.74360, display_name: 'Ohel Regional Family Center, 1-56 Beach 9th St, Far Rockaway, NY 11691' },
  'ohel family center': { lat: 40.59695, lon: -73.74360, display_name: 'Ohel Regional Family Center, 1-56 Beach 9th St, Far Rockaway, NY 11691' },
  'ohel': { lat: 40.59695, lon: -73.74360, display_name: 'Ohel Regional Family Center, 1-56 Beach 9th St, Far Rockaway, NY 11691' },
  'temple avodah': { lat: 40.6385, lon: -73.6521, display_name: 'Temple Avodah, 3050 Oceanside Rd, Oceanside, NY 11572' },
  'temple israel, lawrence': { lat: 40.6174, lon: -73.7296, display_name: 'Temple Israel, 140 Central Ave, Lawrence, NY 11559' },
  'temple israel': { lat: 40.6174, lon: -73.7296, display_name: 'Temple Israel, Lawrence, NY' },
  'chelsea piers field house': { lat: 40.7469, lon: -74.0089, display_name: 'Chelsea Piers Field House, New York, NY 10011' },
  'chelsea piers': { lat: 40.7469, lon: -74.0089, display_name: 'Chelsea Piers, New York, NY' }
};

async function geocodeUSCensus(addressStr) {
  if (!addressStr || !/\d+/.test(addressStr)) return null;
  try {
    const cleanQuery = addressStr.replace(/,?\s*(?:USA|United States)$/i, '').trim();
    const censusUrl = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(cleanQuery)}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(censusUrl, {
      headers: { 'User-Agent': 'PersonalDashboard/2.0 (personal-dashboard-app)' },
      next: { revalidate: 86400 }
    });
    if (res.ok) {
      const data = await res.json();
      const matches = data?.result?.addressMatches || [];
      if (matches.length > 0) {
        const m = matches[0];
        const coords = m.coordinates;
        return {
          lat: coords.y,
          lon: coords.x,
          display_name: m.matchedAddress
        };
      }
    }
  } catch (e) {
    // Continue to next tier
  }
  return null;
}

async function performMultiTierGeocode(cleanLoc) {
  const targetAddress = cleanAddressForGeocode(cleanLoc);

  // TIER 1: US Census Bureau Official Geocoder API (Instant, High-Capacity, High-Precision for US Street Addresses)
  const censusMatch = await geocodeUSCensus(targetAddress || cleanLoc);
  if (censusMatch) {
    return censusMatch;
  }

  // TIER 2: OpenStreetMap Nominatim Search (Fallback for Venue Names / Custom Descriptors)
  const queryCandidates = [];
  queryCandidates.push(cleanLoc);
  if (targetAddress && targetAddress !== cleanLoc) queryCandidates.push(targetAddress);

  let normalizedText = targetAddress || cleanLoc;
  const ordinals = {
    first: '1st', second: '2nd', third: '3rd', fourth: '4th', fifth: '5th',
    sixth: '6th', seventh: '7th', eighth: '8th', ninth: '9th', tenth: '10th'
  };
  for (const [word, digit] of Object.entries(ordinals)) {
    const re = new RegExp(`\\b${word}\\b`, 'gi');
    normalizedText = normalizedText.replace(re, digit);
  }
  normalizedText = normalizedText.replace(/,?\s*(?:Unit|Ste|Suite|Apt|Apartment|Fl|Floor)\s*#?\s*\w+/gi, '').trim();

  const lowerLoc = normalizedText.toLowerCase();
  const hasStateOrCountry = /\b(ny|new york|nj|new jersey|ct|connecticut|usa|united states)\b/i.test(lowerLoc);

  if (!hasStateOrCountry) {
    queryCandidates.push(`${normalizedText}, NY`);
    queryCandidates.push(`${normalizedText}, Nassau County, NY`);
    queryCandidates.push(`${normalizedText}, Long Island, NY`);
  }

  const uniqueCandidates = Array.from(new Set(queryCandidates.filter(Boolean)));
  const allCandidateResults = [];

  for (const q of uniqueCandidates) {
    try {
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&countrycodes=us&viewbox=-74.5,40.4,-73.2,41.2&limit=5`;
      const res = await fetch(nominatimUrl, {
        headers: { 'User-Agent': 'PersonalDashboard/2.0 (personal-dashboard-app)' },
        next: { revalidate: 86400 }
      });
      if (res.ok) {
        const results = await res.json();
        if (results && results.length > 0) {
          for (const item of results) {
            const dist = calculateHaversineDistance(HOME_LOCATION.lat, HOME_LOCATION.lon, parseFloat(item.lat), parseFloat(item.lon));
            allCandidateResults.push({ ...item, dist });
          }
        }
      }
    } catch (e) {
      // Continue candidate loop
    }
  }

  if (allCandidateResults.length > 0) {
    const localMatches = allCandidateResults.filter(r => r.dist <= 60);
    if (localMatches.length > 0) {
      localMatches.sort((a, b) => a.dist - b.dist);
      return localMatches[0];
    }
    allCandidateResults.sort((a, b) => a.dist - b.dist);
    return allCandidateResults[0];
  }

  // TIER 3: Local Venue Fallbacks
  for (const [key, venue] of Object.entries(LOCAL_VENUE_FALLBACKS)) {
    if (lowerLoc === key || lowerLoc.includes(key)) {
      return venue;
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
      // DO NOT permanently cache negative results to allow retries if transient error occurs
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
