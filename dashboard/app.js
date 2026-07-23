/* ==============================================================================
   ARES CITY OS — TV DASHBOARD & PHOTO STREAM ENGINE
   ============================================================================== */

(function () {
  'use strict';

  // --- Configuration Management ---
  const STORAGE_KEY = 'ares_tv_dashboard_config';
  const DEFAULT_CONFIG = {
    photoprismUrl: 'http://localhost:2342',
    password: '',
    filterScreenshots: true,
    albumQuery: '',
    slideDuration: 15, // seconds
    enableKenBurns: true,
    enableScanlines: true,
    enableFallbackDemo: true
  };

  let config = loadConfig();

  // --- High-Resolution Fallback Demo Photos ---
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

  // --- Application State ---
  let photoList = [];
  let currentIndex = 0;
  let isPaused = false;
  let slideTimer = null;
  let progressInterval = null;
  let slideStartTime = 0;
  let activeLayer = 1; // 1 or 2
  let isConnectedToPhotoPrism = false;

  // --- DOM Elements ---
  const elViewport = document.getElementById('slideshow-viewport');
  const elLayer1 = document.getElementById('bg-layer-1');
  const elLayer2 = document.getElementById('bg-layer-2');
  const elScanline = document.getElementById('hud-scanline');
  
  const elClockTime = document.getElementById('clock-time');
  const elClockAmPm = document.getElementById('clock-ampm');
  const elClockDate = document.getElementById('clock-date');
  const elAresSol = document.getElementById('ares-sol-text');
  
  const elSysStatusText = document.getElementById('sys-status-text');
  const elStatusPill = document.querySelector('.status-pill');
  const elPhotoCounter = document.getElementById('photo-index-counter');
  const elSourceBadge = document.getElementById('source-badge');

  const elPhotoTitle = document.getElementById('photo-title');
  const elMetaDate = document.getElementById('meta-date');
  const elMetaLocation = document.getElementById('meta-location');
  const elMetaCamera = document.getElementById('meta-camera');
  const elMetaExif = document.getElementById('meta-exif');
  const elProgressBar = document.getElementById('slide-progress');
  const elMetaCard = document.getElementById('photo-meta-card');

  // Controls
  const btnPrev = document.getElementById('btn-prev');
  const btnNext = document.getElementById('btn-next');
  const btnPause = document.getElementById('btn-pause');
  const btnScanline = document.getElementById('btn-scanline');
  const btnFullscreen = document.getElementById('btn-fullscreen');
  const btnOpenSettings = document.getElementById('btn-open-settings');

  // Modal Settings
  const modalSettings = document.getElementById('settings-modal');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const btnSaveSettings = document.getElementById('btn-save-settings');
  const btnTestConnection = document.getElementById('btn-test-connection');
  const elTestResult = document.getElementById('connection-test-result');

  const inputUrl = document.getElementById('cfg-photoprism-url');
  const inputPassword = document.getElementById('cfg-admin-password');
  const chkFilterScreenshots = document.getElementById('cfg-filter-screenshots');
  const inputAlbumQuery = document.getElementById('cfg-album-query');
  const inputSlideDuration = document.getElementById('cfg-slide-duration');
  const chkKenBurns = document.getElementById('cfg-enable-kenburns');
  const chkScanlines = document.getElementById('cfg-enable-scanlines');
  const chkFallbackDemo = document.getElementById('cfg-fallback-demo');

  // --- Initialization ---
  function init() {
    applyConfigUI();
    updateClock();
    setInterval(updateClock, 1000);

    setupEventListeners();
    fetchPhotosAndStart();
  }

  // --- Config Helpers ---
  function loadConfig() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : { ...DEFAULT_CONFIG };
    } catch (e) {
      return { ...DEFAULT_CONFIG };
    }
  }

  function saveConfig() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.error('Failed to save config', e);
    }
  }

  function applyConfigUI() {
    inputUrl.value = config.photoprismUrl;
    inputPassword.value = config.password;
    chkFilterScreenshots.checked = config.filterScreenshots;
    inputAlbumQuery.value = config.albumQuery;
    inputSlideDuration.value = config.slideDuration;
    chkKenBurns.checked = config.enableKenBurns;
    chkScanlines.checked = config.enableScanlines;
    chkFallbackDemo.checked = config.enableFallbackDemo;

    if (config.enableScanlines) {
      elScanline.classList.remove('disabled');
    } else {
      elScanline.classList.add('disabled');
    }
  }

  // --- Real-time Clock & Ares Sol Calculator ---
  function updateClock() {
    const now = new Date();
    
    // 12-Hour format with AM/PM
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // hour 0 should be 12
    const hStr = String(hours).padStart(2, '0');
    const mStr = String(now.getMinutes()).padStart(2, '0');
    const sStr = String(now.getSeconds()).padStart(2, '0');

    elClockTime.textContent = `${hStr}:${mStr}:${sStr}`;
    elClockAmPm.textContent = ampm;

    // Date
    const options = { weekday: 'short', month: 'short', day: '2-digit', year: 'numeric' };
    elClockDate.textContent = now.toLocaleDateString('en-US', options).toUpperCase();

    // Ares Sol Calculation (Mars Solar Date formula)
    // MSD = (Julian Date UT - 2451549.5) / 1.027491252 + 44796.0
    const julianDate = (now.getTime() / 86400000) + 2440587.5;
    const msd = (julianDate - 2451549.5) / 1.027491252 + 44796.0;
    elAresSol.textContent = `ARES SOL: ${msd.toFixed(3)}`;
  }

  // --- PhotoPrism API Client & Smart Filter ---
  async function fetchPhotosAndStart() {
    setSystemStatus('CONNECTING...', false);
    photoList = [];

    let fetched = await fetchFromPhotoPrism();

    if (fetched && fetched.length > 0) {
      photoList = fetched;
      isConnectedToPhotoPrism = true;
      elSourceBadge.textContent = 'PHOTOPRISM';
      elSourceBadge.className = 'stat-value source-connected';
      setSystemStatus('SYSTEM ONLINE', true);
    } else if (config.enableFallbackDemo) {
      photoList = DEMO_PHOTOS;
      isConnectedToPhotoPrism = false;
      elSourceBadge.textContent = 'DEMO STREAM';
      elSourceBadge.className = 'stat-value';
      setSystemStatus('DEMO MODE', true);
    } else {
      setSystemStatus('NO PHOTOS FOUND', false);
      elPhotoTitle.textContent = 'No photos match your filter settings';
      return;
    }

    currentIndex = 0;
    showPhoto(currentIndex);
    startSlideshowTimer();
  }

  async function fetchFromPhotoPrism() {
    try {
      const baseUrl = config.photoprismUrl.replace(/\/$/, '');
      let endpoint = `${baseUrl}/api/v1/photos?count=500&order=newest`;
      
      if (config.albumQuery.trim()) {
        endpoint += `&q=${encodeURIComponent(config.albumQuery.trim())}`;
      }

      const headers = {};
      if (config.password) {
        headers['X-Auth-Token'] = config.password;
      }

      const response = await fetch(endpoint, { headers });
      if (!response.ok) return null;

      const data = await response.json();
      if (!Array.isArray(data)) return null;

      // Filter photos
      return data
        .filter(item => {
          if (!config.filterScreenshots) return true;
          return isRealCameraPhoto(item);
        })
        .map(item => transformPhotoItem(item, baseUrl));
    } catch (e) {
      console.warn('PhotoPrism fetch failed:', e);
      return null;
    }
  }

  function isRealCameraPhoto(item) {
    // Check type
    if (item.Type && item.Type !== 'image') return false;

    // String search targets
    const searchTarget = [
      item.Title,
      item.Name,
      item.FileName,
      item.Path,
      item.Description,
      ...(item.Keywords || []),
      ...(item.Labels ? item.Labels.map(l => l.Name || '') : [])
    ].join(' ').toLowerCase();

    // Screenshot & AI exclusion terms
    const forbiddenTerms = [
      'screenshot', 'screen_shot', 'screen shot', 'captura de pantalla',
      'ai', 'midjourney', 'dall-e', 'dalle', 'stable_diffusion', 'sd_out',
      'document', 'doc_', 'receipt', 'invoice', 'text', 'drawing', 'illustration', 'vector'
    ];

    for (const term of forbiddenTerms) {
      if (searchTarget.includes(term)) return false;
    }

    // Dimension check: Screenshots usually match exact screen aspect ratios with no camera EXIF model
    if (!item.CameraModel && item.Width && item.Height) {
      const ratio = item.Width / item.Height;
      // Standard mobile/desktop screenshot ratios without camera info
      if (Math.abs(ratio - 16/9) < 0.01 || Math.abs(ratio - 9/16) < 0.01 || Math.abs(ratio - 19.5/9) < 0.01) {
        return false;
      }
    }

    return true;
  }

  function transformPhotoItem(item, baseUrl) {
    // PhotoPrism image URL construction
    const photoUrl = `${baseUrl}/api/v1/photos/${item.Hash}/dl?t=${item.Secret || ''}`;
    
    // EXIF formatting
    const exifParts = [];
    if (item.FocalLength) exifParts.push(`${item.FocalLength}mm`);
    if (item.FNumber) exifParts.push(`f/${item.FNumber}`);
    if (item.Exposure) exifParts.push(`${item.Exposure}s`);
    if (item.Iso) exifParts.push(`ISO ${item.Iso}`);

    return {
      id: item.ID || item.Hash,
      title: item.Title || item.Name || 'Photo Asset',
      date: item.TakenAt ? item.TakenAt.replace('T', ' ').substring(0, 16) : 'Unknown Date',
      location: [item.City, item.Country].filter(Boolean).join(', ') || 'Earth',
      camera: item.CameraModel || item.CameraMake || 'Digital Camera',
      exif: exifParts.length > 0 ? exifParts.join(' • ') : 'Standard Capture',
      url: photoUrl
    };
  }

  function setSystemStatus(text, isOnline) {
    elSysStatusText.textContent = text;
    if (isOnline) {
      elStatusPill.className = 'status-pill online';
    } else {
      elStatusPill.className = 'status-pill offline';
    }
  }

  // --- Slideshow Display & Ken Burns Handler ---
  function showPhoto(index) {
    if (!photoList || photoList.length === 0) return;

    const photo = photoList[index];
    elPhotoCounter.textContent = `${String(index + 1).padStart(2, '0')} / ${String(photoList.length).padStart(2, '0')}`;

    // Update Photo Meta Card
    elPhotoTitle.textContent = photo.title;
    elMetaDate.textContent = photo.date;
    elMetaLocation.textContent = photo.location;
    elMetaCamera.textContent = photo.camera;
    elMetaExif.textContent = photo.exif;

    // Cross-fade between Layer 1 and Layer 2 with Ken Burns
    const nextLayer = activeLayer === 1 ? elLayer2 : elLayer1;
    const currentLayer = activeLayer === 1 ? elLayer1 : elLayer2;

    // Set background image
    nextLayer.style.backgroundImage = `url("${photo.url}")`;

    // Toggle Ken Burns animation class
    const kenburnsClass = (index % 2 === 0) ? 'kenburns-1' : 'kenburns-2';
    nextLayer.className = `photo-layer ${config.enableKenBurns ? kenburnsClass : ''}`;
    
    // Trigger opacity cross-fade
    setTimeout(() => {
      nextLayer.classList.add('active');
      currentLayer.classList.remove('active');
      activeLayer = activeLayer === 1 ? 2 : 1;
    }, 50);

    resetProgressBar();
  }

  function nextPhoto() {
    if (photoList.length === 0) return;
    currentIndex = (currentIndex + 1) % photoList.length;
    showPhoto(currentIndex);
  }

  function prevPhoto() {
    if (photoList.length === 0) return;
    currentIndex = (currentIndex - 1 + photoList.length) % photoList.length;
    showPhoto(currentIndex);
  }

  function togglePause() {
    isPaused = !isPaused;
    if (isPaused) {
      btnPause.textContent = '▶';
      btnPause.title = 'Play (Spacebar)';
      clearInterval(slideTimer);
      clearInterval(progressInterval);
    } else {
      btnPause.textContent = '⏸';
      btnPause.title = 'Pause (Spacebar)';
      startSlideshowTimer();
    }
  }

  function startSlideshowTimer() {
    clearInterval(slideTimer);
    clearInterval(progressInterval);
    if (isPaused) return;

    const durationMs = config.slideDuration * 1000;
    slideStartTime = Date.now();

    slideTimer = setInterval(() => {
      nextPhoto();
    }, durationMs);

    progressInterval = setInterval(() => {
      const elapsed = Date.now() - slideStartTime;
      const pct = Math.min((elapsed / durationMs) * 100, 100);
      elProgressBar.style.width = `${pct}%`;
    }, 100);
  }

  function resetProgressBar() {
    slideStartTime = Date.now();
    elProgressBar.style.width = '0%';
  }

  // --- UI & Modal Controls ---
  function setupEventListeners() {
    btnNext.addEventListener('click', () => { nextPhoto(); startSlideshowTimer(); });
    btnPrev.addEventListener('click', () => { prevPhoto(); startSlideshowTimer(); });
    btnPause.addEventListener('click', togglePause);

    btnScanline.addEventListener('click', () => {
      config.enableScanlines = !config.enableScanlines;
      chkScanlines.checked = config.enableScanlines;
      saveConfig();
      elScanline.classList.toggle('disabled', !config.enableScanlines);
    });

    btnFullscreen.addEventListener('click', toggleFullscreen);

    btnOpenSettings.addEventListener('click', () => { modalSettings.classList.add('active'); });
    btnCloseSettings.addEventListener('click', () => { modalSettings.classList.remove('active'); });

    btnTestConnection.addEventListener('click', testConnection);

    btnSaveSettings.addEventListener('click', (e) => {
      e.preventDefault();
      config.photoprismUrl = inputUrl.value.trim() || DEFAULT_CONFIG.photoprismUrl;
      config.password = inputPassword.value.trim();
      config.filterScreenshots = chkFilterScreenshots.checked;
      config.albumQuery = inputAlbumQuery.value.trim();
      config.slideDuration = Math.max(3, parseInt(inputSlideDuration.value, 10) || 15);
      config.enableKenBurns = chkKenBurns.checked;
      config.enableScanlines = chkScanlines.checked;
      config.enableFallbackDemo = chkFallbackDemo.checked;

      saveConfig();
      applyConfigUI();
      modalSettings.classList.remove('active');

      fetchPhotosAndStart();
    });

    // Keyboard & TV Remote Navigation
    window.addEventListener('keydown', (e) => {
      if (modalSettings.classList.contains('active')) {
        if (e.key === 'Escape') modalSettings.classList.remove('active');
        return;
      }

      switch (e.key) {
        case 'ArrowRight':
          nextPhoto();
          startSlideshowTimer();
          break;
        case 'ArrowLeft':
          prevPhoto();
          startSlideshowTimer();
          break;
        case ' ':
        case 'Enter':
          togglePause();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 's':
        case 'S':
          btnScanline.click();
          break;
        case 'm':
        case 'M':
        case 'c':
        case 'C':
          modalSettings.classList.add('active');
          break;
      }
    });
  }

  async function testConnection() {
    elTestResult.textContent = 'Testing connection...';
    elTestResult.className = 'test-result-msg';

    const testUrl = inputUrl.value.trim().replace(/\/$/, '');
    const headers = {};
    if (inputPassword.value.trim()) {
      headers['X-Auth-Token'] = inputPassword.value.trim();
    }

    try {
      const res = await fetch(`${testUrl}/api/v1/ping`, { headers });
      if (res.ok) {
        elTestResult.textContent = '✓ Connected to PhotoPrism!';
        elTestResult.className = 'test-result-msg success';
      } else {
        elTestResult.textContent = `✗ HTTP Error ${res.status}`;
        elTestResult.className = 'test-result-msg error';
      }
    } catch (e) {
      elTestResult.textContent = '✗ Unreachable server or CORS issue';
      elTestResult.className = 'test-result-msg error';
    }
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.warn(`Error attempting to enable fullscreen: ${err.message}`);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // Run on page load
  document.addEventListener('DOMContentLoaded', init);

})();
