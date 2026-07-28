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

// Simple iCal parser for ICS feeds
function parseICS(icsText) {
  const events = [];
  const lines = icsText.split(/\r?\n/);
  let currentEvent = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'BEGIN:VEVENT') {
      currentEvent = {};
    } else if (line === 'END:VEVENT') {
      if (currentEvent && currentEvent.title) {
        events.push(currentEvent);
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith('SUMMARY:')) {
        currentEvent.title = line.substring(8);
      } else if (line.startsWith('LOCATION:')) {
        currentEvent.location = line.substring(9);
      } else if (line.startsWith('DTSTART:')) {
        currentEvent.startRaw = line.substring(8);
      } else if (line.startsWith('DTSTART;')) {
        const parts = line.split(':');
        if (parts.length > 1) currentEvent.startRaw = parts[1];
      }
    }
  }

  return events;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const icalUrl = searchParams.get('icalUrl');

    // 1. Check if direct iCal URL provided
    if (icalUrl && icalUrl.startsWith('http')) {
      try {
        const res = await fetch(icalUrl, { cache: 'no-store' });
        if (res.ok) {
          const text = await res.text();
          const parsed = parseICS(text);
          if (parsed.length > 0) {
            const sample = generateSampleSchedule();
            return NextResponse.json({
              success: true,
              source: 'ical',
              upNext: {
                ...sample.upNext,
                title: parsed[0]?.title || sample.upNext.title,
                location: parsed[0]?.location || sample.upNext.location
              },
              todayEvents: sample.todayEvents,
              weekDays: sample.weekDays
            });
          }
        }
      } catch (e) {
        console.error('Failed fetching iCal URL:', e);
      }
    }

    // 2. Check if google_calendar_tokens.json exists
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
              const sample = generateSampleSchedule();
              const firstItem = items[0];
              const formatGTime = (dtObj) => {
                if (!dtObj) return '--:--';
                const d = new Date(dtObj.dateTime || dtObj.date);
                return formatTimeString(d);
              };

              const upNextG = {
                id: firstItem.id,
                title: firstItem.summary || 'Untitled Event',
                startTime: formatGTime(firstItem.start),
                endTime: formatGTime(firstItem.end),
                startRaw: firstItem.start?.dateTime || firstItem.start?.date,
                location: firstItem.location || 'Google Calendar Sync',
                category: 'Google Event',
                icon: '📅',
                isUpNext: true
              };

              const todayEventsG = items.slice(1, 4).map((it, idx) => ({
                id: it.id || `g-today-${idx}`,
                title: it.summary || 'Google Event',
                startTime: formatGTime(it.start),
                endTime: formatGTime(it.end),
                location: it.location || 'Google Calendar',
                category: 'Scheduled',
                icon: '📌'
              }));

              return NextResponse.json({
                success: true,
                source: 'google_api',
                upNext: upNextG,
                todayEvents: todayEventsG.length > 0 ? todayEventsG : sample.todayEvents,
                weekDays: sample.weekDays
              });
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
