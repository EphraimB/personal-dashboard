import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Helper to safely convert Protobuf 64-bit Long / Object timestamps to JavaScript numbers
function parseProtobufTime(rawTime) {
  if (!rawTime) return 0;
  if (typeof rawTime === 'number') return rawTime;
  if (typeof rawTime === 'string') return parseInt(rawTime, 10);
  if (typeof rawTime === 'object' && rawTime !== null) {
    if (typeof rawTime.toNumber === 'function') return rawTime.toNumber();
    if ('low' in rawTime) return rawTime.low;
  }
  return Number(rawTime) || 0;
}

// Official MTA GTFS & NYC Ferry Dataset Engine

function deriveLirrConsistTelemetry(entity, tripId, st) {
  const vehicleLabel = entity.tripUpdate?.vehicle?.label || entity.tripUpdate?.vehicle?.id || '';
  let model = null;
  let carCount = 8;

  const leadNum = parseInt(vehicleLabel.split('_')[0], 10);
  if (!isNaN(leadNum)) {
    if (leadNum >= 9000 && leadNum < 9800) {
      model = 'M9 ELECTRIC';
      carCount = 8;
    } else if (leadNum >= 9800) {
      model = 'M3 ELECTRIC';
      carCount = 6;
    } else if (leadNum < 1000) {
      model = 'C3 DIESEL';
      carCount = 6;
    } else if (leadNum >= 7000 && leadNum < 9000) {
      model = 'M7 ELECTRIC';
      carCount = 8;
    }
  }

  const rawOccupancy = st?.occupancyStatus ?? entity.tripUpdate?.occupancyStatus ?? entity.vehicle?.occupancyStatus;
  const multiCarriage = entity.tripUpdate?.multiCarriageDetails || entity.vehicle?.multiCarriageDetails;
  const hasOccupancyData = Boolean(rawOccupancy !== undefined || (Array.isArray(multiCarriage) && multiCarriage.length > 0));

  const cars = [];
  for (let i = 0; i < carCount; i++) {
    if (hasOccupancyData) {
      const carriage = Array.isArray(multiCarriage) ? multiCarriage[i] : null;
      let riders = carriage?.occupancyCount ?? 35;
      let crowding = 'light';
      let color = '#00E676';
      if (riders > 80 || carriage?.occupancyStatus === 'STANDING_ROOM_ONLY') {
        crowding = 'heavy';
        color = '#FF1744';
      } else if (riders > 45 || carriage?.occupancyStatus === 'FEW_SEATS_AVAILABLE') {
        crowding = 'moderate';
        color = '#FFD600';
      }
      cars.push({ carIndex: i + 1, riders, crowding, color });
    } else {
      cars.push({
        carIndex: i + 1,
        riders: null,
        crowding: 'unknown',
        color: 'rgba(255, 255, 255, 0.06)'
      });
    }
  }

  return { model, carCount, hasOccupancyData, cars };
}

async function getLiveLirrDepartures(now) {
  const stationId = process.env.LIRR_STATION_ID || '32';
  const stationName = (process.env.LIRR_STATION_NAME || 'CEDARHURST').toUpperCase();
  const currentEpochSec = Math.floor(now.getTime() / 1000);

  const STATION_CODES = {
    '32': 'CHT',
    '65': 'FRY',
    '349': 'GCT',
    '105': 'NYK',
    '8': 'ATL',
    '94': 'JAM'
  };
  const stationCode = STATION_CODES[stationId] || 'CHT';

  const TERMINAL_NAMES = {
    'FRY': 'FAR ROCKAWAY',
    'GCT': 'GRAND CENTRAL',
    'NYK': 'PENN STATION',
    'ATL': 'ATLANTIC TERMINAL',
    'JAM': 'JAMAICA',
    '65': 'FAR ROCKAWAY',
    '349': 'GRAND CENTRAL',
    '105': 'PENN STATION',
    '8': 'ATLANTIC TERMINAL',
    '94': 'JAMAICA'
  };

  try {
    // 1. Primary Engine: Official MTA TrainTime Backend API (backend-unified.mylirr.org)
    const arrivalsUrl = `https://backend-unified.mylirr.org/arrivals/${stationCode}`;
    const res = await fetch(arrivalsUrl, {
      cache: 'no-store',
      headers: {
        'Accept-Version': '3.0',
        'User-Agent': 'Mozilla/5.0'
      }
    });

    if (res.ok) {
      const data = await res.json();
      const rawArrivals = data.arrivals || [];

      // Collect train IDs to batch-fetch consist and per-car passenger loading telemetry
      const trainIds = rawArrivals.map(a => a.train_id).filter(Boolean);
      let locMap = {};

      if (trainIds.length > 0) {
        try {
          const batchUrl = `https://backend-unified.mylirr.org/locations:batch/${trainIds.join(',')}`;
          const batchRes = await fetch(batchUrl, {
            cache: 'no-store',
            headers: {
              'Accept-Version': '3.0',
              'User-Agent': 'Mozilla/5.0'
            }
          });
          if (batchRes.ok) {
            const locs = await batchRes.json();
            if (Array.isArray(locs)) {
              locs.forEach(loc => {
                if (loc.train_id) locMap[loc.train_id] = loc;
              });
            }
          }
        } catch (e) {
          console.error('Error batch fetching LIRR locations:', e.message);
        }
      }

      const westbound = [];
      const eastbound = [];

      for (const arr of rawArrivals) {
        if (!arr.time || arr.time <= currentEpochSec) continue;

        const diffSec = arr.time - currentEpochSec;
        const diffMins = Math.floor(diffSec / 60);

        const depDate = new Date(arr.time * 1000);
        const timeStr = depDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        const isEastbound = arr.direction === 'E';
        const lastStop = arr.stops?.[arr.stops.length - 1];
        let destination = TERMINAL_NAMES[lastStop];
        if (!destination) {
          destination = isEastbound ? 'FAR ROCKAWAY' : 'GRAND CENTRAL';
        }

        const rawOtpSec = typeof arr.status?.otp === 'number' ? arr.status.otp : 0;
        const delaySec = Math.max(0, rawOtpSec);
        const delayMins = delaySec >= 300 ? Math.floor(delaySec / 60) : 0;

        const scheduledEpoch = arr.time - delaySec;
        const scheduledDate = new Date(scheduledEpoch * 1000);
        const scheduledTimeStr = scheduledDate.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });

        let status = 'ON TIME';
        if (delayMins > 0) {
          status = `+${delayMins} MIN DELAY`;
        } else if (diffMins < 4) {
          status = 'BOARDING';
        }

        const loc = locMap[arr.train_id];
        const consist = loc?.consist;

        let model = null;
        if (consist?.fleet) {
          const fleetUpper = consist.fleet.toUpperCase();
          if (fleetUpper.includes('DIESEL')) model = 'C3 DIESEL';
          else if (fleetUpper.includes('M9')) model = 'M9 ELECTRIC';
          else if (fleetUpper.includes('M3')) model = 'M3 ELECTRIC';
          else if (fleetUpper.includes('M7')) model = 'M7 ELECTRIC';
          else model = `${fleetUpper} ELECTRIC`;
        }

        const carCount = consist?.actual_len || 8;

        const hasOccupancyData = Boolean(
          consist &&
          consist.occupancy !== 'NO_DATA' &&
          Array.isArray(consist.cars) &&
          consist.cars.some(c => typeof c.passengers === 'number' || (c.loading && c.loading !== 'NO_DATA'))
        );

        const cars = [];
        if (consist && Array.isArray(consist.cars)) {
          consist.cars.forEach((car, idx) => {
            const riders = typeof car.passengers === 'number' ? car.passengers : null;
            let color = 'rgba(255, 255, 255, 0.06)';
            let crowding = 'unknown';

            if (riders !== null) {
              if (riders > 80 || car.loading === 'HEAVY') {
                color = '#FF1744';
                crowding = 'heavy';
              } else if (riders > 45 || car.loading === 'MODERATE') {
                color = '#FFD600';
                crowding = 'moderate';
              } else {
                color = '#00E676';
                crowding = 'light';
              }
            } else if (car.loading && car.loading !== 'NO_DATA') {
              if (car.loading === 'HEAVY') { color = '#FF1744'; crowding = 'heavy'; }
              else if (car.loading === 'MODERATE') { color = '#FFD600'; crowding = 'moderate'; }
              else { color = '#00E676'; crowding = 'light'; }
            }

            cars.push({
              carIndex: idx + 1,
              carNumber: car.number || null,
              riders,
              loading: car.loading || 'NO_DATA',
              color,
              crowding
            });
          });
        }

        let bikesAllowed = true;
        if (loc?.bike_rule) {
          bikesAllowed = loc.bike_rule === 'PERMITTED';
        } else if (loc?.peak_code) {
          bikesAllowed = loc.peak_code !== 'P';
        } else {
          const depDateObj = new Date(arr.time * 1000);
          const day = depDateObj.getDay();
          const hour = depDateObj.getHours();
          if (day >= 1 && day <= 5) {
            if (isEastbound && (hour >= 16 && hour < 20)) bikesAllowed = false;
            else if (!isEastbound && (hour >= 6 && hour < 10)) bikesAllowed = false;
          }
        }

        const trackLabel = arr.track === 'A' ? 'TRACK 1' : (arr.track === 'B' ? 'TRACK 2' : (arr.track ? `TRACK ${arr.track}` : (isEastbound ? 'TRACK 2' : 'TRACK 1')));

        const departureObj = {
          destination,
          timeStr,
          scheduledTimeStr,
          minsUntil: diffMins,
          track: trackLabel,
          status,
          delayMins,
          isLive: true,
          model,
          carCount,
          hasOccupancyData,
          bikesAllowed,
          cars
        };

        if (isEastbound) {
          eastbound.push(departureObj);
        } else {
          westbound.push(departureObj);
        }
      }

      westbound.sort((a, b) => a.minsUntil - b.minsUntil);
      eastbound.sort((a, b) => a.minsUntil - b.minsUntil);

      return {
        station: `${stationName} STATION`,
        branch: 'FAR ROCKAWAY BRANCH',
        isLive: true,
        statusNotice: '● LIVE TELEMETRY',
        westbound,
        eastbound
      };
    }
  } catch (e) {
    console.error('MTA TrainTime API error, falling back to GTFS-RT:', e.message);
  }

  // Fallback Engine: GTFS-RT feed (api-endpoint.mta.info)
  try {
    const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`MTA GTFS Feed responded with HTTP status ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(Buffer.from(arrayBuffer));

    const westbound = [];
    const eastbound = [];

    for (const entity of feed.entity || []) {
      if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;

      const trip = entity.tripUpdate.trip;
      const stopUpdates = entity.tripUpdate.stopTimeUpdate;

      const st = stopUpdates.find(s => s.stopId === stationId || s.stopId?.startsWith(`${stationId}_`));
      if (!st) continue;

      const rawTime = st.departure?.time || st.arrival?.time;
      const depEpoch = parseProtobufTime(rawTime);
      if (!depEpoch || depEpoch <= currentEpochSec) continue;

      const diffSec = depEpoch - currentEpochSec;
      const diffMins = Math.floor(diffSec / 60);

      const depDate = new Date(depEpoch * 1000);
      const timeStr = depDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const directionId = trip?.directionId ?? 0;
      const isEastbound = directionId === 0;

      const lastStopInTrip = stopUpdates[stopUpdates.length - 1]?.stopId;
      let destination = TERMINAL_NAMES[lastStopInTrip];
      if (!destination) {
        destination = isEastbound ? 'FAR ROCKAWAY' : 'GRAND CENTRAL';
      }

      const rawDelay = st.departure?.delay || st.arrival?.delay || 0;
      const delaySec = typeof rawDelay === 'number' ? rawDelay : parseProtobufTime(rawDelay);
      const delayMins = Math.round(delaySec / 60);

      const scheduledEpoch = depEpoch - delaySec;
      const scheduledDate = new Date(scheduledEpoch * 1000);
      const scheduledTimeStr = scheduledDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      let status = 'ON TIME';
      if (delayMins > 0) {
        status = `+${delayMins} MIN DELAY`;
      } else if (delayMins < -1) {
        status = `${Math.abs(delayMins)} MIN EARLY`;
      } else if (diffMins < 4) {
        status = 'BOARDING';
      }

      const consist = deriveLirrConsistTelemetry(entity, entity.tripUpdate.trip?.tripId, st);

      const depDateObj = new Date(depEpoch * 1000);
      const day = depDateObj.getDay();
      const hour = depDateObj.getHours();
      let bikesAllowed = true;
      if (day >= 1 && day <= 5) {
        if (isEastbound && (hour >= 16 && hour < 20)) bikesAllowed = false;
        else if (!isEastbound && (hour >= 6 && hour < 10)) bikesAllowed = false;
      }

      const departureObj = {
        destination,
        timeStr,
        scheduledTimeStr,
        minsUntil: diffMins,
        track: isEastbound ? 'TRACK 2' : 'TRACK 1',
        status,
        delayMins,
        isLive: true,
        model: consist.model,
        carCount: consist.carCount,
        hasOccupancyData: consist.hasOccupancyData,
        bikesAllowed,
        cars: consist.cars
      };

      if (isEastbound) {
        eastbound.push(departureObj);
      } else {
        westbound.push(departureObj);
      }
    }

    westbound.sort((a, b) => a.minsUntil - b.minsUntil);
    eastbound.sort((a, b) => a.minsUntil - b.minsUntil);

    return {
      station: `${stationName} STATION`,
      branch: 'FAR ROCKAWAY BRANCH',
      nextWestbound: westbound[0] || null,
      nextEastbound: eastbound[0] || null,
      upcomingWestbound: westbound.slice(0, 4),
      upcomingEastbound: eastbound.slice(0, 4),
      isLive: true
    };
  } catch (err) {
    console.error('Error fetching live LIRR departures:', err.message);
    return {
      station: `${stationName} STATION`,
      branch: 'FAR ROCKAWAY BRANCH',
      nextWestbound: null,
      nextEastbound: null,
      upcomingWestbound: [],
      upcomingEastbound: [],
      isLive: false,
      error: err.message
    };
  }
}


let ferryTripMap = null;
function getFerryTripMap() {
  if (!ferryTripMap) {
    try {
      const jsonPath = path.join(process.cwd(), 'dashboard', 'gtfs_ferry_trips.json');
      if (fs.existsSync(jsonPath)) {
        ferryTripMap = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch (e) {
      console.error('Error reading gtfs_ferry_trips.json:', e);
    }
  }
  return ferryTripMap || {};
}

async function getFerryDepartures(now) {
  const stopId = process.env.FERRY_STOP_ID || '88';
  const terminalName = (process.env.FERRY_TERMINAL_NAME || 'ROCKAWAY LANDING').toUpperCase();
  const currentEpochSec = Math.floor(now.getTime() / 1000);
  const tripMap = getFerryTripMap();

  const TERMINAL_NAMES = {
    '19': 'WALL ST / PIER 11',
    '20': 'BATTERY PARK CITY',
    '118': 'WALL ST / PIER 11',
    '112': 'FERRY POINT PARK',
    '113': 'FERRY POINT PARK',
    '114': 'FERRY POINT PARK',
    '115': 'FERRY POINT PARK',
    '87': 'SUNSET PARK'
  };

  try {
    const url = 'https://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`NYC Ferry Feed responded with HTTP status ${res.status}`);
    }

    const arrayBuffer = await res.arrayBuffer();
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(Buffer.from(arrayBuffer));

    const upcoming = [];

    for (const entity of feed.entity || []) {
      if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;

      const tripId = entity.tripUpdate.trip?.tripId;
      const stopUpdates = entity.tripUpdate.stopTimeUpdate;
      const st = stopUpdates.find(s => s.stopId === stopId || s.stopId?.startsWith(`${stopId}_`));

      // Must have valid departure time (pure departures only)
      if (!st || !st.departure?.time) continue;

      const depEpoch = parseProtobufTime(st.departure.time);
      if (!depEpoch || depEpoch <= currentEpochSec) continue;

      const diffSec = depEpoch - currentEpochSec;
      const diffMins = Math.floor(diffSec / 60);

      const depDate = new Date(depEpoch * 1000);
      const timeStr = depDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      let rawDest = tripId ? tripMap[tripId] : null;
      let destination = '';
      if (rawDest) {
        destination = rawDest.replace(/\s*\([^\)]*\)/g, '').replace(/\./g, '').trim().toUpperCase();
      } else {
        const lastStopInTrip = stopUpdates[stopUpdates.length - 1]?.stopId;
        if (lastStopInTrip && lastStopInTrip !== stopId && TERMINAL_NAMES[lastStopInTrip]) {
          destination = TERMINAL_NAMES[lastStopInTrip];
        } else {
          destination = 'WALL ST / PIER 11';
        }
      }



      const rawDelay = st.departure?.delay || 0;
      const delaySec = typeof rawDelay === 'number' ? rawDelay : parseProtobufTime(rawDelay);
      const delayMins = Math.round(delaySec / 60);

      let status = '● LIVE SATELLITE';
      if (delayMins > 1) {
        status = `+${delayMins} MIN DELAY`;
      } else if (diffMins < 5) {
        status = 'BOARDING';
      }

      upcoming.push({
        destination,
        timeStr,
        minsUntil: diffMins,
        track: 'BEACH 108TH ST',
        status,
        delayMins,
        bikesAllowed: true,
        isLive: true
      });
    }

    upcoming.sort((a, b) => a.minsUntil - b.minsUntil);

    const nextSailing = upcoming[0] || null;
    const upcomingSailings = upcoming.slice(0, 4);


    return {
      route: 'ROCKAWAY ROUTE',
      terminal: terminalName,
      isLive: true,
      statusNotice: '● LIVE SATELLITE',
      nextSailing,
      upcomingSailings,
      seaState: 'CALM (0.5 FT)'
    };
  } catch (e) {
    console.error('Error fetching/parsing NYC Ferry GTFS-RT feed:', e);
    return {
      route: 'ROCKAWAY ROUTE',
      terminal: terminalName,
      isLive: false,
      statusNotice: '● FEED UNAVAILABLE',
      nextSailing: null,
      upcomingSailings: [],
      seaState: 'N/A',
      error: e.message || 'NYC Ferry Feed unavailable'
    };
  }
}


export async function GET() {
  try {
    const now = new Date();
    const lirrData = await getLiveLirrDepartures(now);
    const ferryData = await getFerryDepartures(now);

    const lirrWestbound = lirrData?.westbound || [];
    const lirrEastbound = lirrData?.eastbound || [];

    const nextWestbound = lirrWestbound[0] || null;
    const nextEastbound = lirrEastbound[0] || null;

    return NextResponse.json({
      timestamp: now.toISOString(),
      mtaApiKeySet: true,
      statusNotice: lirrData?.statusNotice || '● LIVE GTFS TELEMETRY',
      lirr: {
        station: lirrData?.station || 'CEDARHURST STATION',
        branch: lirrData?.branch || 'FAR ROCKAWAY BRANCH',
        isLive: lirrData?.isLive ?? false,
        nextDeparture: nextWestbound || nextEastbound,
        nextWestbound,
        nextEastbound,
        upcomingWestbound: lirrWestbound.slice(0, 3),
        upcomingEastbound: lirrEastbound.slice(0, 3),
        error: lirrData?.error || null
      },
      ferry: ferryData || {
        route: 'ROCKAWAY ROUTE',
        terminal: 'ROCKAWAY LANDING',
        nextSailing: null,
        upcomingSailings: [],
        seaState: 'N/A'
      }
    });
  } catch (error) {
    console.error('Error in transit API handler:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transit telemetry' },
      { status: 500 }
    );
  }
}

