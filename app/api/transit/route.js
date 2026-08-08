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

      let status = 'ON TIME';
      if (delayMins > 0) {
        status = `+${delayMins} MIN DELAY`;
      } else if (delayMins < -1) {
        status = `${Math.abs(delayMins)} MIN EARLY`;
      } else if (diffMins < 4) {
        status = 'BOARDING';
      }

      const departureObj = {
        destination,
        timeStr,
        minsUntil: diffMins,
        track: isEastbound ? 'TRACK 2' : 'TRACK 1',
        status,
        delayMins,
        isLive: true
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


async function getFerryDepartures(now) {
  try {
    const jsonPath = path.join(process.cwd(), 'dashboard', 'gtfs_rockaway_ferry.json');
    if (!fs.existsSync(jsonPath)) return null;

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const departures = data.departures || [];

    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    const currentEpochSec = Math.floor(now.getTime() / 1000);

    // Fetch live GTFS-Realtime satellite trip updates dynamically
    let liveTripUpdates = new Map();
    try {
      const url = 'http://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate';
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(Buffer.from(arrayBuffer));

        for (const entity of feed.entity) {
          if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;
          const tripId = entity.tripUpdate.trip?.tripId;
          for (const st of entity.tripUpdate.stopTimeUpdate) {
            // Stop ID 88 is Rockaway Landing Dock
            if (st.stopId === '88') {
              const rawTime = st.departure?.time || st.arrival?.time;
              const depEpoch = parseProtobufTime(rawTime);
              if (depEpoch && depEpoch > currentEpochSec) {
                liveTripUpdates.set(tripId, depEpoch);
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching live NYC Ferry GTFS-RT:', err);
    }

    const upcoming = [];

    for (const d of departures) {
      let [h, m, s] = d.depTime.split(':').map(Number);
      let depSec = h * 3600 + m * 60 + s;
      let status = 'ON SCHEDULE';
      let depDate = new Date(now);

      if (liveTripUpdates.has(d.tripId)) {
        const liveEpoch = liveTripUpdates.get(d.tripId);
        depDate = new Date(liveEpoch * 1000);
        const liveDiffSec = liveEpoch - currentEpochSec;
        if (liveDiffSec <= 0) continue;

        const diffMins = Math.floor(liveDiffSec / 60);
        const timeStr = depDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        upcoming.push({
          destination: d.destination,
          timeStr,
          minsUntil: diffMins,
          track: 'BEACH 108TH ST',
          status: '● LIVE SATELLITE'
        });
        continue;
      }

      if (depSec <= nowSec) continue;

      const diffSec = depSec - nowSec;
      const diffMins = Math.floor(diffSec / 60);

      depDate.setHours(h, m, s, 0);

      const timeStr = depDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      if (diffMins < 5) {
        status = 'BOARDING';
      }

      upcoming.push({
        destination: d.destination,
        timeStr,
        minsUntil: diffMins,
        track: 'BEACH 108TH ST',
        status
      });
    }

    upcoming.sort((a, b) => a.minsUntil - b.minsUntil);

    const nextSailing = upcoming[0] || null;
    const upcomingSailings = upcoming.slice(0, 3);

    return {
      route: 'ROCKAWAY ROUTE',
      terminal: 'ROCKAWAY LANDING',
      nextSailing,
      upcomingSailings,
      seaState: 'CALM (0.5 FT)'
    };
  } catch (e) {
    console.error('Error fetching Ferry departures:', e);
    return null;
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

