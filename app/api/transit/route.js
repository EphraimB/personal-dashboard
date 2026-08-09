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
  let model = 'M7 ELECTRIC';
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
    } else {
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

  const TERMINAL_NAMES = {
    '65': 'FAR ROCKAWAY',
    '349': 'GRAND CENTRAL',
    '102': 'GRAND CENTRAL',
    '105': 'PENN STATION',
    '1': 'PENN STATION',
    '8': 'ATLANTIC TERMINAL',
    '100': 'LONG ISLAND CITY',
    '94': 'JAMAICA'
  };

  try {
    const url = 'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/lirr%2Fgtfs-lirr';
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`MTA Feed responded with HTTP status ${res.status}`);
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
      isLive: true,
      statusNotice: '● LIVE GTFS TELEMETRY',
      westbound,
      eastbound
    };
  } catch (e) {
    console.error('Error fetching/parsing LIRR GTFS-RT feed:', e);
    return {
      station: `${stationName} STATION`,
      branch: 'FAR ROCKAWAY BRANCH',
      isLive: false,
      statusNotice: '● FEED UNAVAILABLE',
      westbound: [],
      eastbound: [],
      error: e.message || 'MTA Feed unavailable'
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

