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

// Vector Transit Icons (Replacing Emojis)
function TransitHubIcon({ className = 'transit-icon' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
      <rect x="4" y="3" width="16" height="13" rx="2" />
      <path d="M4 10h16" />
      <path d="M12 3v7" />
      <path d="M8 16l-2 4" />
      <path d="M16 16l2 4" />
      <circle cx="8" cy="13" r="1" fill="currentColor" />
      <circle cx="16" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function TrainIcon({ className = 'transit-icon' }) {
  return (
    <svg className={className} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
      <rect x="5" y="3" width="14" height="13" rx="2" />
      <path d="M5 9h14" />
      <circle cx="9" cy="13" r="1" fill="currentColor" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M7 16l-2 5" />
      <path d="M17 16l2 5" />
    </svg>
  );
}

function FerryIcon({ className = 'transit-icon' }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}>
      <path d="M4 18c2 0 3-1 5-1s3 1 5 1 3-1 5-1" />
      <path d="M2 21c2 0 3-1 5-1s3 1 5 1 3-1 5-1" />
      <path d="M4 14l2-6h12l2 6" />
      <path d="M9 8V4h6v4" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', margin: '0 6px', verticalAlign: 'middle', opacity: 0.8 }}>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
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

const DEFAULT_DEMO_PHOTOS = [
  {
    id: 'demo-1',
    title: 'Ares Habitat Surface Survey',
    description: 'High-resolution atmospheric survey captured by Rover Optical Unit 4 over the eastern flank of Ares Crater.',
    date: '2026-07-21 18:45',
    location: 'Ares Crater, Mars System',
    camera: 'Ares Rover Optical Cam 4K',
    exif: '24mm • f/4.0 • 1/1000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-2',
    title: 'Nebula Horizon Over City',
    description: 'Long exposure nocturnal panoramic of the metropolis baseline.',
    date: '2026-06-15 22:10',
    location: 'Citizen Suite Penthouse',
    camera: 'Sony Alpha A7 IV',
    exif: '35mm • f/1.8 • 1/60s • ISO 800',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-3',
    title: 'Pressurized Mountain Pass',
    description: 'Crisp alpine morning vista captured along Sector 02 high-altitude transit corridor.',
    date: '2026-05-04 11:30',
    location: 'Sector 02 Alpine Loop',
    camera: 'Fujifilm X-T5',
    exif: '16mm • f/8.0 • 1/250s • ISO 200',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-4',
    title: 'Cosmic Reflection Lake',
    description: 'Serene sunrise framing the bio-dome reflection pools in the Northern Colony Sanctuary.',
    date: '2026-04-12 05:20',
    location: 'Northern Colony Sanctuary',
    camera: 'Canon EOS R5',
    exif: '50mm • f/1.4 • 1/4000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-5',
    title: 'Deep Space Orbital Aurora',
    description: 'Orbital spectrograph tracking magnetic field oscillations in upper thermosphere.',
    date: '2026-03-29 02:15',
    location: 'Ares City Orbital Platform',
    camera: 'Orbital Tele-Array Mark III',
    exif: '85mm • f/1.2 • 1/30s • ISO 1600',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000&auto=format&fit=crop'
  }
];

export default function Home() {
  const [photoList, setPhotoList] = useState(DEFAULT_DEMO_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [progressWidth, setProgressWidth] = useState(0);
  const [layer1Url, setLayer1Url] = useState(DEFAULT_DEMO_PHOTOS[0].url);
  const [layer2Url, setLayer2Url] = useState('');
  const [activeLayer, setActiveLayer] = useState(1); // 1 or 2
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResult, setTestResult] = useState('');

  // 100% Vector Fit-to-Viewport Canvas Scaler State
  const [canvasScale, setCanvasScale] = useState(1);
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w <= 768) {
        setIsMobileViewport(true);
        setCanvasScale(1);
      } else {
        setIsMobileViewport(false);
        const scaleX = w / 1920;
        const scaleY = h / 1080;
        const scale = Math.min(scaleX, scaleY);
        setCanvasScale(scale);
      }
    }

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real-time clock states (Local NY & Ares Solar Clock)
  const [clockTime, setClockTime] = useState('');
  const [clockAmPm, setClockAmPm] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [aresSolarClock, setAresSolarClock] = useState('');

  // Cedarhurst Open-Meteo Live Weather & Forecast Data
  const [weatherData, setWeatherData] = useState(null);

  // Live Google Calendar & iCal Stream Data
  const [calendarData, setCalendarData] = useState(null);

  // Live Commuter Transit Data (LIRR & NYC Ferry)
  const [transitData, setTransitData] = useState(null);

  // Dashboard Configuration Settings
  const [config, setConfig] = useState({
    folderPath: 'Pictures',
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

      // Authentic Clancy Martian Year 38 (MY38) Planetary Solar Time Engine
      // Epoch Start: November 12, 2024, 00:00:00 UTC (1 Sol = 88775.244 seconds)
      const MY38_EPOCH_UTC = new Date('2024-11-12T00:00:00Z').getTime();
      const currentUTC = now.getTime();
      const diffSeconds = (currentUTC - MY38_EPOCH_UTC) / 1000;
      const SOL_IN_SECONDS = 88775.244;

      const totalSols = diffSeconds / SOL_IN_SECONDS;
      const marsYear = 38;
      const currentSol = Math.floor(totalSols);
      const solFractionDecimal = totalSols - currentSol;
      const solFraction4Digit = String(Math.floor(solFractionDecimal * 10000)).padStart(4, '0');

      setAresSolarClock(`// ${marsYear} / ${currentSol} / ${solFraction4Digit}`);
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

  // Real-Time Commuter Transit Polling (/api/transit)
  useEffect(() => {
    const fetchTransit = async () => {
      try {
        const res = await fetch('/api/transit');
        if (res.ok) {
          const data = await res.json();
          setTransitData(data);
        }
      } catch (e) {
        console.error('Transit fetch error:', e);
      }
    };

    fetchTransit();
    const transitInterval = setInterval(fetchTransit, 30000); // Poll every 30 secs
    return () => clearInterval(transitInterval);
  }, []);

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
        const incomingPhotos = (data.photos && data.photos.length > 0)
          ? data.photos
          : (data.demoPhotos && data.demoPhotos.length > 0 ? data.demoPhotos : DEFAULT_DEMO_PHOTOS);
        setPhotoList(incomingPhotos);
        return;
      }
    } catch (e) {
      console.error('Error fetching OneDrive photos:', e);
    }
    setPhotoList(DEFAULT_DEMO_PHOTOS);
  };

  const [failedUrls, setFailedUrls] = useState(new Set());

  useEffect(() => {
    fetchPhotos();

    // Background photo list refresh every 15 minutes for 24/7 TV displays
    const refreshInterval = setInterval(() => {
      fetchPhotos();
    }, 15 * 60 * 1000);

    return () => clearInterval(refreshInterval);
  }, [config.folderPath, config.searchQuery, config.accessToken, config.filterScreenshots]);

  // Preload upcoming photos into browser cache for zero-lag crossfade transitions
  useEffect(() => {
    if (!photoList || photoList.length === 0) return;

    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentIndex + i) % photoList.length;
      const targetPhoto = photoList[nextIndex];
      if (targetPhoto && targetPhoto.url && !failedUrls.has(targetPhoto.url)) {
        const img = new Image();
        img.src = targetPhoto.url;
      }
    }
  }, [currentIndex, photoList, failedUrls]);

  // Fail-Safe Double-Buffered Crossfade Transition Engine
  useEffect(() => {
    if (photoList.length === 0) return;

    const currentPhoto = photoList[currentIndex];
    const newUrl = currentPhoto ? currentPhoto.url : '';
    if (!newUrl) return;

    // If photo URL previously failed, automatically skip to next slide
    if (failedUrls.has(newUrl)) {
      const timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % photoList.length);
      }, 100);
      return () => clearTimeout(timer);
    }

    let isMounted = true;
    const img = new Image();

    img.onload = () => {
      if (!isMounted) return;
      // Image is 100% verified and loaded in memory — transition layer safely
      if (activeLayer === 1) {
        setLayer2Url(newUrl);
        setActiveLayer(2);
      } else {
        setLayer1Url(newUrl);
        setActiveLayer(1);
      }
    };

    img.onerror = () => {
      if (!isMounted) return;
      console.warn(`[Photo Slideshow] Photo failed to load (${newUrl}). Skipping slide.`);
      setFailedUrls((prev) => new Set([...prev, newUrl]));
      setCurrentIndex((prev) => (prev + 1) % photoList.length);
    };

    img.src = newUrl;

    return () => {
      isMounted = false;
    };
  }, [currentIndex, photoList, failedUrls]);

  // Automatic Slideshow Progression Timer Engine
  useEffect(() => {
    if (isPaused || photoList.length === 0) return;

    const slideDuration = config.slideDuration || 15;
    const durationMs = slideDuration * 1000;

    // Advance slide when duration completes
    const slideTimer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % photoList.length);
    }, durationMs);

    return () => clearTimeout(slideTimer);
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
    <div className={`ares-tv-app tactical-matrix-viewport ${showControls ? 'user-active' : 'user-idle'}`}>
      {/* Dynamic Background Atmospheric Weather Canvas */}
      <WeatherAtmosphereCanvas code={weatherData?.current?.weather_code ?? 0} />

      {/* TOP HUD HEADER BAR */}
      <header className="matrix-header-hud">
            <div className="matrix-header-left">
              <div className="matrix-brand-badge">
                <span className="matrix-brand-tag">// ARES OS</span>
                <span className="matrix-brand-title">50" TV COMMAND HUD</span>
              </div>
            </div>

            {/* Center Clock Focal Display */}
            <div className="matrix-clock-center">
              <span className="matrix-clock-digits">{clockTime || '05:01:37'}</span>
              <span className="matrix-clock-ampm">{clockAmPm || 'PM'}</span>
              <span className="matrix-clock-date">{clockDate || 'WED, JUL 29, 2026'}</span>
            </div>

            <div className="matrix-header-right">
              <div className="matrix-sol-clock">
                <span className="sol-clock-label">ARES SOLAR TIME</span>
                <span className="sol-clock-val">{aresSolarClock || 'SOL 1420 // 14:32'}</span>
              </div>
              <div className="matrix-status-pill">
                <span className="status-pulse-dot" />
                <span>SYS: ONLINE (100%)</span>
              </div>
              <button className="hud-btn config-hud-btn" onClick={() => setIsModalOpen(true)}>
                [ ⚙ CONFIG ]
              </button>
            </div>
          </header>

          {/* MAIN 3-COLUMN TACTICAL MATRIX GRID */}
          <main className="matrix-main-grid">
            
            {/* QUADRANT 1: LEFT COLUMN (WEATHER & COMMUTER TRANSIT HUB) */}
            <section className="quadrant-left-col">
              
              {/* 1A: ATMOSPHERIC TELEMETRY CARD */}
              <div className="matrix-card card-weather-telemetry">
                <div className="matrix-card-title-row">
                  <span className="matrix-card-title">
                    ⚡ ATMOSPHERIC TELEMETRY
                  </span>
                  <span className="matrix-card-tag">CEDARHURST, NY</span>
                </div>

                <div className="weather-hero-row">
                  <div className="weather-hero-temp-group">
                    <span className="weather-hero-temp">
                      {weatherData?.current?.temperature_2m !== undefined
                        ? Math.round(weatherData.current.temperature_2m)
                        : '74'}
                    </span>
                    <span className="weather-hero-unit">°{config.tempUnit || 'F'}</span>
                  </div>
                  <WeatherSvg code={weatherData?.current?.weather_code ?? 0} className="weather-hero-icon" />
                </div>

                <div className="weather-cond-badge">
                  {getWeatherDescription(weatherData?.current?.weather_code ?? 0)}
                </div>

                <div className="weather-sub-metrics-grid">
                  <div className="metric-pill">
                    <span className="metric-pill-label">HUMIDITY</span>
                    <span className="metric-pill-val">{weatherData?.current?.relative_humidity_2m ?? '64'}%</span>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-pill-label">WIND</span>
                    <span className="metric-pill-val">{weatherData?.current?.wind_speed_10m !== undefined ? Math.round(weatherData.current.wind_speed_10m) : '12'} MPH</span>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-pill-label">TEMP HI/LO</span>
                    <span className="metric-pill-val">
                      ▲{weatherData?.daily?.temperature_2m_max?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_max[0]) : '82'}° / ▼{weatherData?.daily?.temperature_2m_min?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_min[0]) : '68'}°
                    </span>
                  </div>
                  <div className="metric-pill">
                    <span className="metric-pill-label">BAROMETER</span>
                    <span className="metric-pill-val">30.12 inHg</span>
                  </div>
                </div>

                {/* 6-Hour Mini-Forecast Strip */}
                <div className="hourly-strip-container">
                  {hourlyTimes.map((timeStr, idx) => {
                    const globalIdx = hourlyStartIdx + idx;
                    const code = weatherData?.hourly?.weather_code?.[globalIdx] ?? 0;
                    const temp = weatherData?.hourly?.temperature_2m?.[globalIdx];
                    const pop = weatherData?.hourly?.precipitation_probability?.[globalIdx] ?? 0;
                    const label = formatHourLabel(timeStr, idx);

                    return (
                      <div key={idx} className="hourly-mini-item">
                        <span className="hourly-mini-time">{label}</span>
                        <WeatherSvg code={code} className="wx-hr-icon" />
                        <span className="hourly-mini-temp">{temp !== undefined ? Math.round(temp) : '74'}°</span>
                        <span className="hourly-mini-pop">{pop}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 1B: COMMUTER TRANSIT HUB CARD (OFFICIAL MTA GTFS DATASET) */}
              <div className="matrix-card card-transit-hub">
                <div className="matrix-card-title-row">
                  <span className="matrix-card-title" style={{ display: 'flex', alignItems: 'center' }}>
                    <TransitHubIcon /> COMMUTER TRANSIT HUB
                  </span>
                  <span className="matrix-card-tag" style={{ color: 'var(--color-cyan)' }}>
                    {transitData?.statusNotice || '● LIVE GTFS TELEMETRY'}
                  </span>
                </div>

                {/* LIRR Cedarhurst Westbound */}
                <div className="transit-terminal-block">
                  <div className="transit-header-row">
                    <span className="transit-line-title transit-lirr-westbound" style={{ display: 'flex', alignItems: 'center' }}>
                      <TrainIcon /> LIRR WESTBOUND // CEDARHURST
                    </span>
                    <span className="transit-countdown-pill pill-grey">
                      {transitData?.lirr?.nextWestbound
                        ? `IN ${String(transitData.lirr.nextWestbound.minsUntil).padStart(2, '0')} MINS`
                        : 'NO TRAINS'}
                    </span>
                  </div>

                  {!transitData?.lirr?.upcomingWestbound || transitData.lirr.upcomingWestbound.length === 0 ? (
                    <div className="agenda-empty-banner" style={{ margin: '8px 0', padding: '10px 8px' }}>
                      <span style={{ color: '#C0C0C0', fontSize: '0.68rem', fontWeight: '700' }}>
                        // NO UPCOMING WESTBOUND DEPARTURES
                      </span>
                    </div>
                  ) : (
                    <div className="transit-upcoming-list" style={{ marginTop: '4px' }}>
                      {transitData.lirr.upcomingWestbound.slice(0, 2).map((item, i) => (
                        <div key={i} className="transit-upcoming-item">
                          <span>{item.timeStr} <ArrowIcon /> {item.destination}</span>
                          <span style={{ color: '#C0C0C0' }}>{item.track} • {item.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* LIRR Cedarhurst Eastbound */}
                <div className="transit-terminal-block">
                  <div className="transit-header-row">
                    <span className="transit-line-title transit-lirr-eastbound" style={{ display: 'flex', alignItems: 'center' }}>
                      <TrainIcon /> LIRR EASTBOUND // CEDARHURST
                    </span>
                    <span className="transit-countdown-pill pill-brown">
                      {transitData?.lirr?.nextEastbound
                        ? `IN ${String(transitData.lirr.nextEastbound.minsUntil).padStart(2, '0')} MINS`
                        : 'NO TRAINS'}
                    </span>
                  </div>

                  {!transitData?.lirr?.upcomingEastbound || transitData.lirr.upcomingEastbound.length === 0 ? (
                    <div className="agenda-empty-banner" style={{ margin: '6px 0', padding: '8px 6px' }}>
                      <span style={{ color: '#E67E22', fontSize: '0.68rem', fontWeight: '700' }}>
                        // NO UPCOMING EASTBOUND DEPARTURES
                      </span>
                    </div>
                  ) : (
                    <div className="transit-upcoming-list" style={{ marginTop: '4px' }}>
                      {transitData.lirr.upcomingEastbound.slice(0, 2).map((item, i) => (
                        <div key={i} className="transit-upcoming-item">
                          <span>{item.timeStr} <ArrowIcon /> {item.destination}</span>
                          <span style={{ color: '#E67E22' }}>{item.track} • {item.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* NYC Ferry Section */}
                <div className="transit-terminal-block">
                  <div className="transit-header-row">
                    <span className="transit-line-title transit-ferry" style={{ display: 'flex', alignItems: 'center' }}>
                      <FerryIcon /> NYC FERRY // ROCKAWAY LANDING
                    </span>
                    <span className="transit-countdown-pill pill-purple">
                      {transitData?.ferry?.nextSailing
                        ? `IN ${String(transitData.ferry.nextSailing.minsUntil).padStart(2, '0')} MINS`
                        : 'NO SAILINGS'}
                    </span>
                  </div>

                  {!transitData?.ferry?.upcomingSailings || transitData.ferry.upcomingSailings.length === 0 ? (
                    <div className="agenda-empty-banner" style={{ margin: '6px 0', padding: '8px 6px' }}>
                      <span style={{ color: '#B15EFF', fontSize: '0.68rem', fontWeight: '700' }}>
                        // NO UPCOMING FERRY SAILINGS
                      </span>
                    </div>
                  ) : (
                    <div className="transit-upcoming-list" style={{ marginTop: '4px' }}>
                      {transitData.ferry.upcomingSailings.slice(0, 2).map((item, i) => (
                        <div key={i} className="transit-upcoming-item">
                          <span>{item.timeStr} <ArrowIcon /> {item.destination}</span>
                          <span style={{ color: '#B15EFF' }}>{item.status}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            </section>

            {/* QUADRANT 2: CENTER HERO COLUMN (RECON VISUAL FRAME / PHOTO SLIDESHOW) */}
            <section className="quadrant-center-col">
              <div className="matrix-card card-photo-hero">
                
                {/* Top Glass Floating Badges */}
                <div className="photo-hero-top-badges">
                  <div className="hud-glass-badge">
                    <span className="hud-glass-badge-label">FRAME / SLIDE</span>
                    <span className="hud-glass-badge-val">
                      {String(currentIndex + 1).padStart(2, '0')} / {String(photoList.length || 14).padStart(2, '0')}
                    </span>
                  </div>
                  <div className="hud-glass-badge">
                    <span className="hud-glass-badge-label">PHOTO TAKEN</span>
                    <span className="hud-glass-badge-val">
                      {formatHumanDate(currentPhoto?.date) || 'JULY 24, 2026'}
                    </span>
                  </div>
                </div>

                {/* Photo Layers with Ken Burns Motion Engine */}
                <div
                  className={layer1Class}
                  style={{ backgroundImage: layer1Url ? `url("${layer1Url}")` : 'url("https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1600&q=80")' }}
                />
                <div
                  className={layer2Class}
                  style={{ backgroundImage: layer2Url ? `url("${layer2Url}")` : 'none' }}
                />
                <div className="photo-overlay-vignette" />

                {/* Bottom Integrated Glass Caption & Controls Footer */}
                <div className="photo-hero-caption-card">
                  <span className="photo-hero-loc">
                    📍 {currentPhoto?.location || 'CEDARHURST HAVEN'}
                  </span>
                  <h2 className="photo-hero-title">
                    {currentPhoto?.description || currentPhoto?.title || 'SUMMER SUNSET AT ROXBURY BEACH'}
                  </h2>

                  <div className="photo-hero-progress-track">
                    <div
                      key={`${currentIndex}-${isPaused}`}
                      className={`photo-hero-progress-bar ${!isPaused ? 'animating' : ''}`}
                      style={{ '--slide-duration': `${config.slideDuration || 15}s` }}
                    />
                  </div>
                </div>
              </div>
            </section>

        {/* QUADRANT 3: RIGHT COLUMN (TACTICAL AGENDA & LOCATION MINI-MAP) */}
        <section className="quadrant-right-col">
          
          {/* 3A: TACTICAL AGENDA */}
          <div className="matrix-card card-tactical-agenda">
            <div className="matrix-card-title-row">
              <span className="matrix-card-title">
                📅 TACTICAL AGENDA
              </span>
              <span className="matrix-card-tag">
                {calendarData?.source ? `SYNC: ${calendarData.source.toUpperCase().replace('_', ' ')}` : 'UPCOMING EVENTS'}
              </span>
            </div>

            {!calendarData?.isConnected ? (
              <div className="agenda-disconnected-box">
                <span className="agenda-disc-icon">📅</span>
                <span className="agenda-disc-title">CALENDAR DISCONNECTED</span>
                <p className="agenda-disc-sub">
                  Paste your Google iCal URL in Settings or run login script.
                </p>
                <button className="hud-btn config-hud-btn" onClick={() => setIsModalOpen(true)}>
                  [ ⚙ CONNECT CALENDAR ]
                </button>
              </div>
            ) : (
              <>
                {/* Lead Next Event Countdown Banner */}
                {calendarData?.upNext ? (
                  <div className="agenda-next-banner">
                    <div className="agenda-next-header">
                      <span className={calendarData.upNext.isLive ? 'next-tag next-tag-live' : 'next-tag'}>
                        {calendarData.upNext.isLive
                          ? '● LIVE NOW'
                          : calendarData.upNext.dateStr
                          ? `UP NEXT • ${calendarData.upNext.dateStr}`
                          : 'UP NEXT'}
                      </span>
                      <span className="next-countdown">
                        {calendarData.upNext.isLive
                          ? 'IN PROGRESS'
                          : calendarData.upNext.minsUntil !== undefined && calendarData.upNext.minsUntil < 60
                          ? `IN ${calendarData.upNext.minsUntil} MINS`
                          : calendarData.upNext.startTime || 'UPCOMING'}
                      </span>
                    </div>
                    <div className="next-title">{calendarData.upNext.title}</div>
                    <div className="next-time-sub">
                      ⏰ {calendarData.upNext.startTime || 'Scheduled'}
                      {calendarData.upNext.locationMain && ` • 📍 ${calendarData.upNext.locationMain}`}
                    </div>
                  </div>
                ) : (
                  <div className="agenda-empty-banner">
                    <span>// NO MORE EVENTS SCHEDULED TODAY</span>
                  </div>
                )}

                {/* Event List Stream */}
                <div className="agenda-events-stream">
                  {/* Remaining Today Events (Excluding the event already featured in UP NEXT) */}
                  {calendarData?.todayEvents
                    ?.filter((evt) => evt.id !== calendarData?.upNext?.id && evt.title !== calendarData?.upNext?.title)
                    ?.map((evt) => (
                      <div key={evt.id} className="agenda-event-row">
                        <div className="agenda-event-time">
                          📅 {evt.dateStr || 'TODAY'} • ⏰ {evt.startTime || evt.time || 'Scheduled'}{' '}
                          {evt.isLive && <span style={{ color: 'var(--color-green)' }}>● LIVE</span>}
                        </div>
                        <div className="agenda-event-name">{evt.title}</div>
                        {evt.locationMain && <div className="agenda-event-loc">📍 {evt.locationMain}</div>}
                      </div>
                    ))}

                  {/* Upcoming Week Days Events */}
                  {calendarData?.weekDays?.map((day) =>
                    day.events
                      ?.filter((e) => e.id !== calendarData?.upNext?.id && e.title !== calendarData?.upNext?.title)
                      ?.map((e) => {
                        const displayDate =
                          e.dateStr ||
                          (day.dayName
                            ? `${day.dayName.toUpperCase()}${
                                day.formattedDate || day.shortDate ? `, ${day.formattedDate || day.shortDate}` : ''
                              }`
                            : 'UPCOMING');
                        const displayTime = e.startTime || e.time || 'Scheduled';
                        return (
                          <div key={`${day.dateStr || day.dayName}-${e.id}`} className="agenda-event-row">
                            <div className="agenda-event-time">
                              📅 {displayDate} • ⏰ {displayTime}
                            </div>
                            <div className="agenda-event-name">{e.title}</div>
                            {e.locationMain && <div className="agenda-event-loc">📍 {e.locationMain}</div>}
                          </div>
                        );
                      })
                  )}

                  {(!calendarData?.todayEvents || calendarData.todayEvents.length === 0) &&
                    (!calendarData?.weekDays || calendarData.weekDays.length === 0) &&
                    !calendarData?.upNext && (
                      <div className="agenda-empty-sub">
                        <span>No upcoming events this week.</span>
                      </div>
                    )}
                </div>
              </>
            )}
          </div>

          {/* 3B: LOCATION MINI-MAP */}
          <div className="matrix-card card-location-map">
            <div className="matrix-card-title-row">
              <span className="matrix-card-title">
                🗺️ LOCATION MINI-MAP
              </span>
              <span className="matrix-card-tag">CEDARHURST & DESTINATIONS</span>
            </div>
            <div className="map-viewport-container">
              <LocationMiniMap
                location={calendarData?.upNext?.locationClean || calendarData?.upNext?.location || calendarData?.upNext?.locationMain || ''}
                meetingUrl={calendarData?.upNext?.meetingUrl || ''}
                compact
              />
            </div>
          </div>

        </section>

      </main>

      {/* BOTTOM TELEMETRY FOOTER (5vh) */}
      <footer className="matrix-footer-hud">
        <div className="footer-hotkeys-group">
          <span className="hotkey-item"><span className="hotkey-key">[F]</span> FULLSCREEN</span>
          <span className="hotkey-item"><span className="hotkey-key">[SPACE]</span> PAUSE</span>
          <span className="hotkey-item"><span className="hotkey-key">[S]</span> SCANLINES</span>
          <span className="hotkey-item"><span className="hotkey-key">[M]</span> CONFIG</span>
        </div>
        <div className="footer-sync-info">
          <span>LAST SYNC: 17:06:42</span>
          <span style={{ margin: '0 8px' }}>•</span>
          <span style={{ color: 'var(--color-cyan)' }}>CYBERPUNK ENGINE v2.0</span>
        </div>
      </footer>

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
