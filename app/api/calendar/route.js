import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function parseICalDate(icalStr) {
  if (!icalStr) return null;

  try {
    const isUtc = String(icalStr).trim().endsWith('Z');
    const cleanStr = String(icalStr).replace(/[^0-9T]/g, '');
    const match = cleanStr.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?)?/);

    if (!match) return null;

    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    const hour = match[4] ? parseInt(match[4], 10) : 9;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;

    if (isUtc) {
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    }
    return new Date(year, month, day, hour, minute, second);
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

function extractMeetingUrlFromText(...sources) {
  for (const text of sources) {
    if (!text) continue;
    const str = String(text);
    const meetingMatch = str.match(/(https?:\/\/[^\s,;<>"']*(?:zoom\.us|meet\.google|teams\.microsoft|webex\.com|discord\.gg|gotomeeting|whereby)[^\s,;<>"']*)/i);
    if (meetingMatch) return meetingMatch[1];
    
    const generalUrlMatch = str.match(/(https?:\/\/[^\s,;<>"']+)/i);
    if (generalUrlMatch) return generalUrlMatch[1];
  }
  return '';
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
      if (line.startsWith('SUMMARY:') || line.startsWith('SUMMARY;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.title = cleanIcalText(line.substring(colonIdx + 1));
      } else if (line.startsWith('LOCATION:') || line.startsWith('LOCATION;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.location = line.substring(colonIdx + 1);
      } else if (line.startsWith('DESCRIPTION:') || line.startsWith('DESCRIPTION;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.description = cleanIcalText(line.substring(colonIdx + 1));
      } else if (line.startsWith('URL:') || line.startsWith('URL;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.url = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith('DTSTART:') || line.startsWith('DTSTART;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.dtStartRaw = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith('DTEND:') || line.startsWith('DTEND;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.dtEndRaw = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith('RRULE:') || line.startsWith('RRULE;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.rrule = line.substring(colonIdx + 1).trim();
      } else if (line.startsWith('EXDATE:') || line.startsWith('EXDATE;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) {
          if (!currentEvent.exdates) currentEvent.exdates = [];
          const val = line.substring(colonIdx + 1).trim();
          val.split(',').forEach((dStr) => {
            if (dStr.trim()) currentEvent.exdates.push(dStr.trim());
          });
        }
      } else if (line.startsWith('STATUS:') || line.startsWith('STATUS;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.status = line.substring(colonIdx + 1).trim().toUpperCase();
      } else if (line.startsWith('RECURRENCE-ID:') || line.startsWith('RECURRENCE-ID;')) {
        const colonIdx = line.indexOf(':');
        if (colonIdx !== -1) currentEvent.recurrenceIdRaw = line.substring(colonIdx + 1).trim();
      }
    }
  }

  const now = new Date();
  const cutoffMs = now.getTime() + 14 * 24 * 60 * 60 * 1000;
  const dayNameMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };

  // Collect all explicitly cancelled instance dates from VEVENT blocks with STATUS:CANCELLED or RECURRENCE-ID
  const cancelledEvents = [];
  for (const e of rawEvents) {
    if (e.status === 'CANCELLED' || e.status === 'CANCEL') {
      const recDate = parseICalDate(e.recurrenceIdRaw || e.dtStartRaw);
      if (recDate) {
        cancelledEvents.push({
          title: cleanIcalText(e.title || '').toLowerCase(),
          dateMs: recDate.getTime()
        });
      }
    }
  }

  // Collect all manual non-recurring (one-time) events to override any recurring instances on the same day
  const singleManualEvents = [];
  for (const e of rawEvents) {
    if (!e.rrule && e.status !== 'CANCELLED' && e.status !== 'CANCEL') {
      const sDate = parseICalDate(e.dtStartRaw);
      if (sDate) {
        singleManualEvents.push({
          titleNorm: cleanIcalText(e.title || '').toLowerCase().replace(/[^a-z0-9]/g, ''),
          dateObj: sDate
        });
      }
    }
  }

  // Filter out standalone CANCELLED event markers so they aren't rendered as active events
  const validRawEvents = rawEvents.filter((e) => e.status !== 'CANCELLED' && e.status !== 'CANCEL');

  const expandedRaw = [];

  for (const e of validRawEvents) {
    const baseStart = parseICalDate(e.dtStartRaw);
    if (!baseStart) continue;

    const durationMs = e.dtEndRaw
      ? (parseICalDate(e.dtEndRaw)?.getTime() || baseStart.getTime() + 3600000) - baseStart.getTime()
      : 3600000;

    // Non-recurring event
    if (!e.rrule) {
      const endMs = baseStart.getTime() + durationMs;
      if (endMs > now.getTime()) {
        expandedRaw.push({
          ...e,
          startDateObj: baseStart,
          endDateObj: new Date(endMs)
        });
      }
      continue;
    }

    // Recurring event (RRULE expansion)
    const rrule = e.rrule.toUpperCase();

    // 1. Skip if recurring series UNTIL date has passed
    const untilMatch = rrule.match(/UNTIL=([0-9T]+)/);
    const untilDate = untilMatch ? parseICalDate(untilMatch[1]) : null;
    if (untilDate && untilDate.getTime() < now.getTime()) {
      continue; // Series ended in the past - do not generate any instances
    }

    const maxUntilMs = untilDate ? untilDate.getTime() : cutoffMs + 86400000;
    const freqMatch = rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
    const freq = freqMatch ? freqMatch[1] : 'WEEKLY';

    const bydayMatch = rrule.match(/BYDAY=([A-Z,]+)/);
    const targetDays = bydayMatch
      ? bydayMatch[1].split(',').map((d) => dayNameMap[d]).filter((d) => d !== undefined)
      : [baseStart.getDay()];

    const countMatch = rrule.match(/COUNT=([0-9]+)/);
    const maxCount = countMatch ? parseInt(countMatch[1], 10) : 1000;

    let current = new Date(baseStart);

    // Fast-forward long-standing active recurring events close to now
    if (now.getTime() - current.getTime() > 14 * 86400000) {
      const daysDiff = Math.floor((now.getTime() - current.getTime()) / 86400000) - 7;
      if (freq === 'WEEKLY') {
        const weeksDiff = Math.floor(daysDiff / 7);
        current.setDate(current.getDate() + weeksDiff * 7);
      } else if (freq === 'DAILY') {
        current.setDate(current.getDate() + daysDiff);
      }
    }

    let iterations = 0;
    let generatedCount = 0;
    const eventTitleLower = cleanIcalText(e.title || '').toLowerCase();
    const eventTitleNorm = eventTitleLower.replace(/[^a-z0-9]/g, '');

    while (current.getTime() <= Math.min(cutoffMs, maxUntilMs) && iterations < 500 && generatedCount < maxCount) {
      iterations++;
      const curMs = current.getTime();
      const endMs = curMs + durationMs;

      if (curMs <= cutoffMs) {
        if (freq !== 'WEEKLY' || targetDays.includes(current.getDay())) {
          generatedCount++;

          // Only add instance if it hasn't already ended in the past
          if (endMs > now.getTime()) {
            // Check EXDATE comma-separated cancellations and STATUS:CANCELLED RECURRENCE-IDs
            const isExdated = e.exdates?.some((exStr) => {
              const exD = parseICalDate(exStr);
              return exD && (isSameDay(exD, current) || Math.abs(exD.getTime() - curMs) < 18 * 3600 * 1000);
            });

            const isCancelledRecurrence = cancelledEvents.some((c) => {
              const timeDiffHours = Math.abs(c.dateMs - curMs) / (3600 * 1000);
              const sameDay = isSameDay(new Date(c.dateMs), current);
              const titleMatches = !c.title || !eventTitleLower || c.title.includes(eventTitleLower) || eventTitleLower.includes(c.title);
              return (timeDiffHours < 24 || sameDay) && titleMatches;
            });

            // Check if user manually created a single one-time event with same/similar title on this exact day
            const isOverriddenBySingleEvent = singleManualEvents.some((s) => {
              const sameDay = isSameDay(s.dateObj, current);
              const titleMatch = s.titleNorm === eventTitleNorm || (s.titleNorm.length > 4 && eventTitleNorm.length > 4 && (s.titleNorm.includes(eventTitleNorm) || eventTitleNorm.includes(s.titleNorm)));
              return sameDay && titleMatch;
            });

            if (!isExdated && !isCancelledRecurrence && !isOverriddenBySingleEvent) {
              expandedRaw.push({
                ...e,
                startDateObj: new Date(curMs),
                endDateObj: new Date(endMs)
              });
            }
          }
        }
      }

      if (freq === 'DAILY') {
        current.setDate(current.getDate() + 1);
      } else if (freq === 'WEEKLY') {
        current.setDate(current.getDate() + 1);
      } else if (freq === 'MONTHLY') {
        current.setMonth(current.getMonth() + 1);
      } else {
        current.setDate(current.getDate() + 7);
      }
    }
  }

  const futureEvents = expandedRaw
    .map((e) => {
      const meetingUrl = extractMeetingUrlFromText(e.url, e.location, e.description);
      return {
        ...e,
        meetingUrl,
        startTime: e.startDateObj ? formatTimeString(e.startDateObj) : 'Today'
      };
    })
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
  const now = new Date();

  // Filter out any events whose end time has passed (endDateObj < now)
  const activeAndFuture = (eventsList || []).filter((e) => {
    if (!e.startDateObj) return false;
    const startMs = new Date(e.startDateObj).getTime();
    const endMs = e.endDateObj ? new Date(e.endDateObj).getTime() : startMs + 3600000;
    return endMs > now.getTime();
  });

  if (activeAndFuture.length === 0) {
    return {
      success: true,
      isConnected: true,
      source: sourceName,
      upNext: null,
      todayEvents: [],
      weekDays: []
    };
  }

  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  const cutoffMs = now.getTime() + sevenDaysMs;

  // Sort and filter events up to 7 days out
  const sortedEvents = [...activeAndFuture]
    .filter((e) => {
      const startMs = e.startDateObj ? new Date(e.startDateObj).getTime() : 0;
      return startMs <= cutoffMs;
    })
    .sort((a, b) => {
      const tA = a.startDateObj ? new Date(a.startDateObj).getTime() : 0;
      const tB = b.startDateObj ? new Date(b.startDateObj).getTime() : 0;
      return tA - tB;
    });

  function checkIsLive(e) {
    if (!e || !e.startDateObj) return false;
    const startMs = new Date(e.startDateObj).getTime();
    const endMs = e.endDateObj ? new Date(e.endDateObj).getTime() : startMs + 3600000;
    return startMs <= now.getTime() && now.getTime() <= endMs;
  }

  // 1. UP NEXT: The single next immediate or currently live event (for hero banner & map focus)
  const first = sortedEvents[0];
  const firstLoc = formatLocationObject(first.location || '');
  const firstMeetingUrl = first.meetingUrl || extractMeetingUrlFromText(first.location, first.description);
  const firstIsLive = checkIsLive(first);
  const firstDate = first.startDateObj ? new Date(first.startDateObj) : now;
  const isFirstToday = isSameDay(firstDate, now);
  const tmrObj = new Date(now);
  tmrObj.setDate(tmrObj.getDate() + 1);
  const isFirstTomorrow = isSameDay(firstDate, tmrObj);
  const monthDayStr = firstDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
  const fullDayStr = firstDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  const upNextDateStr = isFirstToday ? `TODAY, ${monthDayStr}` : isFirstTomorrow ? `TOMORROW, ${monthDayStr}` : fullDayStr;

  const upNext = {
    id: first.id || 'evt-next-1',
    title: cleanIcalText(first.title) || 'Untitled Event',
    startTime: first.startTime || 'Upcoming',
    endTime: first.endTime || '',
    dateStr: upNextDateStr,
    location: firstLoc.location,
    locationMain: firstLoc.locationMain,
    locationSub: firstLoc.locationSub,
    locationClean: firstLoc.locationClean,
    meetingUrl: firstMeetingUrl,
    isLive: firstIsLive,
    category: 'Google Event',
    icon: firstIsLive ? '🔴' : '⚡',
    isUpNext: true
  };

  // Include ALL events for the next 7 days in the event stream (do not slice out sortedEvents[0])
  const allStreamEvents = sortedEvents;
  const todayMonthDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();

  // 2. TODAY Events: All events occurring on today's calendar date
  const todayItems = allStreamEvents.filter((e) => {
    if (!e.startDateObj) return false;
    const d = new Date(e.startDateObj);
    return isSameDay(d, now);
  });

  const todayEvents = todayItems.map((it, idx) => {
    const locObj = formatLocationObject(it.location || '');
    const meetingUrl = it.meetingUrl || extractMeetingUrlFromText(it.location, it.description);
    const isLive = checkIsLive(it);
    return {
      id: it.id || `evt-today-${idx}`,
      title: cleanIcalText(it.title) || 'Calendar Event',
      startTime: it.startTime || 'Scheduled',
      endTime: it.endTime || '',
      dateStr: `TODAY, ${todayMonthDay}`,
      location: locObj.location,
      locationMain: locObj.locationMain,
      locationSub: locObj.locationSub,
      locationClean: locObj.locationClean,
      meetingUrl,
      isLive,
      category: 'Event',
      icon: isLive ? '🔴' : '📌'
    };
  });

  // 3. UPCOMING DAYS: Group all future events up to 7 days out by their target date
  const futureItems = allStreamEvents.filter((e) => {
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
    const meetingUrl = e.meetingUrl || extractMeetingUrlFromText(e.location, e.description);
    const isLive = checkIsLive(e);
    const eventDateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

    dayMap.get(dateKey).events.push({
      id: e.id || `evt-${dateKey}-${dayMap.get(dateKey).events.length}`,
      title: cleanIcalText(e.title) || 'Calendar Event',
      startTime: e.startTime || '10:00 AM',
      dateStr: eventDateStr,
      location: locObj.location,
      locationMain: locObj.locationMain,
      locationSub: locObj.locationSub,
      locationClean: locObj.locationClean,
      meetingUrl,
      isLive,
      category: 'Upcoming',
      icon: isLive ? '🔴' : '📌'
    });
  }

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const weekDays = [];

  for (const [dateKey, entry] of dayMap.entries()) {
    const d = entry.dObj;
    const dayName = dayNames[d.getDay()];
    const formattedDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
    const fullDateStr = `${dayName}, ${formattedDate}`;

    const formattedEvents = entry.events.map((e) => ({
      ...e,
      startTime: e.startTime || e.time || 'Scheduled',
      time: e.startTime || e.time || 'Scheduled',
      dateStr: e.dateStr || fullDateStr
    }));

    weekDays.push({
      dateStr: dateKey,
      dayName,
      formattedDate,
      shortDate: formattedDate,
      events: formattedEvents
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
            )}&singleEvents=true&orderBy=startTime&maxResults=100`,
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
                const endDateObj = new Date(it.end?.dateTime || it.end?.date || (startDateObj.getTime() + 3600000));
                const hangoutUrl = it.hangoutLink || (it.conferenceData?.entryPoints?.find(ep => ep.uri?.startsWith('http'))?.uri) || '';
                const meetingUrl = extractMeetingUrlFromText(hangoutUrl, it.location, it.description);
                return {
                  id: it.id,
                  title: it.summary || 'Google Event',
                  startDateObj,
                  endDateObj,
                  startTime: formatGTime(it.start),
                  endTime: formatGTime(it.end),
                  location: it.location || '',
                  meetingUrl,
                  description: it.description || ''
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
