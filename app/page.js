'use client';

import { useState, useEffect, useRef } from 'react';

const DEMO_PHOTOS = [
  {
    id: 'demo-1',
    title: 'Ares Habitat Surface Survey',
    date: '2026-07-21 18:45',
    location: 'Ares Crater, Mars System',
    camera: 'Ares Rover Optical Cam 4K',
    exif: '24mm • f/4.0 • 1/1000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-2',
    title: 'Nebula Horizon Over City',
    date: '2026-06-15 22:10',
    location: 'Citizen Suite Penthouse',
    camera: 'Sony Alpha A7 IV',
    exif: '35mm • f/1.8 • 1/60s • ISO 800',
    url: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-3',
    title: 'Pressurized Mountain Pass',
    date: '2026-05-04 11:30',
    location: 'Sector 02 Alpine Loop',
    camera: 'Fujifilm X-T5',
    exif: '16mm • f/8.0 • 1/250s • ISO 200',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-4',
    title: 'Cosmic Reflection Lake',
    date: '2026-04-12 05:20',
    location: 'Northern Colony Sanctuary',
    camera: 'Canon EOS R5',
    exif: '50mm • f/1.4 • 1/4000s • ISO 100',
    url: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?q=80&w=2000&auto=format&fit=crop'
  },
  {
    id: 'demo-5',
    title: 'Deep Space Orbital Aurora',
    date: '2026-03-29 02:15',
    location: 'Ares City Orbital Platform',
    camera: 'Orbital Tele-Array Mark III',
    exif: '85mm • f/1.2 • 1/30s • ISO 1600',
    url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=2000&auto=format&fit=crop'
  }
];

export default function TvDashboard() {
  const [config, setConfig] = useState({
    onedriveToken: '',
    onedriveFolder: '',
    filterScreenshots: true,
    albumQuery: '',
    slideDuration: 15,
    enableKenBurns: true,
    enableScanlines: true,
    enableFallbackDemo: true
  });

  const [photoList, setPhotoList] = useState(DEMO_PHOTOS);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnectedToOneDrive, setIsConnectedToOneDrive] = useState(false);
  const [sysStatus, setSysStatus] = useState('INITIALIZING...');
  const [isOnline, setIsOnline] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [testResult, setTestResult] = useState('');

  // Clock state
  const [clockTime, setClockTime] = useState('00:00:00');
  const [clockAmPm, setClockAmPm] = useState('AM');
  const [clockDate, setClockDate] = useState('MON, JAN 01, 2026');
  const [aresSol, setAresSol] = useState('ARES SOL: 0.000');

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

  // Load config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ares_tv_dashboard_config');
      if (saved) {
        setConfig((prev) => ({ ...prev, ...JSON.parse(saved) }));
      }
    } catch (e) {
      // localStorage unavailable
    }
  }, []);

  // Save config helper
  const saveConfig = (newConfig) => {
    setConfig(newConfig);
    try {
      localStorage.setItem('ares_tv_dashboard_config', JSON.stringify(newConfig));
    } catch (e) {}
  };

  // Clock interval
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

      const julianDate = now.getTime() / 86400000 + 2440587.5;
      const msd = (julianDate - 2451549.5) / 1.027491252 + 44796.0;
      setAresSol(`ARES SOL: ${msd.toFixed(3)}`);
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
        filterScreenshots: config.filterScreenshots ? 'true' : 'false'
      });

      const res = await fetch(`/api/onedrive/photos?${params.toString()}`);
      const data = await res.json();

      if (data.success && data.photos && data.photos.length > 0) {
        setPhotoList(data.photos);
        setIsConnectedToOneDrive(true);
        setIsOnline(true);
        setSysStatus(`ONLINE (${data.photos.length} PHOTOS)`);
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

    if (activeLayer === 1) {
      setLayer2Url(currentPhoto.url);
      setLayer2Class(`photo-layer ${config.enableKenBurns ? kenburnsClass : ''} active`);
      setLayer1Class((prev) => prev.replace(' active', ''));
      setActiveLayer(2);
    } else {
      setLayer1Url(currentPhoto.url);
      setLayer1Class(`photo-layer ${config.enableKenBurns ? kenburnsClass : ''} active`);
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
    <>
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
      </div>

      {/* Overlays */}
      <div className="city-matrix-underlay" />
      <div className={`hud-scanline ${config.enableScanlines ? '' : 'disabled'}`} />

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
            <span className="hud-sys-name">NEXT.JS TV DASHBOARD</span>
          </div>
          <span className={`status-pill ${isOnline ? 'online' : 'offline'}`}>
            <span className="active-pulse-dot" />
            <span>{sysStatus}</span>
          </span>
        </div>

        {/* Center Clock */}
        <div className="hud-clock-sector">
          <div className="time-main-display">
            <span>{clockTime}</span>
            <span id="clock-ampm">{clockAmPm}</span>
          </div>
          <div className="clock-sub-details">
            <span className="hud-text-highlight">{clockDate}</span>
            <span className="hud-divider">|</span>
            <span className="hud-text-dim">{aresSol}</span>
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
          <button className="hud-btn" onClick={() => setIsModalOpen(true)} title="Open Settings (M)">
            [ ⚙ CONFIG ]
          </button>
        </div>
      </header>

      {/* Bottom Metadata HUD Card */}
      <main className="hud-bottom-overlay">
        <div className="photo-meta-card">
          <div className="card-corner card-corner--tl" />
          <div className="card-corner card-corner--tr" />
          <div className="card-corner card-corner--bl" />
          <div className="card-corner card-corner--br" />

          <div className="meta-card-header">
            <div className="meta-title-group">
              <span className="meta-sector-label">// TELEMETRY // CURRENT ASSET</span>
              <h2 className="photo-title">{currentPhoto.title}</h2>
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

          {/* EXIF Telemetry Row */}
          <div className="meta-telemetry-grid">
            <div className="telemetry-item">
              <span className="t-label">DATE TAKEN</span>
              <span className="t-value">{currentPhoto.date}</span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">LOCATION</span>
              <span className="t-value">{currentPhoto.location}</span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">CAMERA</span>
              <span className="t-value">{currentPhoto.camera}</span>
            </div>
            <div className="telemetry-item">
              <span className="t-label">EXIF</span>
              <span className="t-value">{currentPhoto.exif}</span>
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
            </form>
          </div>

          <div className="modal-footer">
            <div className="shortcuts-hint">
              <span className="hint-key">◀/▶</span> Skip &nbsp;
              <span className="hint-key">SPACE</span> Pause &nbsp;
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
    </>
  );
}
