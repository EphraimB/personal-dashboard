import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Cache geocoded home address coordinates
let cachedHomeCoords = null;
let cachedHomeAddressStr = null;

async function geocodeAddress(addressStr) {
  if (!addressStr) return { lat: 40.6226, lon: -73.7275, label: 'CEDARHURST, NY' };

  if (cachedHomeAddressStr === addressStr && cachedHomeCoords) {
    return cachedHomeCoords;
  }

  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(addressStr)}&limit=1`;
    const res = await fetch(photonUrl, {
      headers: { 'User-Agent': 'PersonalDashboardApp/2.0 (personal-dashboard-app)' }
    });
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const f = data.features[0];
        const [lon, lat] = f.geometry.coordinates;
        const city = (f.properties.city || f.properties.town || f.properties.name || 'CEDARHURST').toUpperCase();
        const state = (f.properties.state || 'NY').toUpperCase();

        const label = `${city}, ${state.substring(0, 2)}`;
        cachedHomeAddressStr = addressStr;
        cachedHomeCoords = { lat, lon, label };
        return cachedHomeCoords;
      }
    }
  } catch (e) {
    console.error('Failed to geocode HOME_ADDRESS:', e);
  }

  // Fallback to default Cedarhurst, NY
  return { lat: 40.6226, lon: -73.7275, label: 'CEDARHURST, NY' };
}

function getWeatherConditionText(code) {
  switch (code) {
    case 0: return 'SUNNY';
    case 1: return 'MAINLY CLEAR';
    case 2: return 'PARTLY CLOUDY';
    case 3: return 'OVERCAST';
    case 45: case 48: return 'FOGGY';
    case 51: case 53: case 55: return 'DRIZZLE';
    case 61: case 63: return 'RAIN';
    case 65: return 'HEAVY RAIN';
    case 71: case 73: case 75: return 'SNOW';
    case 80: case 81: case 82: return 'RAIN SHOWERS';
    case 95: case 96: case 99: return 'THUNDERSTORMS';
    default: return 'CLEAR';
  }
}

function calculateOutdoorTelemetry(current, hourly, daily, tempUnit = 'F', timezoneStr = 'America/New_York') {
  const tempF = tempUnit === 'C' ? (current.temperature_2m * 9/5) + 32 : current.temperature_2m;
  const feelsLikeF = current.apparent_temperature !== undefined 
    ? (tempUnit === 'C' ? (current.apparent_temperature * 9/5) + 32 : current.apparent_temperature)
    : tempF;
  
  const humidity = current.relative_humidity_2m ?? 50;
  const windMph = current.wind_speed_10m ?? 5;
  const uvIndex = Math.round(current.uv_index ?? 0);
  const pressureInHg = current.surface_pressure ? (current.surface_pressure * 0.02953).toFixed(2) : '30.12';

  // 1. Sweat Time Estimation & Meter Gauge
  let sweatMins = 60;
  let sweatLabel = '60+ MIN';
  let sweatGaugePct = 15; // 0-100%
  let sweatSliderVal = 20;

  if (feelsLikeF >= 95) {
    sweatMins = Math.max(8, Math.round(18 - (feelsLikeF - 95) * 0.8));
    sweatLabel = `${sweatMins} MIN`;
    sweatGaugePct = 90;
    sweatSliderVal = 92;
  } else if (feelsLikeF >= 85) {
    sweatMins = Math.round(30 - (feelsLikeF - 85) * 1.2);
    sweatLabel = `${sweatMins} MIN`;
    sweatGaugePct = 75;
    sweatSliderVal = 78;
  } else if (feelsLikeF >= 78) {
    sweatMins = Math.round(45 - (feelsLikeF - 78) * 2);
    sweatLabel = `${sweatMins} MIN`;
    sweatGaugePct = 50;
    sweatSliderVal = 55;
  } else if (feelsLikeF >= 70) {
    sweatMins = Math.round(60 - (feelsLikeF - 70) * 1.5);
    sweatLabel = `${sweatMins} MIN`;
    sweatGaugePct = 35;
    sweatSliderVal = 35;
  } else {
    sweatMins = 60;
    sweatLabel = 'NO SWEAT';
    sweatGaugePct = 15;
    sweatSliderVal = 15;
  }

  // 2. Sunscreen Recommendation & Protection Window
  let uvActiveHours = [];
  if (hourly?.time && hourly?.uv_index) {
    const now = new Date();
    let todayStr = '';
    try {
      const isoLocal = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezoneStr,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);
      todayStr = isoLocal.substring(0, 10);
    } catch (e) {
      todayStr = now.toISOString().substring(0, 10);
    }

    for (let i = 0; i < hourly.time.length; i++) {
      const tStr = hourly.time[i];
      if (typeof tStr === 'string' && tStr.startsWith(todayStr)) {
        if ((hourly.uv_index[i] ?? 0) >= 3) {
          const dt = new Date(tStr);
          uvActiveHours.push(dt.getHours());
        }
      }
    }
  }

  let windowLabel = '';
  let activeUntilLabel = '';
  let maxActiveHour = -1;

  if (uvActiveHours.length > 0) {
    const startH = Math.min(...uvActiveHours);
    const endH = Math.max(...uvActiveHours) + 1;
    maxActiveHour = Math.max(...uvActiveHours);

    const formatH = (h) => {
      const ampm = h >= 12 ? 'PM' : 'AM';
      const hrs = h % 12 || 12;
      return `${hrs} ${ampm}`;
    };

    windowLabel = `NEEDED ${formatH(startH)} – ${formatH(endH)}`;
    activeUntilLabel = `NEEDED UNTIL ${formatH(endH)}`;
  }

  let spfRating = 'NOT NEEDED';
  let spfTag = 'LOW UV EXPOSURE';
  let reapplyText = 'NOT NEEDED TODAY';

  if (uvIndex >= 8) {
    spfRating = 'SPF 50+';
    spfTag = 'VERY HIGH PROTECTION';
    reapplyText = activeUntilLabel ? `${activeUntilLabel} • REAPPLY 2H` : 'REAPPLY EVERY 2 HOURS';
  } else if (uvIndex >= 6) {
    spfRating = 'SPF 50';
    spfTag = 'HIGH PROTECTION';
    reapplyText = activeUntilLabel ? `${activeUntilLabel} • REAPPLY 2H` : 'REAPPLY EVERY 2 HOURS';
  } else if (uvIndex >= 3) {
    spfRating = 'SPF 30';
    spfTag = 'MODERATE PROTECTION';
    reapplyText = activeUntilLabel ? `${activeUntilLabel} • REAPPLY 2H` : 'REAPPLY EVERY 2 HOURS';
  } else {
    spfRating = 'NOT NEEDED';
    spfTag = 'LOW UV EXPOSURE';
    if (windowLabel) {
      const now = new Date();
      let currentHour = now.getHours();
      try {
        const hourStr = new Intl.DateTimeFormat('sv-SE', {
          timeZone: timezoneStr,
          hour: '2-digit',
          hour12: false
        }).format(now);
        currentHour = parseInt(hourStr, 10);
      } catch (e) {}

      if (currentHour > maxActiveHour) {
        reapplyText = 'DONE FOR TODAY (LOW UV)';
      } else {
        reapplyText = windowLabel;
      }
    } else {
      reapplyText = 'NOT NEEDED TODAY';
    }
  }

  // 3. Hydration Reminder
  let waterOz = '25–30 oz';
  let waitMins = '15 MIN';
  if (feelsLikeF >= 90) {
    waterOz = '30–35 oz';
    waitMins = '15 MIN';
  } else if (feelsLikeF >= 80) {
    waterOz = '25–30 oz';
    waitMins = '15 MIN';
  } else if (feelsLikeF >= 70) {
    waterOz = '18–24 oz';
    waitMins = '10 MIN';
  } else {
    waterOz = '12–16 oz';
    waitMins = '5 MIN';
  }

  // 4. UV Index Severity Tag
  let uvSeverity = 'LOW';
  if (uvIndex >= 11) uvSeverity = 'EXTREME';
  else if (uvIndex >= 8) uvSeverity = 'VERY HIGH';
  else if (uvIndex >= 6) uvSeverity = 'HIGH';
  else if (uvIndex >= 3) uvSeverity = 'MODERATE';

  // 5. Best Time Outside & Summary
  let morningWindow = 'BEFORE 10 AM';
  let eveningWindow = 'AFTER 6 PM';
  let summaryText = 'Mild conditions with low UV exposure. Ideal for outdoor exercise and recreation.';

  if (feelsLikeF >= 85 || uvIndex >= 7) {
    morningWindow = 'BEFORE 10 AM';
    eveningWindow = 'AFTER 6 PM';
    summaryText = 'Hot and humid with high UV. Limit direct sun exposure, stay hydrated, and reapply sunscreen!';
  } else if (feelsLikeF >= 75 || uvIndex >= 4) {
    morningWindow = 'BEFORE 11 AM';
    eveningWindow = 'AFTER 5 PM';
    summaryText = 'Pleasant conditions. Moderate UV during midday hours—wear sunscreen during prolonged exposure.';
  } else if (feelsLikeF <= 45) {
    morningWindow = 'AFTER 11 AM';
    eveningWindow = 'BEFORE 4 PM';
    summaryText = 'Brisk conditions. Dress in warm layers for outdoor activity.';
  }

  // 6. Hourly Ticker Data (Current hour + next 5 hours)
  const hourlyTicker = [];
  if (hourly?.time && Array.isArray(hourly.time)) {
    const now = new Date();
    let currentHourStr = '';
    try {
      const isoLocal = new Intl.DateTimeFormat('sv-SE', {
        timeZone: timezoneStr,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        hour12: false
      }).format(now);
      currentHourStr = isoLocal.substring(0, 13).replace(' ', 'T');
    } catch (e) {
      currentHourStr = now.toISOString().substring(0, 13);
    }

    let startIdx = hourly.time.findIndex(t => typeof t === 'string' && t.startsWith(currentHourStr));
    if (startIdx === -1) startIdx = 0;

    for (let i = 0; i < 6; i++) {
      const idx = startIdx + i;
      if (idx < hourly.time.length) {
        const timeIso = hourly.time[idx];
        const dt = new Date(timeIso);
        let hrs = dt.getHours();
        const ampm = hrs >= 12 ? 'PM' : 'AM';
        hrs = hrs % 12 || 12;
        const label = i === 0 ? 'NOW' : `${hrs} ${ampm}`;

        const rawTemp = hourly.temperature_2m[idx];
        const tempDisp = i === 0 ? Math.round(tempF) : Math.round(rawTemp);
        const code = i === 0 ? (current.weather_code ?? 0) : (hourly.weather_code[idx] ?? 0);
        const hrUv = i === 0 ? uvIndex : Math.round(hourly.uv_index?.[idx] ?? uvIndex);
        const pop = Math.round(hourly.precipitation_probability?.[idx] ?? 0);

        hourlyTicker.push({
          label,
          temp: tempDisp,
          code,
          uv: hrUv,
          pop
        });
      }
    }
  }

  return {
    tempF: Math.round(tempF),
    feelsLikeF: Math.round(feelsLikeF),
    humidity: Math.round(humidity),
    windMph: Math.round(windMph),
    pressureInHg,
    uvIndex,
    uvSeverity,
    sweatMins,
    sweatLabel,
    sweatGaugePct,
    sweatSliderVal,
    spfRating,
    spfTag,
    reapplyText,
    waterOz,
    waitMins,
    morningWindow,
    eveningWindow,
    summaryText,
    hourlyTicker
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tempUnit = searchParams.get('unit') === 'C' ? 'C' : 'F';

  const homeAddressEnv = process.env.HOME_ADDRESS || '141 Grove Av, Cedarhurst, NY 11516';
  const locationInfo = await geocodeAddress(homeAddressEnv);

  try {
    const unitParam = tempUnit === 'C' ? '&temperature_unit=celsius&wind_speed_unit=kmh' : '&temperature_unit=fahrenheit&wind_speed_unit=mph';
    const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${locationInfo.lat}&longitude=${locationInfo.lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,surface_pressure,weather_code,wind_speed_10m,uv_index&hourly=temperature_2m,weather_code,precipitation_probability,uv_index&daily=temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset&timezone=auto${unitParam}`;

    const res = await fetch(apiUrl, { next: { revalidate: 600 } });
    if (!res.ok) {
      throw new Error(`Open-Meteo responded with status ${res.status}`);
    }

    const rawData = await res.json();
    const current = rawData.current || {};
    const hourly = rawData.hourly || {};
    const daily = rawData.daily || {};
    const timezoneStr = rawData.timezone || 'America/New_York';

    const telemetry = calculateOutdoorTelemetry(current, hourly, daily, tempUnit, timezoneStr);

    return NextResponse.json({
      success: true,
      homeAddress: homeAddressEnv,
      locationLabel: locationInfo.label,
      coords: { lat: locationInfo.lat, lon: locationInfo.lon },
      tempUnit,
      currentTemp: telemetry.tempF,
      feelsLike: telemetry.feelsLikeF,
      conditionCode: current.weather_code ?? 0,
      conditionText: getWeatherConditionText(current.weather_code ?? 0),
      humidity: telemetry.humidity,
      windSpeed: telemetry.windMph,
      pressureInHg: telemetry.pressureInHg,
      uvIndex: telemetry.uvIndex,
      uvSeverity: telemetry.uvSeverity,
      maxTemp: daily.temperature_2m_max?.[0] !== undefined ? Math.round(daily.temperature_2m_max[0]) : telemetry.tempF,
      minTemp: daily.temperature_2m_min?.[0] !== undefined ? Math.round(daily.temperature_2m_min[0]) : telemetry.tempF,
      sweatMeter: {
        mins: telemetry.sweatMins,
        label: telemetry.sweatLabel,
        gaugePct: telemetry.sweatGaugePct,
        sliderVal: telemetry.sweatSliderVal
      },
      sunscreen: {
        spfRating: telemetry.spfRating,
        spfTag: telemetry.spfTag,
        reapplyText: telemetry.reapplyText
      },
      hydration: {
        waterOz: telemetry.waterOz,
        waitMins: telemetry.waitMins
      },
      bestTimeOutside: {
        morningWindow: telemetry.morningWindow,
        eveningWindow: telemetry.eveningWindow,
        summaryText: telemetry.summaryText
      },
      hourlyTicker: telemetry.hourlyTicker
    });
  } catch (err) {
    console.error('Weather API error:', err);
    return NextResponse.json({
      success: false,
      locationLabel: locationInfo.label,
      error: err.message
    }, { status: 500 });
  }
}
