import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseICalDate(icalStr) {
  if (!icalStr) return null;

  try {
    const cleanStr = icalStr.replace(/[^0-9T]/g, '');

    if (cleanStr.length === 8) {
      const year = parseInt(cleanStr.substring(0, 4), 10);
      const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
      const day = parseInt(cleanStr.substring(6, 8), 10);
      return new Date(year, month, day, 9, 0, 0);
    }

    if (cleanStr.length >= 15) {
      const year = parseInt(cleanStr.substring(0, 4), 10);
      const month = parseInt(cleanStr.substring(4, 6), 10) - 1;
      const day = parseInt(cleanStr.substring(6, 8), 10);
      const hour = parseInt(cleanStr.substring(9, 11), 10);
      const minute = parseInt(cleanStr.substring(11, 13), 10);
      const second = parseInt(cleanStr.substring(13, 15), 10);

      if (icalStr.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second));
      }
      return new Date(year, month, day, hour, minute, second);
    }
  } catch (e) {
    console.error('Failed parsing iCal date:', icalStr, e);
  }
  return null;
}

function formatTimeString(dateObj) {
  if (!dateObj || isNaN(dateObj.getTime())) return 'Scheduled';
  return dateObj.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatDateISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function unfoldICS(icsText) {
  if (!icsText) return '';
  return icsText.replace(/\r?\n[ \t]/g, '');
}

function cleanIcalText(str) {
  if (!str) return '';
  return str
    .replace(/\\n/gi, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\')
    .trim();
}

function formatLocationObject(rawLocation) {
  if (!rawLocation) {
    return { location: '', locationMain: '', locationSub: '', locationClean: '' };
  }

  const cleaned = cleanIcalText(rawLocation);
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/^[,;\s]+|[,;\s]+$/g, ''))
    .filter(Boolean);

  if (lines.length === 0) {
    return { location: '', locationMain: '', locationSub: '', locationClean: '' };
  }

  const locationMain = lines[0];
  const locationSub = lines.slice(1).join(', ');
  const locationClean = lines.join(', ');

  return {
    location: cleaned,
    locationMain,
    locationSub,
    locationClean
  };
}

function parseICS(icsText) {
  const rawEvents = [];
  const unfoldedText = unfoldICS(icsText);
  const lines = unfoldedText.split(/\r?\n/);
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
        currentEvent.title = cleanIcalText(line.substring(8));
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('DESCRIPTION:')) {
        currentEvent.description = cleanIcalText(line.substring(12));
      } else if (line.startsWith('DTSTART:')) {
        currentEvent.dtStartRaw = line.substring(8);
      } else if (line.startsWith('DTSTART;')) {
        const parts = line.split(':');
        if (parts.length > 1) currentEvent.dtStartRaw = parts[1];
      }
    }
  }

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

function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
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

  const now = new Date();

  // Sort all events by startDateObj ascending
  const sortedEvents = [...eventsList].sort((a, b) => {
    const tA = a.startDateObj ? new Date(a.startDateObj).getTime() : 0;
    const tB = b.startDateObj ? new Date(b.startDateObj).getTime() : 0;
    return tA - tB;
  });

  // 1. UP NEXT: The single next immediate event
  const first = sortedEvents[0];
  const firstLoc = formatLocationObject(first.location || 'Google Calendar');

  const upNext = {
    id: first.id || 'evt-next-1',
    title: cleanIcalText(first.title) || 'Untitled Event',
    startTime: first.startTime || 'Upcoming',
    endTime: first.endTime || '',
    location: firstLoc.location,
    locationMain: firstLoc.locationMain,
    locationSub: firstLoc.locationSub,
    locationClean: firstLoc.locationClean,
    category: 'Google Event',
    icon: '⚡',
    isUpNext: true
  };

  const remainingEvents = sortedEvents.slice(1);

  // 2. TODAY Events: All events occurring on today's calendar date
  const todayItems = remainingEvents.filter((e) => {
    if (!e.startDateObj) return false;
    const d = new Date(e.startDateObj);
    return isSameDay(d, now);
  });

  const todayEvents = todayItems.map((it, idx) => {
    const locObj = formatLocationObject(it.location || 'Google Calendar');
    return {
      id: it.id || `evt-today-${idx}`,
      title: cleanIcalText(it.title) || 'Calendar Event',
      startTime: it.startTime || 'Scheduled',
      endTime: it.endTime || '',
      location: locObj.location,
      locationMain: locObj.locationMain,
      locationSub: locObj.locationSub,
      locationClean: locObj.locationClean,
      category: 'Event',
      icon: '📌'
    };
  });

  // 3. UPCOMING DAYS: Group remaining future events by their actual target date
  const futureItems = remainingEvents.filter((e) => {
    if (!e.startDateObj) return false;
    const d = new Date(e.startDateObj);
    return !isSameDay(d, now) && d.getTime() > now.getTime();
  });

  const dayMap = new Map(); // key: 'YYYY-MM-DD' -> { dObj, events: [] }

  for (const e of futureItems) {
    const d = new Date(e.startDateObj);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, {
        dObj: d,
        events: []
      });
    }

    const locObj = formatLocationObject(e.location || '');
    dayMap.get(dateKey).events.push({
      id: e.id || `evt-${dateKey}-${dayMap.get(dateKey).events.length}`,
      title: cleanIcalText(e.title) || 'Calendar Event',
      time: e.startTime || '10:00 AM',
      location: locObj.location,
      locationMain: locObj.locationMain,
      locationSub: locObj.locationSub,
      locationClean: locObj.locationClean,
      category: 'Upcoming',
      icon: '📌'
    });
  }

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weekDays = [];

  for (const [dateKey, entry] of dayMap.entries()) {
    const d = entry.dObj;
    weekDays.push({
      dateStr: dateKey,
      dayName: dayNames[d.getDay()],
      formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      events: entry.events
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

    const dashboardDir = path.join(process.cwd(), 'dashboard');
    const icalFilePath = path.join(dashboardDir, 'google_calendar_ical.json');
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
    const tokenFilePath = path.join(dashboardDir, 'google_calendar_tokens.json');
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

              const gEvents = items.map((it) => {
                const startDateObj = new Date(it.start?.dateTime || it.start?.date || Date.now());
                return {
                  id: it.id,
                  title: it.summary || 'Google Event',
                  startDateObj,
                  startTime: formatGTime(it.start),
                  endTime: formatGTime(it.end),
                  location: it.location || 'Google Calendar'
                };
              });

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
