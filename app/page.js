'use client';

import { useState, useEffect, useRef } from 'react';

const DEMO_PHOTOS = [
  {
    id: 'demo-1',
    title: 'Ares Habitat Surface Survey',
    description: 'Atmospheric survey over the eastern flank of Ares Crater during late afternoon solar alignment.',
    date: '2026-07-21 18:45',
    location: 'Ares Crater, Mars',
    latitude: 18.45,
    longitude: -66.10,
    camera: 'Optical Rover Cam 4K',
    exif: '24mm • f/4.0 • 1/1000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-2',
    title: 'Nebula Horizon Over City',
    description: 'Long exposure nocturnal view of city lights glowing beneath passing cloud cover.',
    date: '2026-06-15 22:10',
    location: 'New York, United States',
    latitude: 40.71,
    longitude: -74.00,
    camera: 'Sony Alpha A7 IV',
    exif: '35mm • f/1.8 • 1/60s • ISO 800',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-3',
    title: 'Pressurized Mountain Pass',
    description: 'Crisp alpine morning view along the high mountain transit ridge.',
    date: '2026-05-04 11:30',
    location: 'Interlaken, Switzerland',
    latitude: 46.57,
    longitude: 7.91,
    camera: 'Fujifilm X-T5',
    exif: '16mm • f/8.0 • 1/250s • ISO 200',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-4',
    title: 'Cosmic Reflection Lake',
    description: 'Serene sunrise framing coastal bio-dome reflection pools at first light.',
    date: '2026-04-12 05:20',
    location: 'Honolulu, Hawaii',
    latitude: 21.30,
    longitude: -157.85,
    camera: 'Canon EOS R5',
    exif: '50mm • f/1.4 • 1/4000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-5',
    title: 'Deep Space Orbital Aurora',
    description: 'Spectacular aurora borealis ribbons shimmering over polar ice fields.',
    date: '2026-03-29 02:15',
    location: 'Reykjavik, Iceland',
    latitude: 64.14,
    longitude: -21.94,
    camera: 'Orbital Tele-Array Mark III',
    exif: '85mm • f/1.2 • 1/30s • ISO 1600',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000&auto=format&fit=crop'
  }
];

function formatHumanDate(rawDate) {
  if (!rawDate || rawDate === 'Unknown Date') return 'Date Taken Unknown';
  try {
    const clean = rawDate.includes('T') ? rawDate : rawDate.replace(' ', 'T');
    const d = new Date(clean);
    if (isNaN(d.getTime())) return rawDate;

    const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
    const monthDay = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    return `${weekday}, ${monthDay} • ${timeStr}`;
  } catch (e) {
    return rawDate;
  }
}

function getWeatherDescription(code) {
  if (code === 0) return 'CLEAR SKY';
  if (code === 1) return 'MAINLY CLEAR';
  if (code === 2) return 'PARTLY CLOUDY';
  if (code === 3) return 'OVERCAST';
  if (code === 45 || code === 48) return 'FOG / HAZE';
  if (code >= 51 && code <= 55) return 'LIGHT DRIZZLE';
  if (code >= 61 && code <= 65) return 'RAINY';
  if (code === 66 || code === 67) return 'FREEZING RAIN';
  if (code >= 71 && code <= 77) return 'SNOWING';
  if (code >= 80 && code <= 82) return 'RAIN SHOWERS';
  if (code === 85 || code === 86) return 'SNOW SHOWERS';
  if (code >= 95) return 'THUNDERSTORM';
  return 'FAIR WEATHER';
}

function getDayAbbrev(dateStr, isToday = false) {
  if (isToday) return 'TODAY';
  if (!dateStr || typeof dateStr !== 'string') return '---';
  const parts = dateStr.split('-');
  if (parts.length < 3) return dateStr;
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  return days[d.getDay()] || '---';
}

function WeatherSvg({ code = 0, className = 'wx-svg-container' }) {
  if (code === 0) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <g className="wx-anim-sun">
          <circle cx="32" cy="32" r="14" fill="url(#sunGrad)" />
          <g className="wx-anim-sun-rays" stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round">
            <line x1="32" y1="6" x2="32" y2="12" />
            <line x1="32" y1="52" x2="32" y2="58" />
            <line x1="6" y1="32" x2="12" y2="32" />
            <line x1="52" y1="32" x2="58" y2="32" />
            <line x1="13.6" y1="13.6" x2="17.8" y2="17.8" />
            <line x1="46.2" y1="46.2" x2="50.4" y2="50.4" />
            <line x1="13.6" y1="50.4" x2="17.8" y2="46.2" />
            <line x1="46.2" y1="17.8" x2="50.4" y2="13.6" />
          </g>
        </g>
        <defs>
          <radialGradient id="sunGrad" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 32) scale(14)">
            <stop stopColor="#ffea00" />
            <stop offset="1" stopColor="#ff9100" />
          </radialGradient>
        </defs>
      </svg>
    );
  }

  if (code >= 95) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <g className="wx-anim-cloud">
          <path d="M46 38C49.3 38 52 35.3 52 32C52 28.7 49.3 26 46 26C45.7 26 45.4 26 45.1 26.1C43.8 20.3 38.6 16 32.5 16C25.6 16 20 21.6 20 28.5C20 28.7 20 29 20 29.2C17.7 29.8 16 31.9 16 34.5C16 37.5 18.5 40 21.5 40L46 38Z" fill="url(#cloudGradDark)" />
        </g>
        <path className="wx-anim-lightning" d="M30 36L22 48H30L28 58L40 44H32L34 36Z" fill="#ffea00" />
        <g stroke="#00f0ff" strokeWidth="2" strokeLinecap="round">
          <line className="wx-anim-rain-1" x1="22" y1="44" x2="20" y2="50" />
          <line className="wx-anim-rain-2" x1="42" y1="44" x2="40" y2="50" />
        </g>
        <defs>
          <linearGradient id="cloudGradDark" x1="16" y1="16" x2="52" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4a6572" />
            <stop offset="1" stopColor="#1e272c" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <g className="wx-anim-cloud">
          <path d="M44 34C46.8 34 49 31.8 49 29C49 26.2 46.8 24 44 24C43.7 24 43.5 24 43.2 24.1C42.1 19.1 37.7 15.5 32.5 15.5C26.7 15.5 22 20.2 22 26C22 26.2 22 26.4 22 26.6C20.1 27.1 18.7 28.9 18.7 31C18.7 33.5 20.7 35.5 23.2 35.5L44 34Z" fill="url(#cloudGradRain)" />
        </g>
        <g stroke="#00f0ff" strokeWidth="2.5" strokeLinecap="round">
          <line className="wx-anim-rain-1" x1="24" y1="38" x2="21" y2="48" />
          <line className="wx-anim-rain-2" x1="33" y1="38" x2="30" y2="48" />
          <line className="wx-anim-rain-3" x1="42" y1="38" x2="39" y2="48" />
        </g>
        <defs>
          <linearGradient id="cloudGradRain" x1="18.7" y1="15.5" x2="49" y2="35.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#80d8ff" />
            <stop offset="1" stopColor="#37474f" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <g className="wx-anim-cloud">
          <path d="M44 32C46.8 32 49 29.8 49 27C49 24.2 46.8 22 44 22C43.7 22 43.5 22 43.2 22.1C42.1 17.1 37.7 13.5 32.5 13.5C26.7 13.5 22 18.2 22 24C22 24.2 22 24.4 22 24.6C20.1 25.1 18.7 26.9 18.7 29C18.7 31.5 20.7 33.5 23.2 33.5L44 32Z" fill="url(#cloudGradSnow)" />
        </g>
        <g fill="#ffffff">
          <circle className="wx-anim-snow-1" cx="24" cy="42" r="2.5" />
          <circle className="wx-anim-snow-2" cx="33" cy="44" r="2.5" />
          <circle className="wx-anim-snow-3" cx="42" cy="41" r="2.5" />
        </g>
        <defs>
          <linearGradient id="cloudGradSnow" x1="18.7" y1="13.5" x2="49" y2="33.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e0f7fa" />
            <stop offset="1" stopColor="#546e7a" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (code === 45 || code === 48) {
    return (
      <svg className={className} viewBox="0 0 64 64" fill="none">
        <g className="wx-anim-cloud">
          <path d="M44 28C46.8 28 49 25.8 49 23C49 20.2 46.8 18 44 18C43.7 18 43.5 18 43.2 18.1C42.1 13.1 37.7 9.5 32.5 9.5C26.7 9.5 22 14.2 22 20C22 20.2 22 20.4 22 20.6C20.1 21.1 18.7 22.9 18.7 25C18.7 27.5 20.7 29.5 23.2 29.5L44 28Z" fill="url(#cloudGradFog)" />
        </g>
        <g stroke="rgba(0, 240, 255, 0.7)" strokeWidth="2.5" strokeLinecap="round">
          <line x1="16" y1="36" x2="48" y2="36" />
          <line x1="20" y1="42" x2="44" y2="42" />
          <line x1="14" y1="48" x2="50" y2="48" />
        </g>
        <defs>
          <linearGradient id="cloudGradFog" x1="18.7" y1="9.5" x2="49" y2="29.5" gradientUnits="userSpaceOnUse">
            <stop stopColor="#b0bec5" />
            <stop offset="1" stopColor="#37474f" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg className={className} viewBox="0 0 64 64" fill="none">
      <g className="wx-anim-sun" transform="translate(-6, -6)">
        <circle cx="32" cy="32" r="11" fill="#ffea00" />
      </g>
      <g className="wx-anim-cloud">
        <path d="M46 36C48.8 36 51 33.8 51 31C51 28.2 48.8 26 46 26C45.7 26 45.5 26 45.2 26.1C44.1 21.1 39.7 17.5 34.5 17.5C28.7 17.5 24 22.2 24 28C24 28.2 24 28.4 24 28.6C22.1 29.1 20.7 30.9 20.7 33C20.7 35.5 22.7 37.5 25.2 37.5L46 36Z" fill="url(#cloudGradDefault)" />
      </g>
      <defs>
        <linearGradient id="cloudGradDefault" x1="20.7" y1="17.5" x2="51" y2="37.5" gradientUnits="userSpaceOnUse">
          <stop stopColor="#e0f7fa" />
          <stop offset="1" stopColor="#455a64" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function TvDashboard() {
  const [config, setConfig] = useState({
    onedriveToken: '',
    onedriveFolder: '',
    filterScreenshots: true,
    albumQuery: '',
    slideDuration: 15,
    enableKenBurns: false,
    enableScanlines: true,
    enableFallbackDemo: true,
    imageFitMode: 'contain', // 'contain' for full un-cropped photos, 'cover' for full bleed
    uiScale: '150', // '100', '125', '150', '175' for 4K TV font scaling
    showDescription: true,
    showHudCard: true,
    clockFormat: '12', // '12' or '24'
    showWeatherSidebars: true,
    tempUnit: 'F'
  });

  const [weatherData, setWeatherData] = useState(null);

  const [photoList, setPhotoList] = useState(DEMO_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnectedToOneDrive, setIsConnectedToOneDrive] = useState(false);
  const [sysStatus, setSysStatus] = useState('INITIALIZING...');
  const [isOnline, setIsOnline] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [showControls, setShowControls] = useState(true);

  // Clock state
  const [clockTime, setClockTime] = useState('00:00:00');
  const [clockAmPm, setClockAmPm] = useState('AM');
  const [clockDate, setClockDate] = useState('MON, JAN 01, 2026');
  const [aresSolarClock, setAresSolarClock] = useState('38 / 605 / 0080');

  // Layer transition state
  const [activeLayer, setActiveLayer] = useState(1);
  const [layer1Url, setLayer1Url] = useState('');
  const [layer2Url, setLayer2Url] = useState('');
  const [layer1Class, setLayer1Class] = useState('photo-layer active kenburns-1');
  const [layer2Class, setLayer2Class] = useState('photo-layer kenburns-2');
  const [progressWidth, setProgressWidth] = useState(0);

  const slideTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const startTimeRef = useRef(0);
  const idleTimerRef = useRef(null);

  // Load config from localStorage & URL scale override
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ares_tv_dashboard_config');
      let loaded = saved ? JSON.parse(saved) : {};
      
      // Allow URL parameter scale override (e.g. ?scale=150 or ?scale=175)
      const urlParams = new URLSearchParams(window.location.search);
      const urlScale = urlParams.get('scale');
      if (urlScale && ['100', '125', '150', '175'].includes(urlScale)) {
        loaded.uiScale = urlScale;
      }

      setConfig((prev) => ({ ...prev, ...loaded }));
    } catch (e) {
      // localStorage unavailable
    }
  }, []);

  // Fetch Cedarhurst, NY live weather & 5-day forecast from Open-Meteo API
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const unitParam = config.tempUnit === 'C' ? 'celsius' : 'fahrenheit';
        const windParam = config.tempUnit === 'C' ? 'kmh' : 'mph';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=40.6237&longitude=-73.7257&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&temperature_unit=${unitParam}&wind_speed_unit=${windParam}&precipitation_unit=inch&timezone=America%2FNew_York`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setWeatherData(data);
        }
      } catch (err) {
        console.error('Weather fetch error:', err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 15 * 60 * 1000); // 15 mins auto-refresh
    return () => clearInterval(interval);
  }, [config.tempUnit]);

  // Mouse movement & idle detection for TV ambient mode
  useEffect(() => {
    const handleMouseMove = () => {
      setShowControls(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        if (!isModalOpen) setShowControls(false);
      }, 3500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleMouseMove);
    
    // Initial auto-hide timer
    idleTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4000);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleMouseMove);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isModalOpen]);

  // Save config helper
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('ares_tv_dashboard_config', JSON.stringify(newConfig));
    } catch (e) {}
  };

  // Clock interval & Exhibit 04 Solar Clock calculation (38 / 605 / 0080)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;

      const hStr = String(hours).padStart(2, '0');
      const mStr = String(now.getMinutes()).padStart(2, '0');
      const sStr = String(now.getSeconds()).padStart(2, '0');

      setClockTime(`${hStr}:${mStr}:${sStr}`);
      setClockAmPm(ampm);

      const options = { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' };
      setClockDate(now.toLocaleDateString('en-US', options).toUpperCase());

      // Exhibit 04 Martian Solar Clock: MY / Sol / Decimal Sol Fraction (4 digits)
      // Epoch start Nov 12, 2024 = MY 38, MSD 53630.0
      const julianDate = now.getTime() / 86400000 + 2440587.5;
      const msd = (julianDate - 2451549.5) / 1.027491252 + 44796.0;
      const solsInMY38 = msd - 53630.0;
      const solNum = Math.floor(solsInMY38);
      const solFracNum = Math.floor((solsInMY38 - solNum) * 10000);
      const fracStr = String(Math.max(0, solFracNum)).padStart(4, '0');

      setAresSolarClock(`38 / ${solNum} / ${fracStr}`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch photos from API
  const fetchPhotos = async () => {
    try {
      const params = new URLSearchParams({
        folder: config.onedriveFolder,
        query: config.albumQuery,
        token: config.onedriveToken,
        filterScreenshots: config.filterScreenshots ? 'true' : 'false',
        _t: Date.now().toString()
      });

      const res = await fetch(`/api/onedrive/photos?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.success && data.photos && data.photos.length > 0) {
        const cleanedPhotos = data.photos.map(p => ({
          ...p,
          location: (p.location && p.location.includes('°')) ? 'Personal Collection' : (p.location || 'Personal Collection')
        }));
        setPhotoList(cleanedPhotos);
        setIsConnectedToOneDrive(true);
        setIsOnline(true);
        setSysStatus(`ONLINE (${cleanedPhotos.length} PHOTOS)`);
      } else if (config.enableFallbackDemo) {
        setPhotoList(DEMO_PHOTOS);
        setIsConnectedToOneDrive(false);
        setIsOnline(false);
        setSysStatus(`DEMO MODE (${data.reason || 'DISCONNECTED'})`);
      } else {
        setIsConnectedToOneDrive(false);
        setIsOnline(false);
        setSysStatus(`ERROR: ${data.reason || 'NO PHOTOS'}`);
      }
    } catch (e) {
      if (config.enableFallbackDemo) {
        setPhotoList(DEMO_PHOTOS);
        setIsConnectedToOneDrive(false);
        setIsOnline(false);
        setSysStatus('DEMO MODE (OFFLINE)');
      }
    }
  };

  useEffect(() => {
    fetchPhotos();
    const pollInterval = setInterval(fetchPhotos, 30000);
    return () => clearInterval(pollInterval);
  }, [config.onedriveFolder, config.albumQuery, config.onedriveToken, config.filterScreenshots]);

  // Slideshow transition logic
  const currentPhoto = photoList[currentIndex] || DEMO_PHOTOS[0];

  useEffect(() => {
    if (!currentPhoto) return;

    const kenburnsClass = currentIndex % 2 === 0 ? 'kenburns-1' : 'kenburns-2';
    const fitClass = config.imageFitMode === 'contain' ? 'fit-contain' : '';

    if (activeLayer === 1) {
      setLayer2Url(currentPhoto.url);
      setLayer2Class(`photo-layer ${fitClass} ${config.enableKenBurns ? kenburnsClass : ''} active`);
      setLayer1Class((prev) => prev.replace(' active', ''));
      setActiveLayer(2);
    } else {
      setLayer1Url(currentPhoto.url);
      setLayer1Class(`photo-layer ${fitClass} ${config.enableKenBurns ? kenburnsClass : ''} active`);
      setLayer2Class((prev) => prev.replace(' active', ''));
      setActiveLayer(1);
    }

    // Reset progress bar
    startTimeRef.current = Date.now();
    setProgressWidth(0);
  }, [currentIndex, photoList]);

  // Timer loop
  useEffect(() => {
    if (isPaused) {
      clearInterval(slideTimerRef.current);
      clearInterval(progressIntervalRef.current);
      return;
    }

    const durationMs = (config.slideDuration || 15) * 1000;
    startTimeRef.current = Date.now();

    slideTimerRef.current = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % photoList.length);
    }, durationMs);

    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      setProgressWidth(pct);
    }, 100);

    return () => {
      clearInterval(slideTimerRef.current);
      clearInterval(progressIntervalRef.current);
    };
  }, [isPaused, photoList.length, config.slideDuration, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (isModalOpen) {
        if (e.key === 'Escape') setIsModalOpen(false);
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          setCurrentIndex((prev) => (prev + 1) % photoList.length);
          break;
        case 'ArrowLeft':
          setCurrentIndex((prev) => (prev - 1 + photoList.length) % photoList.length);
          break;
        case ' ':
        case 'Enter':
          setIsPaused((prev) => !prev);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 's':
        case 'S':
          saveConfig({ ...config, enableScanlines: !config.enableScanlines });
          break;
        case 'd':
        case 'D':
          saveConfig({ ...config, showDescription: !config.showDescription });
          break;
        case 'm':
        case 'M':
        case 'c':
        case 'C':
          setIsModalOpen(true);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, photoList.length, config]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleTestConnection = async () => {
    setTestResult('Testing OneDrive connection...');
    try {
      const params = new URLSearchParams({
        folder: config.onedriveFolder,
        query: config.albumQuery,
        token: config.onedriveToken
      });
      const res = await fetch(`/api/onedrive/photos?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setTestResult(`✓ Connected! ${data.photos.length} photos loaded from OneDrive.`);
      } else {
        setTestResult(`✗ ${data.reason || 'Failed to connect'}`);
      }
    } catch (e) {
      setTestResult('✗ Network error reaching Next.js server');
    }
  };

  return (
    <div className={`ares-tv-app ui-scale-${config.uiScale || '150'} ${showControls ? 'user-active' : 'user-idle'}`}>
      {/* Background Slideshow Viewport */}
      <div className="slideshow-viewport">
        <div
          className={layer1Class}
          style={{ backgroundImage: layer1Url ? `url("${layer1Url}")` : 'none' }}
        />
        <div
          className={layer2Class}
          style={{ backgroundImage: layer2Url ? `url("${layer2Url}")` : 'none' }}
        />
        <div className="photo-overlay-vignette" />

        {/* Translucent Hero "Photo Taken" Date & Time Overlay */}
        <div className="photo-taken-hero-overlay">
          <div className="hero-date-badge">
            <span className="badge-icon">📅</span>
            <div className="badge-text-group">
              <span className="badge-sub-label">PHOTO TAKEN</span>
              <span className="badge-main-date">{formatHumanDate(currentPhoto.date)}</span>
            </div>
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

      {/* Top HUD Header Bar */}
      <header className="system-hud-bar">
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
          <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="active-pulse-dot" />
            <span>{sysStatus}</span>
          </span>
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

        {/* Right Status */}
        <div className="hud-right-sector">
          <div className="hud-stat-box">
            <span className="stat-label">CLOUD SYNC</span>
            <span className={`stat-value ${isConnectedToOneDrive ? 'ssd-connected' : 'ssd-idle'}`}>
              {isConnectedToOneDrive ? 'PAIRED' : 'SSH AUTH'}
            </span>
          </div>
          <div className="hud-stat-box">
            <span className="stat-label">PHOTOS</span>
            <span className="stat-value">
              {String(currentIndex + 1).padStart(2, '0')} / {String(photoList.length).padStart(2, '0')}
            </span>
          </div>
          <div className="hud-stat-box">
            <span className="stat-label">SOURCE</span>
            <span className={`stat-value ${isConnectedToOneDrive ? 'source-connected' : ''}`}>
              {isConnectedToOneDrive ? 'ONEDRIVE' : 'DEMO STREAM'}
            </span>
          </div>
          <button className="hud-btn config-hud-btn" onClick={() => setIsModalOpen(true)} title="Open Settings (M)">
            [ ⚙ CONFIG ]
          </button>
        </div>
      </header>

      {/* Left Glassmorphic Weather Sidebar - Cedarhurst, NY Live Telemetry */}
      {config.showWeatherSidebars !== false && (
        <aside className="weather-sidebar-left">
          <div className="wx-sidebar-header">
            <div className="wx-title-stack">
              <span className="wx-sys-tag">// CEDARHURST, NY</span>
              <span className="wx-location-name">LOCAL ATMOSPHERE</span>
            </div>
            <span className="wx-gps-tag">40.62° N / 73.73° W</span>
          </div>

          <div className="wx-hero-card">
            <WeatherSvg code={weatherData?.current?.weather_code ?? 0} />
            <div className="wx-temp-group">
              <div className="wx-main-temp">
                {weatherData?.current?.temperature_2m !== undefined
                  ? Math.round(weatherData.current.temperature_2m)
                  : '--'}
                °{config.tempUnit || 'F'}
              </div>
              <div className="wx-hi-lo-badge">
                <span className="wx-hi-val">▲ {weatherData?.daily?.temperature_2m_max?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_max[0]) : '--'}°</span>
                <span className="wx-lo-val">▼ {weatherData?.daily?.temperature_2m_min?.[0] !== undefined ? Math.round(weatherData.daily.temperature_2m_min[0]) : '--'}°</span>
              </div>
            </div>
          </div>

          <div className="wx-condition-desc">
            {getWeatherDescription(weatherData?.current?.weather_code ?? 0)}
          </div>

          <div className="wx-telemetry-grid">
            <div className="wx-telemetry-item">
              <span className="wx-tel-label">HUMIDITY</span>
              <span className="wx-tel-value">{weatherData?.current?.relative_humidity_2m ?? '--'}%</span>
            </div>
            <div className="wx-telemetry-item">
              <span className="wx-tel-label">WIND</span>
              <span className="wx-tel-value">
                {weatherData?.current?.wind_speed_10m !== undefined ? Math.round(weatherData.current.wind_speed_10m) : '--'}{' '}
                <span style={{ fontSize: '0.6rem' }}>{config.tempUnit === 'C' ? 'KM/H' : 'MPH'}</span>
              </span>
            </div>
            <div className="wx-telemetry-item">
              <span className="wx-tel-label">RAIN %</span>
              <span className="wx-tel-value">{weatherData?.daily?.precipitation_probability_max?.[0] ?? 0}%</span>
            </div>
          </div>
        </aside>
      )}

      {/* Right Glassmorphic Weather Sidebar - Cedarhurst, NY 5-Day Forecast */}
      {config.showWeatherSidebars !== false && (
        <aside className="weather-sidebar-right">
          <div className="wx-sidebar-header">
            <div className="wx-title-stack">
              <span className="wx-sys-tag">// CEDARHURST, NY</span>
              <span className="wx-location-name">5-DAY FORECAST</span>
            </div>
            <span className="wx-gps-tag">OUTLOOK</span>
          </div>

          <div className="wx-forecast-list">
            {(weatherData?.daily?.time || ['', '', '', '', '']).slice(0, 5).map((dateStr, idx) => {
              const code = weatherData?.daily?.weather_code?.[idx] ?? 0;
              const maxTemp = weatherData?.daily?.temperature_2m_max?.[idx];
              const minTemp = weatherData?.daily?.temperature_2m_min?.[idx];
              const pop = weatherData?.daily?.precipitation_probability_max?.[idx] ?? 0;
              const dayLabel = getDayAbbrev(dateStr, idx === 0);

              return (
                <div key={idx} className="wx-forecast-row">
                  <span className="wx-fc-day">{dayLabel}</span>
                  <div className="wx-fc-icon">
                    <WeatherSvg code={code} className="wx-fc-icon" />
                  </div>
                  <div className="wx-fc-temps">
                    <span className="wx-hi-val">{maxTemp !== undefined ? Math.round(maxTemp) : '--'}°</span>
                    <span className="wx-lo-val">{minTemp !== undefined ? Math.round(minTemp) : '--'}°</span>
                  </div>
                  <span className="wx-fc-pop">{pop}%</span>
                </div>
              );
            })}
          </div>
        </aside>
      )}

      {/* Bottom Metadata HUD Card */}
      <main className="hud-bottom-overlay">
        <div className="photo-meta-card">
          <div className="card-corner card-corner--tl" />
          <div className="card-corner card-corner--tr" />
          <div className="card-corner card-corner--bl" />
          <div className="card-corner card-corner--br" />

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
      </main>

      {/* Settings Modal */}
      <div className={`modal-backdrop ${isModalOpen ? 'active' : ''}`}>
        <div className="modal-hud-console">
          <div className="card-corner card-corner--tl" />
          <div className="card-corner card-corner--tr" />
          <div className="card-corner card-corner--bl" />
          <div className="card-corner card-corner--br" />

          <div className="modal-header">
            <div className="modal-title-stack">
              <span className="modal-sub">// DASHBOARD CONFIGURATION</span>
              <h3 className="modal-title">ARES CITY TV DASHBOARD SETTINGS</h3>
            </div>
            <button className="hud-btn" onClick={() => setIsModalOpen(false)}>
              [ ✕ CLOSE ]
            </button>
          </div>

          <div className="modal-body custom-scroll">
            <form onSubmit={(e) => e.preventDefault()}>
              <div className="settings-group">
                <h4 className="group-title">// MICROSOFT ONEDRIVE CONNECTION</h4>
                <div
                  style={{
                    marginBottom: 12,
                    padding: 10,
                    background: 'rgba(0, 240, 255, 0.08)',
                    border: '1px dashed rgba(0, 240, 255, 0.3)',
                    borderRadius: 4,
                    fontSize: '0.85rem'
                  }}
                >
                  <strong>💻 SSH / Headless Authentication Command:</strong>
                  <br />
                  Run <code style={{ color: '#00f0ff' }}>./scripts/onedrive-login.sh</code> over SSH to pair
                  OneDrive in 30 seconds!
                </div>
                <div className="form-row">
                  <label>OneDrive Token (Override):</label>
                  <input
                    type="password"
                    value={config.onedriveToken}
                    onChange={(e) => setConfig({ ...config, onedriveToken: e.target.value })}
                    placeholder="Automatically managed by ./scripts/onedrive-login.sh or paste token"
                  />
                </div>
                <div className="form-row">
                  <label>Target Folder / Path:</label>
                  <input
                    type="text"
                    value={config.onedriveFolder}
                    onChange={(e) => setConfig({ ...config, onedriveFolder: e.target.value })}
                    placeholder="e.g. Pictures or Pictures/Camera Roll"
                  />
                </div>
                <div className="form-row">
                  <button type="button" className="hud-btn" onClick={handleTestConnection}>
                    TEST ONEDRIVE CONNECTION
                  </button>
                  {testResult && (
                    <span
                      className={`test-result-msg ${
                        testResult.startsWith('✓') ? 'success' : 'error'
                      }`}
                    >
                      {testResult}
                    </span>
                  )}
                </div>
              </div>

              <div className="settings-group">
                <h4 className="group-title">// PHOTO FILTERING & SELECTION</h4>
                <div className="form-row checkbox-row">
                  <input
                    type="checkbox"
                    id="cfg-filter"
                    checked={config.filterScreenshots}
                    onChange={(e) => setConfig({ ...config, filterScreenshots: e.target.checked })}
                  />
                  <label htmlFor="cfg-filter">
                    <strong>Smart Filter:</strong> Exclude screenshots, documents, and non-photo assets
                  </label>
                </div>
                <div className="form-row">
                  <label>Search Query Filter:</label>
                  <input
                    type="text"
                    value={config.albumQuery}
                    onChange={(e) => setConfig({ ...config, albumQuery: e.target.value })}
                    placeholder="e.g. .jpg or .png or search term"
                  />
                </div>
              </div>

              <div className="settings-group">
                <h4 className="group-title">// SLIDESHOW & DISPLAY</h4>
                <div className="form-row">
                  <label>4K TV UI Text Scale:</label>
                  <select
                    value={config.uiScale || '150'}
                    onChange={(e) => setConfig({ ...config, uiScale: e.target.value })}
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
                    <option value="100">100% Standard (Desktop)</option>
                    <option value="125">125% Large Display</option>
                    <option value="150">150% Ultra 4K TV (Recommended)</option>
                    <option value="175">175% Giant TV Font</option>
                  </select>
                </div>
                <div className="form-row">
                  <label>Photo Sizing / Fit Mode:</label>
                  <select
                    value={config.imageFitMode || 'contain'}
                    onChange={(e) => setConfig({ ...config, imageFitMode: e.target.value })}
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
            </form>
          </div>

          <div className="modal-footer">
            <div className="shortcuts-hint">
              <span className="hint-key">◀/▶</span> Skip &nbsp;
              <span className="hint-key">SPACE</span> Pause &nbsp;
              <span className="hint-key">D</span> Description &nbsp;
              <span className="hint-key">F</span> Fullscreen &nbsp;
              <span className="hint-key">S</span> Scanlines &nbsp;
              <span className="hint-key">M</span> Settings
            </div>
            <button
              className="hud-btn btn-primary"
              onClick={() => {
                saveConfig(config);
                setIsModalOpen(false);
                fetchPhotos();
              }}
            >
              [ SAVE & APPLY ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
