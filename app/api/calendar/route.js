import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helper to format Date object into YYYY-MM-DD
function formatDateISO(date) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Helper to format Date object into 12-hour time string "9:30 AM"
function formatTimeString(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Generate realistic default / sample schedule for today and rest of week
function generateSampleSchedule() {
  const now = new Date();
  
  // Today's events relative to current time
  const t1 = new Date(now.getTime() + 35 * 60 * 1000); // 35 mins from now (UP NEXT)
  const t1End = new Date(t1.getTime() + 45 * 60 * 1000);
  
  const t2 = new Date(now.getTime() + 3 * 3600 * 1000); // 3 hours from now
  const t2End = new Date(t2.getTime() + 60 * 60 * 1000);
  
  const t3 = new Date(now.getTime() + 7 * 3600 * 1000); // 7 hours from now
  const t3End = new Date(t3.getTime() + 90 * 60 * 1000);

  const todayStr = formatDateISO(now);

  const upNext = {
    id: 'sample-next-1',
    title: 'Connect to a Google Calendar',
    startTime: formatTimeString(t1),
    endTime: formatTimeString(t1End),
    startRaw: t1.toISOString(),
    endRaw: t1End.toISOString(),
    location: 'Run ./scripts/google-calendar-login.sh or paste iCal URL',
    category: 'Setup Needed',
    icon: '⚡',
    isUpNext: true
  };

  const todayEvents = [
    {
      id: 'sample-today-2',
      title: 'Connect to a Google Calendar',
      startTime: formatTimeString(t2),
      endTime: formatTimeString(t2End),
      startRaw: t2.toISOString(),
      endRaw: t2End.toISOString(),
      location: 'Settings Modal',
      category: 'Setup',
      icon: '📌'
    },
    {
      id: 'sample-today-3',
      title: 'Connect to a Google Calendar',
      startTime: formatTimeString(t3),
      endTime: formatTimeString(t3End),
      startRaw: t3.toISOString(),
      endRaw: t3End.toISOString(),
      location: 'Settings Modal',
      category: 'Setup',
      icon: '📌'
    }
  ];

  // Generate Rest of Week days (next 5 days)
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weekDays = [];

  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateStr = formatDateISO(d);
    const dayName = dayNames[d.getDay()];

    const dayEvents = [
      {
        id: `sample-w-${i}-1`,
        title: 'Connect to a Google Calendar',
        time: '10:00 AM',
        location: 'Settings Modal',
        category: 'Setup',
        icon: '📌'
      },
      {
        id: `sample-w-${i}-2`,
        title: 'Connect to a Google Calendar',
        time: '02:30 PM',
        location: 'Settings Modal',
        category: 'Setup',
        icon: '📌'
      }
    ];

    weekDays.push({
      dateStr,
      dayName,
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      events: dayEvents
    });
  }

  return {
    todayStr,
    upNext,
    todayEvents,
    weekDays
  };
}

// Robust iCal Date Parser (Local Time)
function parseICalDate(dtStr) {
  if (!dtStr) return null;
  const clean = dtStr.replace(/[^0-9T]/g, '');
  if (clean.length >= 8) {
    const yyyy = parseInt(clean.substring(0, 4), 10);
    const mm = parseInt(clean.substring(4, 6), 10) - 1;
    const dd = parseInt(clean.substring(6, 8), 10);
    let hh = 0, min = 0, ss = 0;
    if (clean.length >= 13 && clean.includes('T')) {
      const tIdx = clean.indexOf('T');
      hh = parseInt(clean.substring(tIdx + 1, tIdx + 3), 10) || 0;
      min = parseInt(clean.substring(tIdx + 3, tIdx + 5), 10) || 0;
      ss = parseInt(clean.substring(tIdx + 5, tIdx + 7), 10) || 0;
    }
    // Create Date object in local time
    return new Date(yyyy, mm, dd, hh, min, ss);
  }
  return null;
}

// Simple iCal parser for ICS feeds (Filters out past events from yesterday and previous years)
function parseICS(icsText) {
  const rawEvents = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.title) {
        rawEvents.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('DTSTART:')) {
        currentEvent.dtStartRaw = line.substring(8);
      } else if (line.startsWith('DTSTART;')) {
        const parts = line.split(':');
        if (parts.length > 1) currentEvent.dtStartRaw = parts[1];
      }
    }
  }

  // Filter & sort: Only keep events starting from today onwards!
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  const futureEvents = rawEvents
    .map((e) => {
      const parsedDate = parseICalDate(e.dtStartRaw);
      return {
        ...e,
        startDateObj: parsedDate,
        startTime: parsedDate ? formatTimeString(parsedDate) : 'Today'
      };
    })
    .filter((e) => e.startDateObj && e.startDateObj.getTime() >= startOfToday.getTime())
    .sort((a, b) => (a.startDateObj?.getTime() || 0) - (b.startDateObj?.getTime() || 0));

  return futureEvents;
}

function buildCalendarResponse(eventsList, sourceName) {
  if (!eventsList || eventsList.length === 0) {
    return {
      success: true,
      isConnected: false,
      source: sourceName,
      upNext: null,
      todayEvents: [],
      weekDays: []
    };
  }

  const first = eventsList[0];
  const upNext = {
    id: first.id || 'evt-next-1',
    title: first.title || 'Untitled Event',
    startTime: first.startTime || 'Upcoming',
    endTime: first.endTime || '',
    location: first.location || 'Google Calendar',
    category: 'Google Event',
    icon: '⚡',
    isUpNext: true
  };

  const todayEvents = eventsList.slice(1, 4).map((it, idx) => ({
    id: it.id || `evt-today-${idx}`,
    title: it.title || 'Calendar Event',
    startTime: it.startTime || 'Scheduled',
    endTime: it.endTime || '',
    location: it.location || 'Google Calendar',
    category: 'Event',
    icon: '📌'
  }));

  const now = new Date();
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weekDays = [];

  for (let i = 1; i <= 5; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    const dateStr = formatDateISO(d);
    const dayName = dayNames[d.getDay()];

    const remaining = eventsList.slice(4 + (i - 1) * 2, 4 + i * 2);
    const dayEvents = remaining.map((e, idx) => ({
      id: e.id || `evt-w-${i}-${idx}`,
      title: e.title || 'Calendar Event',
      time: e.startTime || '10:00 AM',
      location: e.location || '',
      category: 'Upcoming',
      icon: '📌'
    }));

    weekDays.push({
      dateStr,
      dayName,
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      events: dayEvents
    });
  }

  return {
    success: true,
    isConnected: true,
    source: sourceName,
    upNext,
    todayEvents,
    weekDays
  };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    let icalUrl = searchParams.get('icalUrl');

    // 1. Check if google_calendar_ical.json exists on disk (saved by SSH script)
    const icalFilePath = path.join(process.cwd(), 'dashboard', 'google_calendar_ical.json');
    if (!icalUrl && fs.existsSync(icalFilePath)) {
      try {
        const rawIcal = fs.readFileSync(icalFilePath, 'utf8');
        const parsedIcalJson = JSON.parse(rawIcal);
        if (parsedIcalJson.icalUrl) {
          icalUrl = parsedIcalJson.icalUrl;
        }
      } catch (e) {
        console.error('Error reading google_calendar_ical.json:', e);
      }
    }

    // 2. Fetch iCal ICS Feed if URL available
    if (icalUrl && icalUrl.startsWith('http')) {
      try {
        const res = await fetch(icalUrl, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          const parsedEvents = parseICS(text);
          if (parsedEvents.length > 0) {
            return NextResponse.json(buildCalendarResponse(parsedEvents, 'google_ical'));
          }
        }
      } catch (e) {
        console.error('Failed fetching iCal URL:', e);
      }
    }

    // 3. Check if google_calendar_tokens.json exists
    const tokenFilePath = path.join(process.cwd(), 'dashboard', 'google_calendar_tokens.json');
    if (fs.existsSync(tokenFilePath)) {
      try {
        const rawTokens = fs.readFileSync(tokenFilePath, 'utf8');
        const tokens = JSON.parse(rawTokens);
        if (tokens.access_token) {
          const nowIso = new Date().toISOString();
          const gRes = await fetch(
            `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(
              nowIso
            )}&singleEvents=true&orderBy=startTime&maxResults=15`,
            {
              headers: { Authorization: `Bearer ${tokens.access_token}` },
              cache: 'no-store'
            }
          );
          if (gRes.ok) {
            const data = await gRes.json();
            const items = data.items || [];
            if (items.length > 0) {
              const formatGTime = (dtObj) => {
                if (!dtObj) return '--:--';
                const d = new Date(dtObj.dateTime || dtObj.date);
                return formatTimeString(d);
              };

              const gEvents = items.map((it) => ({
                id: it.id,
                title: it.summary || 'Google Event',
                startTime: formatGTime(it.start),
                endTime: formatGTime(it.end),
                location: it.location || 'Google Calendar'
              }));

              return NextResponse.json(buildCalendarResponse(gEvents, 'google_api'));
            }
          }
        }
      } catch (e) {
        console.error('Error reading Google tokens:', e);
      }
    }

    // Default when not connected
    return NextResponse.json({
      success: true,
      isConnected: false,
      source: 'disconnected',
      upNext: null,
      todayEvents: [],
      weekDays: []
    });
  } catch (error) {
    console.error('Error in /api/calendar:', error);
    return NextResponse.json({
      success: true,
      isConnected: false,
      source: 'disconnected',
      upNext: null,
      todayEvents: [],
      weekDays: []
    });
  }
}
