'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import WeatherAtmosphereCanvas from './components/WeatherAtmosphereCanvas';

// Dynamically import Leaflet mini-map component with SSR disabled
const LocationMiniMap = dynamic(() => import('./components/LocationMiniMap'), {
  ssr: false
});

// Dynamic Weather SVG Component mapping Open-Meteo codes to neon icons
function WeatherSvg({ code = 0, className = 'wx-icon' }) {
  // Clear / Sunny (0, 1)
  if (code === 0 || code === 1) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="5" fill="#ffb300" stroke="#ff5722" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#ffb300" strokeLinecap="round" />
      </svg>
    );
  }
  // Partly Cloudy / Overcast (2, 3)
  if (code === 2 || code === 3) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17.5 19c2.5 0 4.5-2 4.5-4.5 0-2.3-1.7-4.1-3.9-4.5-.4-3.1-3-5.5-6.1-5.5-2.7 0-5.1 1.8-5.8 4.4C3.9 9.3 2 11.2 2 13.5 2 16.5 4.5 19 7.5 19h10z" fill="rgba(0, 240, 255, 0.15)" stroke="#00f0ff" strokeLinejoin="round" />
        <circle cx="16.5" cy="7.5" r="3" fill="#ffb300" stroke="#ff5722" />
      </svg>
    );
  }
  // Fog / Mist (45, 48)
  if (code === 45 || code === 48) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M3 8h18M5 12h14M2 16h20M7 20h10" stroke="#00ff88" strokeLinecap="round" />
      </svg>
    );
  }
  // Rain / Drizzle / Showers (51-67, 80-82)
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 14.5c2 0 3.5-1.5 3.5-3.5 0-1.8-1.3-3.2-3-3.5-.3-2.5-2.4-4.5-4.9-4.5-2.2 0-4.1 1.4-4.7 3.5-1.8.3-3.3 1.8-3.3 3.6 0 2 1.6 3.5 3.6 3.5H17z" fill="rgba(0, 240, 255, 0.15)" stroke="#00f0ff" />
        <path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3" stroke="#00f0ff" strokeLinecap="round" />
      </svg>
    );
  }
  // Snow / Ice (71-77, 85-86)
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 13.5c2 0 3.5-1.5 3.5-3.5 0-1.8-1.3-3.2-3-3.5-.3-2.5-2.4-4.5-4.9-4.5-2.2 0-4.1 1.4-4.7 3.5-1.8.3-3.3 1.8-3.3 3.6 0 2 1.6 3.5 3.6 3.5H17z" fill="rgba(255, 255, 255, 0.15)" stroke="#ffffff" />
        <path d="M8 17.5v2M8 18.5h2M6 18.5h2M12 17.5v2M12 18.5h2M10 18.5h2M16 17.5v2M16 18.5h2M14 18.5h2" stroke="#ffffff" strokeLinecap="round" />
      </svg>
    );
  }
  // Thunderstorm (95, 96, 99)
  if (code >= 95) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M17 13c2 0 3.5-1.5 3.5-3.5 0-1.8-1.3-3.2-3-3.5-.3-2.5-2.4-4.5-4.9-4.5-2.2 0-4.1 1.4-4.7 3.5-1.8.3-3.3 1.8-3.3 3.6 0 2 1.6 3.5 3.6 3.5H17z" fill="rgba(255, 87, 34, 0.2)" stroke="#ff5722" />
        <path d="M12 14l-2 4h3l-1 4 4-5h-3l2-3z" fill="#ffb300" stroke="#ff5722" strokeLinejoin="round" />
      </svg>
    );
  }
  // Default Sun
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="5" fill="#ffb300" stroke="#ff5722" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#ffb300" strokeLinecap="round" />
    </svg>
  );
}

function getWeatherDescription(code) {
  switch (code) {
    case 0: return 'SUNNY / CLEAR';
    case 1: return 'MAINLY CLEAR';
    case 2: return 'PARTLY CLOUDY';
    case 3: return 'OVERCAST';
    case 45: return 'FOGGY';
    case 48: return 'RIME FOG';
    case 51: case 53: case 55: return 'DRIZZLE';
    case 56: case 57: return 'FREEZING DRIZZLE';
    case 61: return 'LIGHT RAIN';
    case 63: return 'MODERATE RAIN';
    case 65: return 'HEAVY RAIN';
    case 66: case 67: return 'FREEZING RAIN';
    case 71: return 'LIGHT SNOW';
    case 73: return 'MODERATE SNOW';
    case 75: return 'HEAVY SNOW';
    case 77: return 'SNOW GRAINS';
    case 80: case 81: case 82: return 'RAIN SHOWERS';
    case 85: case 86: return 'SNOW SHOWERS';
    case 95: return 'THUNDERSTORMS';
    case 96: case 99: return 'THUNDER & HAIL';
    default: return 'CLEAR';
  }
}

function formatHourLabel(isoString, idx) {
  if (idx === 0) return 'NOW';
  if (!isoString) return '';
  const dateObj = new Date(isoString);
  if (isNaN(dateObj.getTime())) return '';
  let hrs = dateObj.getHours();
  const ampm = hrs >= 12 ? 'PM' : 'AM';
  hrs = hrs % 12;
  hrs = hrs ? hrs : 12;
  return `${hrs} ${ampm}`;
}

export default function Home() {
  const [photoList, setPhotoList] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [layer1Url, setLayer1Url] = useState('');
  const [layer2Url, setLayer2Url] = useState('');
  const [activeLayer, setActiveLayer] = useState(1); // 1 or 2
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResult, setTestResult] = useState('');

  // Real-time clock states (Local NY & Ares Solar Clock)
  const [clockTime, setClockTime] = useState('');
  const [clockAmPm, setClockAmPm] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [aresSolarClock, setAresSolarClock] = useState('');

  // Cedarhurst Open-Meteo Live Weather & Forecast Data
  const [weatherData, setWeatherData] = useState(null);

  // Live Google Calendar & iCal Stream Data
  const [calendarData, setCalendarData] = useState(null);

  // Dashboard Configuration Settings
  const [config, setConfig] = useState({
    folderPath: '',
    searchQuery: '',
    accessToken: '',
    slideDuration: 15,
    showDescription: true,
    filterScreenshots: true,
    enableKenBurns: true,
    enableScanlines: true,
    enableFallbackDemo: true,
    showWeatherSidebars: true,
    showMiddleSlideshow: true,
    tempUnit: 'F',
    icalUrl: '',
    uiScale: '150',
    objectFit: 'contain' // 'contain' (no crop) or 'cover' (fill screen)
  });

  const [showControls, setShowControls] = useState(true);
  const idleTimeoutRef = useRef(null);

  // Mouse move / user activity listener for TV kiosk autohide controls
  useEffect(() => {
    const handleActivity = () => {
      setShowControls(true);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
      idleTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 5000);
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    handleActivity();

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
    };
  }, []);

  // Load configuration settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('personal_dashboard_config');
    if (saved) {
      try {
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      } catch (e) {
        console.error('Failed to parse saved config:', e);
      }
    }
  }, []);

  // Save config changes to localStorage
  const saveConfig = (newCfg) => {
    setConfig(newCfg);
    localStorage.setItem('personal_dashboard_config', JSON.stringify(newCfg));
  };

  // Keyboard Navigation Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) return;

      if (e.key === 'ArrowRight') {
        setCurrentIndex((prev) => (prev + 1) % (photoList.length || 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => (prev - 1 + photoList.length) % (photoList.length || 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsPaused((prev) => !prev);
      } else if (e.key.toLowerCase() === 'm') {
        setIsModalOpen(true);
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 's') {
        saveConfig({ ...config, enableScanlines: !config.enableScanlines });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photoList.length, isModalOpen, config]);

  // Real-Time Clock & Ares Solar Clock Engine
  useEffect(() => {
    const updateClocks = () => {
      const now = new Date();
      let hrs = now.getHours();
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');
      const ampm = hrs >= 12 ? 'PM' : 'AM';
      hrs = hrs % 12;
      hrs = hrs ? hrs : 12;
      const formattedHrs = String(hrs).padStart(2, '0');

      setClockTime(`${formattedHrs}:${mins}:${secs}`);
      setClockAmPm(ampm);

      const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
      setClockDate(now.toLocaleDateString('en-US', options).toUpperCase());

      const startOfYear = new Date(now.getFullYear(), 0, 0);
      const diff = now - startOfYear;
      const oneDay = 1000 * 60 * 60 * 24;
      const dayOfYear = Math.floor(diff / oneDay);
      const millisToday = (now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) * 1000 + now.getMilliseconds();
      const solarSubIndex = Math.floor((millisToday / (24 * 3600 * 1000)) * 10000);

      setAresSolarClock(`//${dayOfYear} / 600 / ${solarSubIndex}`);
    };

    updateClocks();
    const interval = setInterval(updateClocks, 1000);
    return () => clearInterval(interval);
  }, []);

  // Cedarhurst, NY Live Open-Meteo Weather Polling (40.6226 N, -73.7275 W)
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const unitParam = config.tempUnit === 'C' ? '&temperature_unit=celsius&wind_speed_unit=kmh' : '&temperature_unit=fahrenheit&wind_speed_unit=mph';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=40.6226&longitude=-73.7275&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=temperature_2m,weather_code,precipitation_probability&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FNew_York${unitParam}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data);
        }
      } catch (e) {
        console.error('Weather fetch error:', e);
      }
    };

    fetchWeather();
    const wxInterval = setInterval(fetchWeather, 600000); // Poll every 10 mins
    return () => clearInterval(wxInterval);
  }, [config.tempUnit]);

  // Google Calendar & iCal Stream Polling (/api/calendar)
  useEffect(() => {
    const fetchCalendar = async () => {
      try {
        const queryParam = config.icalUrl ? `?icalUrl=${encodeURIComponent(config.icalUrl)}` : '';
        const res = await fetch(`/api/calendar${queryParam}`);
        if (res.ok) {
          const data = await res.json();
          setCalendarData(data);
        }
      } catch (e) {
        console.error('Calendar stream fetch error:', e);
      }
    };

    fetchCalendar();
    const calInterval = setInterval(fetchCalendar, 300000); // Poll every 5 mins
    return () => clearInterval(calInterval);
  }, [config.icalUrl]);

  // OneDrive & Fallback Photo API Fetcher
  const fetchPhotos = async () => {
    try {
      const params = new URLSearchParams();
      if (config.folderPath) params.append('folder', config.folderPath);
      if (config.searchQuery) params.append('query', config.searchQuery);
      if (config.accessToken) params.append('token', config.accessToken);
      if (config.filterScreenshots) params.append('filterScreenshots', 'true');
      params.append('_t', Date.now());

      const res = await fetch(`/api/onedrive/photos?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.photos && data.photos.length > 0) {
          setPhotoList(data.photos);
          setCurrentIndex(0);
          return;
        }
      }
    } catch (e) {
      console.error('Error fetching OneDrive photos:', e);
    }
  };

  useEffect(() => {
    fetchPhotos();
  }, [config.folderPath, config.searchQuery, config.accessToken, config.filterScreenshots]);

  // Double-buffered Crossfade Transition Engine
  useEffect(() => {
    if (photoList.length === 0) return;

    const currentPhoto = photoList[currentIndex];
    const newUrl = currentPhoto.url;

    if (activeLayer === 1) {
      setLayer2Url(newUrl);
      setActiveLayer(2);
    } else {
      setLayer1Url(newUrl);
      setActiveLayer(1);
    }
  }, [currentIndex, photoList]);

  // Automatic Slideshow Progression Timer & Smooth Progress Bar
  useEffect(() => {
    if (isPaused || photoList.length === 0) {
      setProgressWidth(0);
      return;
    }

    const duration = config.slideDuration * 1000;
    const intervalTime = 100;
    let elapsed = 0;

    const timer = setInterval(() => {
      elapsed += intervalTime;
      setProgressWidth((elapsed / duration) * 100);

      if (elapsed >= duration) {
        setCurrentIndex((prev) => (prev + 1) % photoList.length);
        elapsed = 0;
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [currentIndex, isPaused, photoList, config.slideDuration]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const currentPhoto = photoList[currentIndex] || {
    title: 'ARES CITY SYSTEM STANDBY',
    date: '2026-07-28',
    location: 'Cedarhurst, NY',
    camera: 'ARES OPTICS 4K',
    iso: '100',
    shutter: '1/250s',
    aperture: 'f/2.8',
    description: 'System online. Connect OneDrive API in [ ⚙ CONFIG ] to display family photos.'
  };

  const formatHumanDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  // Ken Burns Animation CSS Classes
  const layer1Class = `photo-layer ${config.objectFit === 'contain' ? 'fit-contain' : ''} ${
    activeLayer === 1 ? 'active' : ''
  } ${config.enableKenBurns ? 'kenburns-1' : ''}`;

  const layer2Class = `photo-layer ${config.objectFit === 'contain' ? 'fit-contain' : ''} ${
    activeLayer === 2 ? 'active' : ''
  } ${config.enableKenBurns ? 'kenburns-2' : ''}`;

  // Calculate 6 upcoming hours starting from current local device time (America/New_York)
  const now = new Date();
  const localYear = now.getFullYear();
  const localMonth = String(now.getMonth() + 1).padStart(2, '0');
  const localDay = String(now.getDate()).padStart(2, '0');
  const localHour = String(now.getHours()).padStart(2, '0');
  const currentLocalHourISO = `${localYear}-${localMonth}-${localDay}T${localHour}`;

  let hourlyStartIdx = 0;
  if (weatherData?.hourly?.time) {
    const foundIdx = weatherData.hourly.time.findIndex((t) => typeof t === 'string' && t.startsWith(currentLocalHourISO));
    if (foundIdx !== -1) hourlyStartIdx = foundIdx;
  }
  const hourlyTimes = (weatherData?.hourly?.time || ['', '', '', '', '', '']).slice(hourlyStartIdx, hourlyStartIdx + 6);

  return (
    <div className={`ares-tv-app ui-scale-${config.uiScale || '150'} ${showControls ? 'user-active' : 'user-idle'}`}>
      {/* Full-Screen Dynamic Weather Atmospheric Effects Engine (Rain, Snow, Lightning, Sun Flare, Fog) */}
      <WeatherAtmosphereCanvas code={weatherData?.current?.weather_code ?? 0} />

      {/* 5x4 GRID MATRIX LAYOUT CONTAINER */}
      <div className="hud-5x4-grid-container">

        {/* ROW 1 (Cols 1-5): Top System Header Bar */}
        <div className="grid-cell-header">
          <header className="system-hud-bar">
            <div className="system-hud-row-top">
              <div className="hud-left-sector">
                <span className="hud-badge-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 3v18M3 12h18" />
                  </svg>
                </span>
                <div className="hud-title-stack">
                  <span className="hud-sys-tag">// ARES CITY OS</span>
                  <span className="hud-sys-name">ARES CITY TV DASHBOARD</span>
                </div>
              </div>

              {/* Center Clock & Solar Clock Sector */}
              <div className="hud-clock-sector">
                <div className="time-main-display">
                  <span className="clock-time-val">{clockTime}</span>
                  <span id="clock-ampm">{clockAmPm}</span>
                  <span className="clock-sep">•</span>
                  <span className="clock-date-val">{clockDate}</span>
                </div>
                <div className="ares-solar-clock-display">
                  <span className="solar-label">ARES SOLAR CLOCK //</span>
                  <span className="solar-digits">{aresSolarClock}</span>
                </div>
              </div>

              {/* Right Controls */}
              <div className="hud-right-sector">
                <button className="hud-btn config-hud-btn" onClick={() => setIsModalOpen(true)} title="Open Settings (M)">
                  [ ⚙ CONFIG ]
                </button>
              </div>
            </div>
          </header>
        </div>

        {/* ROWS 2-3 (Col 1): Left Column Weather Command Widget */}
        <div className="grid-cell-weather">
          {config.showWeatherSidebars !== false && (
            <div className="hud-standalone-weather-banner">
              {/* Featured Left Column: Current Live Weather */}
              <div className="wx-current-column">
                <span className="wx-curr-label">CURRENT</span>
                <div className="wx-curr-main-row">
                  <WeatherSvg code={weatherData?.current?.weather_code ?? 0} className="wx-curr-icon" />
                  <span className="wx-curr-temp">
                    {weatherData?.current?.temperature_2m !== undefined
                      ? Math.round(weatherData.current.temperature_2m)
                      : '--'}
                    °{config.tempUnit || 'F'}
                  </span>
                </div>
                <span className="wx-curr-cond">
                  {getWeatherDescription(weatherData?.current?.weather_code ?? 0)}
                </span>
                <div className="wx-curr-hilo">
                  <span className="wx-hi-val">▲{weatherData?.daily?.temperature_2m_max?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_max[0]) : '--'}°</span>
                  <span className="wx-lo-val">▼{weatherData?.daily?.temperature_2m_min?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_min[0]) : '--'}°</span>
                </div>
                <span className="wx-curr-meta">
                  HUM {weatherData?.current?.relative_humidity_2m ?? '--'}% • WIND {weatherData?.current?.wind_speed_10m !== undefined ? Math.round(weatherData.current.wind_speed_10m) : '--'} {config.tempUnit === 'C' ? 'KMH' : 'MPH'}
                </span>
              </div>

              {/* Vertical Neon Divider */}
              <div className="wx-unified-divider" />

              {/* Right Columns: 6-Hour Hourly Forecast Sequence */}
              <div className="wx-hourly-sequence">
                {hourlyTimes.map((timeStr, idx) => {
                  const globalIdx = hourlyStartIdx + idx;
                  const code = weatherData?.hourly?.weather_code?.[globalIdx] ?? 0;
                  const temp = weatherData?.hourly?.temperature_2m?.[globalIdx];
                  const pop = weatherData?.hourly?.precipitation_probability?.[globalIdx] ?? 0;
                  const label = formatHourLabel(timeStr, idx);

                  return (
                    <div key={idx} className="wx-hourly-item">
                      <span className="wx-hr-time">{label}</span>
                      <WeatherSvg code={code} className="wx-hr-icon" />
                      <span className="wx-hr-temp">
                        {temp !== undefined ? Math.round(temp) : '--'}°
                      </span>
                      <span className="wx-hr-pop">{pop}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ROWS 2-3 (Cols 2-5): Centerpiece Featured 16:9 Photo Slideshow Viewport */}
        <div className="grid-cell-slideshow">
          {config.showMiddleSlideshow !== false && (
            <div className="slideshow-viewport-centered">
              <div className="card-corner card-corner--tl" />
              <div className="card-corner card-corner--tr" />
              <div className="card-corner card-corner--bl" />
              <div className="card-corner card-corner--br" />

              <div
                className={layer1Class}
                style={{ backgroundImage: layer1Url ? `url("${layer1Url}")` : 'none' }}
              />
              <div
                className={layer2Class}
                style={{ backgroundImage: layer2Url ? `url("${layer2Url}")` : 'none' }}
              />
              <div className="photo-overlay-vignette" />

              {/* Flex Top Badge Header Bar (Slide Counter + Photo Taken Date) */}
              <div className="photo-frame-top-bar">
                <div className="hero-date-badge slide-counter-badge">
                  <span className="badge-icon">🖼️</span>
                  <div className="badge-text-group">
                    <span className="badge-sub-label">SLIDE / PHOTO</span>
                    <span className="badge-main-date">
                      {String(currentIndex + 1).padStart(2, '0')} / {String(photoList.length).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                <div className="hero-date-badge photo-date-badge">
                  <span className="badge-icon">📅</span>
                  <div className="badge-text-group">
                    <span className="badge-sub-label">PHOTO TAKEN</span>
                    <span className="badge-main-date">{formatHumanDate(currentPhoto.date)}</span>
                  </div>
                </div>
              </div>

              {/* Integrated Glass Caption Footer inside Photo Frame */}
              <div className="photo-meta-card-integrated">
                <div className="meta-card-header">
                  <div className="meta-title-group">
                    <span className="meta-sector-label">📍 LOCATION // {currentPhoto.location}</span>
                    <h2 className="photo-title">{currentPhoto.description || currentPhoto.title}</h2>
                  </div>
                  <div className="meta-controls-quick">
                    <button
                      className="hud-btn hud-btn-icon"
                      onClick={() => setCurrentIndex((prev) => (prev - 1 + photoList.length) % photoList.length)}
                      title="Previous Photo (Left Arrow)"
                    >
                      ◀
                    </button>
                    <button
                      className="hud-btn hud-btn-icon"
                      onClick={() => setIsPaused((prev) => !prev)}
                      title="Pause / Play (Spacebar)"
                    >
                      {isPaused ? '▶' : '⏸'}
                    </button>
                    <button
                      className="hud-btn hud-btn-icon"
                      onClick={() => setCurrentIndex((prev) => (prev + 1) % photoList.length)}
                      title="Next Photo (Right Arrow)"
                    >
                      ▶
                    </button>
                    <button
                      className="hud-btn hud-btn-icon"
                      onClick={() => saveConfig({ ...config, enableScanlines: !config.enableScanlines })}
                      title="Toggle Scanlines (S)"
                    >
                      ⚡
                    </button>
                    <button className="hud-btn hud-btn-icon" onClick={toggleFullscreen} title="Toggle Fullscreen (F)">
                      ⛶
                    </button>
                  </div>
                </div>

                {/* Slide Progress Bar */}
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${progressWidth}%` }} />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ROWS 2-3 (Col 5): Right Column 5-Day Daily Weather Forecast Widget */}
        <div className="grid-cell-right">
          {config.showWeatherSidebars !== false && (
            <div className="hud-5day-forecast-banner">
              <div className="forecast-header">
                <span className="forecast-tag">// CEDARHURST FORECAST</span>
                <h3 className="forecast-title">5-DAY OUTLOOK</h3>
              </div>
              <div className="forecast-days-list">
                {(weatherData?.daily?.time || []).slice(0, 5).map((dateStr, idx) => {
                  const dateObj = new Date(dateStr + 'T00:00:00');
                  const dayName = isNaN(dateObj.getTime())
                    ? `DAY ${idx + 1}`
                    : idx === 0
                    ? 'TODAY'
                    : dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
                  const code = weatherData?.daily?.weather_code?.[idx] ?? 0;
                  const maxTemp = weatherData?.daily?.temperature_2m_max?.[idx];
                  const minTemp = weatherData?.daily?.temperature_2m_min?.[idx];

                  return (
                    <div key={idx} className="forecast-day-row">
                      <span className="f-day-name">{dayName}</span>
                      <WeatherSvg code={code} className="f-day-icon" />
                      <div className="f-day-temps">
                        <span className="f-hi">{maxTemp !== undefined ? Math.round(maxTemp) : '--'}°</span>
                        <span className="f-lo">{minTemp !== undefined ? Math.round(minTemp) : '--'}°</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ROW 4 (Cols 1-5): Bottom Spanning Google Calendar Stream */}
        <div className="grid-cell-calendar">
          <div className="hud-calendar-section-wrapper">
            <div className="hud-calendar-header-banner">
              <div className="hud-cal-title-group">
                <span className="hud-cal-badge-icon">📅</span>
                <div className="hud-cal-text-stack">
                  <span className="hud-cal-sys-tag">// GOOGLE CALENDAR STREAM</span>
                  <h3 className="hud-cal-main-title">ARES CITY SCHEDULE & UPCOMING EVENTS</h3>
                </div>
              </div>
              {calendarData?.source && (
                <span className={`hud-cal-source-pill source-${calendarData.source}`}>
                  ● SYNC: {calendarData.source.toUpperCase().replace('_', ' ')}
                </span>
              )}
            </div>

            {!calendarData?.isConnected ? (
              <div className="hud-cal-disconnected-card">
                <div className="hud-cal-disc-icon-badge">📅</div>
                <div className="hud-cal-disc-text-stack">
                  <h3 className="hud-cal-disc-title">Connect to a Google Calendar</h3>
                  <p className="hud-cal-disc-sub">
                    Run <code style={{ color: '#00f0ff' }}>./scripts/google-calendar-login.sh</code> over SSH on your Raspberry Pi to pair Google Calendar, or paste your iCal feed URL in <strong>[ ⚙ CONFIG ]</strong>.
                  </p>
                </div>
                <button className="hud-btn config-hud-btn" onClick={() => setIsModalOpen(true)}>
                  [ ⚙ CONFIGURE CALENDAR ]
                </button>
              </div>
            ) : (
              <div className="hud-calendar-ribbon-layout">
                {/* 1-Row Horizontal Stream of Upcoming Days/Events */}
                <div className="hud-cal-horizontal-stream">
                  {/* Lead UP NEXT Card inside Calendar Stream */}
                  {calendarData?.upNext && (
                    <div className={`ribbon-event-card up-next-ribbon-card ${calendarData.upNext.isLive ? 'ribbon-live' : 'ribbon-upnext'}`}>
                      <div className="ribbon-card-header">
                        <span className={calendarData.upNext.isLive ? 'ribbon-tag-live' : 'ribbon-tag-upnext'}>
                          <span className={calendarData.upNext.isLive ? 'live-pulse-dot' : 'up-next-pulse'} />
                          {calendarData.upNext.isLive ? 'LIVE NOW' : 'UP NEXT'}
                        </span>
                        <span className="ribbon-time">{calendarData.upNext.startTime}</span>
                      </div>
                      <span className="ribbon-event-title">{calendarData.upNext.title}</span>
                      {calendarData.upNext.location ? (
                        <>
                          <span className="ribbon-event-loc">
                            📍 {calendarData.upNext.locationMain || calendarData.upNext.location}
                          </span>
                          {calendarData.upNext.locationSub && (
                            <span className="ribbon-event-loc-sub">{calendarData.upNext.locationSub}</span>
                          )}
                        </>
                      ) : null}
                      <LocationMiniMap
                        location={calendarData.upNext.locationClean || calendarData.upNext.location || ''}
                        meetingUrl={calendarData.upNext.meetingUrl || ''}
                        compact
                      />
                    </div>
                  )}

                  {/* Today's Remaining Events */}
                  {calendarData?.todayEvents?.map((evt) => (
                    <div key={evt.id} className={`ribbon-event-card ${evt.isLive ? 'ribbon-live' : 'ribbon-today'}`}>
                      <div className="ribbon-card-header">
                        {evt.isLive ? (
                          <span className="ribbon-tag-live">
                            <span className="live-pulse-dot" /> LIVE
                          </span>
                        ) : (
                          <span className="ribbon-tag-today">TODAY</span>
                        )}
                        <span className="ribbon-time">{evt.startTime}</span>
                      </div>
                      <span className="ribbon-event-title">{evt.title}</span>
                      {evt.location ? (
                        <>
                          <span className="ribbon-event-loc">
                            📍 {evt.locationMain || evt.location}
                          </span>
                          {evt.locationSub && (
                            <span className="ribbon-event-loc-sub">{evt.locationSub}</span>
                          )}
                        </>
                      ) : null}
                      <LocationMiniMap
                        location={evt.locationClean || evt.location || ''}
                        meetingUrl={evt.meetingUrl || ''}
                        compact
                      />
                    </div>
                  ))}

                  {/* Upcoming Week Days */}
                  {calendarData?.weekDays?.map((day) =>
                    day.events?.map((e) => (
                      <div key={`${day.dateKey}-${e.id}`} className="ribbon-event-card">
                        <div className="ribbon-card-header">
                          <span className="ribbon-tag-weekday">
                            {day.dayName.toUpperCase()} • {day.shortDate}
                          </span>
                          <span className="ribbon-time">{e.startTime}</span>
                        </div>
                        <span className="ribbon-event-title">{e.title}</span>
                        {e.location ? (
                          <>
                            <span className="ribbon-event-loc">
                              📍 {e.locationMain || e.location}
                            </span>
                            {e.locationSub && (
                              <span className="ribbon-event-loc-sub">{e.locationSub}</span>
                            )}
                          </>
                        ) : null}
                        <LocationMiniMap
                          location={e.locationClean || e.location || ''}
                          meetingUrl={e.meetingUrl || ''}
                          compact
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Overlays */}
      <div className="city-matrix-underlay" />

      {/* Screen Corner Brackets */}
      <div className="avatar-corner avatar-corner--tl" />
      <div className="avatar-corner avatar-corner--tr" />
      <div className="avatar-corner avatar-corner--bl" />
      <div className="avatar-corner avatar-corner--br" />

      {/* Settings Modal */}
      <div className={`modal-backdrop ${isModalOpen ? 'active' : ''}`}>
        <div className="settings-modal-card">
          <div className="modal-header">
            <h3>[ ⚙ DASHBOARD CONFIGURATION ]</h3>
            <button className="hud-btn hud-btn-icon" onClick={() => setIsModalOpen(false)}>
              ✕
            </button>
          </div>

          <div className="modal-body">
            <div className="settings-grid">
              <div className="settings-group">
                <h4 className="group-title">// GOOGLE CALENDAR / ICAL FEED</h4>
                <div className="form-row">
                  <label>Paste iCal Secret URL (.ics):</label>
                  <input
                    type="text"
                    placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                    value={config.icalUrl || ''}
                    onChange={(e) => saveConfig({ ...config, icalUrl: e.target.value })}
                  />
                  <small style={{ color: 'rgba(255, 255, 255, 0.5)', marginTop: 4, display: 'block' }}>
                    Paste your private Google Calendar iCal secret address from Google Calendar Settings.
                  </small>
                </div>
              </div>

              <div className="settings-group">
                <h4 className="group-title">// SLIDESHOW & DISPLAY SETTINGS</h4>
                <div className="form-row">
                  <label>Photo Sizing Mode:</label>
                  <select
                    value={config.objectFit || 'contain'}
                    onChange={(e) => saveConfig({ ...config, objectFit: e.target.value })}
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid var(--color-hud-border-cyan)',
                      color: 'var(--color-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      padding: '8px 12px',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  >
                    <option value="contain">Fit Entire Photo (No Cropping)</option>
                    <option value="cover">Fill Screen (Crop Edges)</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Slide Duration (Seconds):</label>
                  <input
                    type="number"
                    min="3"
                    max="120"
                    value={config.slideDuration}
                    onChange={(e) => setConfig({ ...config, slideDuration: parseInt(e.target.value) || 15 })}
                  />
                </div>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-desc"
                    checked={config.showDescription}
                    onChange={(e) => setConfig({ ...config, showDescription: e.target.checked })}
                  />
                  <label htmlFor="cfg-desc">Display Photo Description & Caption</label>
                </div>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-middleslideshow"
                    checked={config.showMiddleSlideshow !== false}
                    onChange={(e) => setConfig({ ...config, showMiddleSlideshow: e.target.checked })}
                  />
                  <label htmlFor="cfg-middleslideshow">Display Center Photo Slideshow Frame</label>
                </div>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-kenburns"
                    checked={config.enableKenBurns}
                    onChange={(e) => setConfig({ ...config, enableKenBurns: e.target.checked })}
                  />
                  <label htmlFor="cfg-kenburns">Enable 15s Ken Burns Pan & Zoom Animation</label>
                </div>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-scanlines"
                    checked={config.enableScanlines}
                    onChange={(e) => setConfig({ ...config, enableScanlines: e.target.checked })}
                  />
                  <label htmlFor="cfg-scanlines">Enable CRT Scanline HUD Effect</label>
                </div>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-fallback"
                    checked={config.enableFallbackDemo}
                    onChange={(e) => setConfig({ ...config, enableFallbackDemo: e.target.checked })}
                  />
                  <label htmlFor="cfg-fallback">Enable Demo Photos if disconnected</label>
                </div>
              </div>

              <div className="settings-group">
                <h4 className="group-title">// CEDARHURST, NY WEATHER SIDEBARS</h4>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-weather"
                    checked={config.showWeatherSidebars !== false}
                    onChange={(e) => setConfig({ ...config, showWeatherSidebars: e.target.checked })}
                  />
                  <label htmlFor="cfg-weather">
                    Display Cedarhurst Weather Sidebars (Left Telemetry & Right 5-Day Forecast)
                  </label>
                </div>
                <div className="form-row">
                  <label>Temperature Units:</label>
                  <select
                    value={config.tempUnit || 'F'}
                    onChange={(e) => setConfig({ ...config, tempUnit: e.target.value })}
                    style={{
                      background: 'rgba(0, 0, 0, 0.6)',
                      border: '1px solid var(--color-hud-border-cyan)',
                      color: 'var(--color-cyan)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.85rem',
                      padding: '8px 12px',
                      borderRadius: 6,
                      outline: 'none'
                    }}
                  >
                    <option value="F">Fahrenheit (°F)</option>
                    <option value="C">Celsius (°C)</option>
                  </select>
                </div>
              </div>

              <div className="settings-group">
                <h4 className="group-title">// ONEDRIVE PHOTO ALBUM CONNECTION</h4>
                <div className="form-row">
                  <label>Folder Name / Path:</label>
                  <input
                    type="text"
                    placeholder="e.g. Pictures/Family or FamilyPhotos"
                    value={config.folderPath}
                    onChange={(e) => setConfig({ ...config, folderPath: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>Search Query / Keyword:</label>
                  <input
                    type="text"
                    placeholder="e.g. Vacation, Family, 2024"
                    value={config.searchQuery}
                    onChange={(e) => setConfig({ ...config, searchQuery: e.target.value })}
                  />
                </div>
                <div className="form-row">
                  <label>OneDrive Access Token (Optional):</label>
                  <input
                    type="password"
                    placeholder="Paste Graph API token if needed"
                    value={config.accessToken}
                    onChange={(e) => setConfig({ ...config, accessToken: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {testResult && <div className="test-result-banner">{testResult}</div>}
          </div>

          <div className="modal-footer">
            <button className="hud-btn" onClick={() => setIsModalOpen(false)}>
              [ CLOSE ]
            </button>
            <button className="hud-btn hud-btn-primary" onClick={() => setIsModalOpen(false)}>
              [ SAVE CONFIGURATION ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
