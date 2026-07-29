import { NextResponse } from 'next/server';

// LIRR Far Rockaway Branch Cedarhurst Station Schedule Engine & NYC Ferry Rockaway Landing Engine

// Cedarhurst LIRR Station Base Schedule Patterns (Minutes past the hour)
// Westbound (to Jamaica / Penn Station / Grand Central Madison): Peak hrs every 20-30 mins, Off-peak every 60 mins.
const LIRR_WESTBOUND_MINS = [12, 42]; 
// Eastbound (to Inwood, Lawrence, Far Rockaway):
const LIRR_EASTBOUND_MINS = [24, 54];

// NYC Ferry Rockaway Route Base Departure Schedule (Minutes past the hour)
// Beach 108th St Landing to Wall St / Pier 11
const FERRY_ROCKAWAY_MINS = [15, 45];

function getUpcomingDepartures(nowDate, minuteArray, destPrimary, destSecondary, lineType) {
  const currentHour = nowDate.getHours();
  const currentMin = nowDate.getMinutes();
  const departures = [];

  // Look ahead over current hour and next 3 hours
  for (let hOffset = 0; hOffset < 4; hOffset++) {
    const targetHour = (currentHour + hOffset) % 24;
    for (const m of minuteArray) {
      if (hOffset === 0 && m <= currentMin) continue; // Past departure

      const depDate = new Date(nowDate);
      depDate.setHours(targetHour, m, 0, 0);
      if (hOffset > 0 && targetHour < currentHour) {
        depDate.setDate(depDate.getDate() + 1);
      }

      const diffMs = depDate.getTime() - nowDate.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));

      if (diffMins < 0) continue;

      let timeStr = depDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      departures.push({
        destination: hOffset % 2 === 0 ? destPrimary : destSecondary,
        timeStr,
        minsUntil: diffMins,
        track: lineType === 'LIRR' ? (destPrimary.includes('PENN') ? 'TRACK 1' : 'TRACK 2') : 'LANDING 1',
        status: diffMins < 4 ? 'BOARDING' : 'ON TIME'
      });

      if (departures.length >= 4) break;
    }
    if (departures.length >= 4) break;
  }

  return departures;
}

export async function GET() {
  try {
    const now = new Date();

    // 1. Fetch or generate live Cedarhurst LIRR Departures
    const lirrWestbound = getUpcomingDepartures(now, LIRR_WESTBOUND_MINS, 'PENN STATION', 'GRAND CENTRAL', 'LIRR');
    const lirrEastbound = getUpcomingDepartures(now, LIRR_EASTBOUND_MINS, 'FAR ROCKAWAY', 'FAR ROCKAWAY', 'LIRR');

    const nextLirr = lirrWestbound[0] || {
      destination: 'PENN STATION',
      timeStr: '05:42 PM',
      minsUntil: 8,
      track: 'TRACK 1',
      status: 'ON TIME'
    };

    // 2. Fetch or generate live NYC Ferry Rockaway Departures
    const ferrySailings = getUpcomingDepartures(now, FERRY_ROCKAWAY_MINS, 'WALL ST / PIER 11', 'SUNSET PARK', 'FERRY');
    const nextFerry = ferrySailings[0] || {
      destination: 'WALL ST / PIER 11',
      timeStr: '05:45 PM',
      minsUntil: 18,
      track: 'BEACH 108TH ST',
      status: 'ON SCHEDULE'
    };

    return NextResponse.json({
      timestamp: now.toISOString(),
      lirr: {
        station: 'CEDARHURST STATION',
        branch: 'FAR ROCKAWAY BRANCH',
        nextDeparture: nextLirr,
        upcomingWestbound: lirrWestbound.slice(1, 3),
        upcomingEastbound: lirrEastbound.slice(0, 2)
      },
      ferry: {
        route: 'ROCKAWAY ROUTE',
        terminal: 'BEACH 108TH ST LANDING',
        nextSailing: nextFerry,
        upcomingSailings: ferrySailings.slice(1, 3),
        seaState: 'CALM (0.5 FT)'
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
