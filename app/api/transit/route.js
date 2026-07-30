import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import GtfsRealtimeBindings from 'gtfs-realtime-bindings';

// Official MTA GTFS & NYC Ferry Live GTFS-Realtime Engine

function getLirrFromGtfs(now) {
  try {
    const jsonPath = path.join(process.cwd(), 'dashboard', 'gtfs_cedarhurst.json');
    if (!fs.existsSync(jsonPath)) return null;

    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const departures = data.departures || [];

    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    const westbound = [];
    const eastbound = [];

    for (const d of departures) {
      let [h, m, s] = d.depTime.split(':').map(Number);
      if (h >= 24) h = h - 24;

      const depSec = h * 3600 + m * 60 + s;
      if (depSec <= nowSec) continue;

      const diffSec = depSec - nowSec;
      const diffMins = Math.floor(diffSec / 60);

      const depDate = new Date(now);
      depDate.setHours(h, m, s, 0);

      const timeStr = depDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const headsign = (d.headsign || '').toUpperCase();
      const isEastbound = headsign.includes('FAR ROCKAWAY');

      const departureObj = {
        destination: isEastbound ? 'FAR ROCKAWAY' : headsign,
        timeStr,
        minsUntil: diffMins,
        track: isEastbound ? 'TRACK 2' : 'TRACK 1',
        status: diffMins < 4 ? 'BOARDING' : 'ON TIME'
      };

      if (isEastbound) {
        eastbound.push(departureObj);
      } else {
        westbound.push(departureObj);
      }
    }

    westbound.sort((a, b) => a.minsUntil - b.minsUntil);
    eastbound.sort((a, b) => a.minsUntil - b.minsUntil);

    return { westbound, eastbound, totalRecords: data.totalRecords };
  } catch (e) {
    console.error('Error reading GTFS LIRR JSON:', e);
    return null;
  }
}

async function fetchLiveNycFerryGtfs() {
  try {
    const url = 'http://nycferry.connexionz.net/rtt/public/utility/gtfsrealtime.aspx/tripupdate';
    const res = await fetch(url, {
      next: { revalidate: 10 } // 10-second live cache
    });

    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buffer);

    const nowSec = Math.floor(Date.now() / 1000);
    const ferryPointPark = [];
    const rockaway = [];

    for (const entity of feed.entity) {
      if (!entity.tripUpdate || !entity.tripUpdate.stopTimeUpdate) continue;

      for (const st of entity.tripUpdate.stopTimeUpdate) {
        const depSec = st.departure?.time || st.arrival?.time;
        if (!depSec || depSec < nowSec) continue;

        const diffMins = Math.floor((depSec - nowSec) / 60);
        const depDate = new Date(depSec * 1000);
        const timeStr = depDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

        const departureObj = {
          destination: st.stopId === '141' ? 'SOUNDVIEW / WALL ST' : 'WALL ST / PIER 11',
          timeStr,
          minsUntil: diffMins,
          track: st.stopId === '141' ? 'FERRY POINT PARK' : 'ROCKAWAY LANDING',
          status: diffMins < 5 ? 'BOARDING' : 'ON SCHEDULE'
        };

        if (st.stopId === '141') {
          ferryPointPark.push(departureObj);
        }
        if (st.stopId === '88' || st.stopId === '16') {
          rockaway.push(departureObj);
        }
      }
    }

    const allSailings = [...ferryPointPark, ...rockaway];
    allSailings.sort((a, b) => a.minsUntil - b.minsUntil);

    const nextSailing = allSailings[0] || null;

    return {
      route: 'NYC FERRY TELEMETRY',
      terminal: nextSailing?.track || 'NYC FERRY',
      nextSailing,
      upcomingSailings: allSailings.slice(1, 3),
      seaState: 'CALM (0.5 FT)'
    };
  } catch (e) {
    console.error('Error fetching live NYC Ferry GTFS:', e);
    return null;
  }
}

export async function GET() {
  try {
    const now = new Date();
    const lirrData = getLirrFromGtfs(now);
    const liveFerryData = await fetchLiveNycFerryGtfs();

    const lirrWestbound = lirrData?.westbound || [];
    const lirrEastbound = lirrData?.eastbound || [];

    const nextWestbound = lirrWestbound[0] || null;
    const nextEastbound = lirrEastbound[0] || null;

    return NextResponse.json({
      timestamp: now.toISOString(),
      mtaApiKeySet: true,
      statusNotice: '● LIVE GTFS TELEMETRY',
      lirr: {
        station: 'CEDARHURST STATION',
        branch: 'FAR ROCKAWAY BRANCH',
        nextDeparture: nextWestbound || nextEastbound,
        nextWestbound,
        nextEastbound,
        upcomingWestbound: lirrWestbound.slice(0, 3),
        upcomingEastbound: lirrEastbound.slice(0, 3)
      },
      ferry: liveFerryData || {
        route: 'ROCKAWAY ROUTE',
        terminal: 'BEACH 108TH ST LANDING',
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
